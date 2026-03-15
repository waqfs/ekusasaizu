"""Gemini communication layer.

Uses google-genai to communicate with Gemini 2.5 Flash.
Falls back to mock responses if no API key is configured.
Maintains per-session conversation history for multi-turn chat.
"""

import logging
import re
import os
from datetime import datetime, timezone

from .schemas import BatchPayload, GeminiRequest, GeminiResponse
from .coach_prompt import get_system_prompt, build_coaching_prompt

logger = logging.getLogger("ekusasaizu.gemini")

# Per-session API key overrides (session_id → api_key)
_session_api_keys: dict[str, str] = {}

# Per-session conversation history (session_id → list of {role, text})
_session_history: dict[str, list[dict]] = {}

# Regex to extract exercise start commands from Gemini output
_COMMAND_RE = re.compile(r"<<START_EXERCISE:(\w+)>>")


def set_session_api_key(session_id: str, api_key: str) -> None:
    """Store a per-session Gemini API key."""
    _session_api_keys[session_id] = api_key


def clear_session_api_key(session_id: str) -> None:
    """Remove a per-session Gemini API key."""
    _session_api_keys.pop(session_id, None)


def init_session_history(session_id: str) -> None:
    """Initialize conversation history for a new session."""
    _session_history[session_id] = []


def clear_session_history(session_id: str) -> None:
    """Remove conversation history for a session."""
    _session_history.pop(session_id, None)


def _get_api_key(session_id: str) -> str | None:
    """Get the API key for a session — user override first, then env."""
    return _session_api_keys.get(session_id) or os.environ.get("GEMINI_API_KEY")


def _add_to_history(session_id: str, role: str, text: str) -> None:
    """Add a message to session conversation history."""
    history = _session_history.setdefault(session_id, [])
    history.append({"role": role, "text": text})
    # Keep history bounded to avoid token overflow
    if len(history) > 50:
        _session_history[session_id] = history[-40:]


def _parse_commands(text: str) -> tuple[str, list[dict]]:
    """Extract commands from Gemini response text.

    Returns (clean_text, commands) where clean_text has command tags removed.
    """
    commands = []
    for match in _COMMAND_RE.finditer(text):
        exercise_id = match.group(1)
        commands.append({"type": "start_exercise", "exercise_id": exercise_id})

    clean_text = _COMMAND_RE.sub("", text).strip()
    return clean_text, commands


def summarize_pose_frames(payload: BatchPayload) -> dict:
    """Summarize pose frames into a compact representation for Gemini."""
    if not payload.pose_frames:
        return {"frame_count": 0}

    frame_count = len(payload.pose_frames)
    first_ts = payload.pose_frames[0].timestamp
    last_ts = payload.pose_frames[-1].timestamp

    return {
        "frame_count": frame_count,
        "time_span_ms": round(last_ts - first_ts, 1),
        "avg_landmarks_per_frame": 33,
    }


def build_gemini_request(payload: BatchPayload) -> GeminiRequest:
    """Build a structured Gemini request from a batch payload."""
    prompt = build_coaching_prompt(
        exercise=payload.exercise,
        rep_count=payload.workout_status.rep_count,
        form_events=[e.model_dump() for e in payload.form_events],
        form_issues=payload.workout_status.form_issues,
        current_score=payload.workout_status.current_score,
        hold_duration=payload.workout_status.hold_duration,
        angle_values=payload.angle_values,
    )

    return GeminiRequest(
        session_id=payload.session_id,
        exercise=payload.exercise,
        prompt=prompt,
        pose_summary=summarize_pose_frames(payload),
        audio_duration_seconds=None,
        rep_count=payload.workout_status.rep_count,
        form_events=payload.form_events,
        angle_values=payload.angle_values,
    )


def _build_contents(session_id: str, user_message: str) -> list[dict]:
    """Build the full contents array including conversation history."""
    system_prompt = get_system_prompt()
    contents = [
        {"role": "user", "parts": [{"text": system_prompt}]},
        {"role": "model", "parts": [{"text": "Understood. I'm Kora, your exercise coach. I can see the available exercises and I'm ready to guide your workout. What would you like to work on today?"}]},
    ]

    # Add conversation history
    history = _session_history.get(session_id, [])
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["text"]}]})

    # Add the current message
    contents.append({"role": "user", "parts": [{"text": user_message}]})

    return contents


async def send_chat(session_id: str, user_text: str) -> GeminiResponse:
    """Handle a user chat message — send to Gemini with conversation history."""
    api_key = _get_api_key(session_id)

    _add_to_history(session_id, "user", user_text)

    logger.info(
        "GEMINI CHAT [%s] user=%s api_key=%s",
        session_id,
        user_text[:80],
        "user" if session_id in _session_api_keys else ("env" if api_key else "none"),
    )

    if not api_key:
        logger.info("No API key — using mock chat response")
        mock_text = _mock_chat_response(user_text)
        _add_to_history(session_id, "model", mock_text)
        clean_text, commands = _parse_commands(mock_text)
        return GeminiResponse(
            session_id=session_id,
            coaching_text=clean_text,
            commands=commands,
        )

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        contents = _build_contents(session_id, user_text)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )

        raw_text = response.text or "I'm here to help! What would you like to work on?"
        _add_to_history(session_id, "model", raw_text)
        clean_text, commands = _parse_commands(raw_text)

        logger.info("GEMINI CHAT RESPONSE [%s] → %s (commands=%s)", session_id, clean_text[:80], commands)

        return GeminiResponse(
            session_id=session_id,
            coaching_text=clean_text,
            commands=commands,
        )

    except Exception as e:
        logger.error("Gemini chat API error: %s — falling back to mock", e)
        mock_text = _mock_chat_response(user_text)
        _add_to_history(session_id, "model", mock_text)
        clean_text, commands = _parse_commands(mock_text)
        return GeminiResponse(
            session_id=session_id,
            coaching_text=clean_text,
            commands=commands,
        )


async def send_to_gemini(request: GeminiRequest) -> GeminiResponse:
    """Send workout data to Gemini for coaching response.

    Uses conversation history + workout data for context-aware coaching.
    """
    api_key = _get_api_key(request.session_id)

    logger.info(
        "GEMINI BATCH [%s] exercise=%s reps=%d api_key=%s",
        request.session_id,
        request.exercise,
        request.rep_count,
        "user" if request.session_id in _session_api_keys else ("env" if api_key else "none"),
    )

    if not api_key:
        logger.info("No API key — using mock response")
        mock_text = _generate_mock_coaching(request)
        return GeminiResponse(session_id=request.session_id, coaching_text=mock_text)

    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        # Add workout data as a "user" message in conversation
        _add_to_history(request.session_id, "user", request.prompt)
        contents = _build_contents(request.session_id, request.prompt)

        # Remove the duplicate — _build_contents already adds the current message
        # We added to history above, and _build_contents also appends it.
        # Fix: don't add to history here, let _build_contents handle the current msg.
        # Actually, _build_contents iterates history AND adds user_message.
        # Since we already added to history, the message appears twice.
        # Remove from history since _build_contents adds it separately.
        history = _session_history.get(request.session_id, [])
        if history and history[-1]["text"] == request.prompt:
            history.pop()

        contents = _build_contents(request.session_id, request.prompt)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )

        raw_text = response.text or "Keep going!"
        _add_to_history(request.session_id, "user", request.prompt)
        _add_to_history(request.session_id, "model", raw_text)
        clean_text, commands = _parse_commands(raw_text)

        logger.info("GEMINI RESPONSE [%s] → %s", request.session_id, clean_text[:80])

        return GeminiResponse(
            session_id=request.session_id,
            coaching_text=clean_text,
            commands=commands,
        )

    except Exception as e:
        logger.error("Gemini API error: %s — falling back to mock", e)
        mock_text = _generate_mock_coaching(request)
        return GeminiResponse(session_id=request.session_id, coaching_text=mock_text)


def _mock_chat_response(user_text: str) -> str:
    """Generate a mock chat response based on user input."""
    lower = user_text.lower()

    if any(w in lower for w in ["what exercise", "what can i do", "full body", "recommend"]):
        return ("Great question! Here's what I have available:\n"
                "- **Squats** — excellent for legs and core\n"
                "- **Lat Pull Downs** — great for upper back and arms\n"
                "- **Straight Leg Raises** — fantastic for core strength\n"
                "- **Single Leg Raises** — perfect for balance and hip mobility\n\n"
                "What would you like to start with?")

    if any(w in lower for w in ["squat"]):
        return "Let's get those squats going! Stand in front of your camera and I'll track your form. <<START_EXERCISE:squat>>"

    if any(w in lower for w in ["lat pull", "pull down", "lat_pull"]):
        return "Lat pull downs — great choice for your back! Get into position and let's go. <<START_EXERCISE:lat_pull_down>>"

    if any(w in lower for w in ["leg raise", "leg_raise", "straight leg"]):
        return "Straight leg raises are perfect for core work. Lie down and let's start! <<START_EXERCISE:straight_leg_raises>>"

    if any(w in lower for w in ["single leg", "one leg"]):
        return "Single leg raises — great for balance! Let's get started. <<START_EXERCISE:single_leg_raise>>"

    if any(w in lower for w in ["acl", "knee", "physical therapy", "pt", "rehab"]):
        return ("For ACL recovery and knee rehab, I'd recommend **Straight Leg Raises** — "
                "they strengthen the quads without putting stress on the knee joint. "
                "Want me to start that exercise? <<START_EXERCISE:straight_leg_raises>>")

    if any(w in lower for w in ["yes", "yeah", "sure", "ok", "let's go", "start", "ready"]):
        return "Ready when you are! Get into position in front of your camera."

    if any(w in lower for w in ["thanks", "thank you"]):
        return "You're welcome! Keep up the great work. 💪"

    return "I'm here to help! You can ask me about exercises, form tips, or tell me what you'd like to work on."


def _generate_mock_coaching(request: GeminiRequest) -> str:
    """Generate a mock coaching response based on current state."""
    if request.form_events:
        last_event = request.form_events[-1]
        if last_event.type == "rep_completed":
            return f"Nice rep #{request.rep_count}! Score: {last_event.score}. Keep that form tight."
        elif last_event.type == "hips_dropping":
            return "Watch your hips — keep your body in a straight line."
        elif last_event.type == "knees_caving":
            return "Push your knees out over your toes. Don't let them cave in."
        elif last_event.type == "depth_too_shallow":
            return "Go a bit deeper on the next one — full range of motion."
        elif last_event.type == "good_form":
            return "Looking good! Keep it up."

    return f"Keep going — you're at {request.rep_count} reps."
