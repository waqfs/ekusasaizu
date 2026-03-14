"""Gemini communication layer.

Currently logging only — not hitting the Gemini API yet.
When ready, this will use google-genai to communicate with Gemini 2.5 Flash Live.
"""

import logging
import json
from datetime import datetime, timezone

from .schemas import BatchPayload, GeminiRequest, GeminiResponse
from .coach_prompt import SYSTEM_PROMPT, build_coaching_prompt

logger = logging.getLogger("ekusasaizu.gemini")


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
    )

    return GeminiRequest(
        session_id=payload.session_id,
        exercise=payload.exercise,
        prompt=prompt,
        pose_summary=summarize_pose_frames(payload),
        audio_duration_seconds=None,  # TODO: calculate from audio chunk
        rep_count=payload.workout_status.rep_count,
        form_events=payload.form_events,
    )


async def send_to_gemini(request: GeminiRequest) -> GeminiResponse:
    """Send data to Gemini for coaching response.

    Currently LOGGING ONLY — does not hit the Gemini API.
    When ready, this will use the google-genai SDK with Gemini 2.5 Flash Live.

    Example future implementation:
        from google import genai
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[SYSTEM_PROMPT, request.prompt],
        )
        return GeminiResponse(
            session_id=request.session_id,
            coaching_text=response.text,
        )
    """
    logger.info(
        "GEMINI REQUEST [%s] exercise=%s reps=%d\n"
        "  prompt: %s\n"
        "  pose_summary: %s\n"
        "  form_events: %s",
        request.session_id,
        request.exercise,
        request.rep_count,
        request.prompt,
        json.dumps(request.pose_summary),
        json.dumps([e.model_dump() for e in request.form_events]),
    )

    # Mock response for now
    mock_text = _generate_mock_coaching(request)

    response = GeminiResponse(
        session_id=request.session_id,
        coaching_text=mock_text,
    )

    logger.info(
        "GEMINI RESPONSE [%s] → %s",
        request.session_id,
        response.coaching_text,
    )

    return response


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
