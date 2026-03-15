"""Gemini communication layer.

Uses google-genai to communicate with Gemini 2.5 Flash.
Falls back to mock responses if no API key is configured.
"""

import logging
import json
import os
from datetime import datetime, timezone

from .schemas import BatchPayload, GeminiRequest, GeminiResponse
from .coach_prompt import SYSTEM_PROMPT, build_coaching_prompt

logger = logging.getLogger("ekusasaizu.gemini")

# Per-session API key overrides (session_id → api_key)
_session_api_keys: dict[str, str] = {}


def set_session_api_key(session_id: str, api_key: str) -> None:
    """Store a per-session Gemini API key."""
    _session_api_keys[session_id] = api_key


def clear_session_api_key(session_id: str) -> None:
    """Remove a per-session Gemini API key."""
    _session_api_keys.pop(session_id, None)


def _get_api_key(session_id: str) -> str | None:
    """Get the API key for a session — user override first, then env."""
    return _session_api_keys.get(session_id) or os.environ.get("GEMINI_API_KEY")


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


async def send_to_gemini(request: GeminiRequest) -> GeminiResponse:
    """Send data to Gemini for coaching response.

    Uses the google-genai SDK with Gemini 2.5 Flash.
    Falls back to mock responses if no API key is available.
    """
    api_key = _get_api_key(request.session_id)

    logger.info(
        "GEMINI REQUEST [%s] exercise=%s reps=%d api_key=%s",
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

        contents = [
            {"role": "user", "parts": [{"text": SYSTEM_PROMPT}]},
            {"role": "model", "parts": [{"text": "Understood. I'm Kora, your exercise coach. Ready to guide your workout."}]},
            {"role": "user", "parts": [{"text": request.prompt}]},
        ]

        # Add audio context if available
        if request.audio_transcript:
            contents.append(
                {"role": "user", "parts": [{"text": f"User said: {request.audio_transcript}"}]}
            )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )

        coaching_text = response.text or "Keep going!"
        logger.info("GEMINI RESPONSE [%s] → %s", request.session_id, coaching_text)

        return GeminiResponse(
            session_id=request.session_id,
            coaching_text=coaching_text,
        )

    except Exception as e:
        logger.error("Gemini API error: %s — falling back to mock", e)
        mock_text = _generate_mock_coaching(request)
        return GeminiResponse(session_id=request.session_id, coaching_text=mock_text)


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
