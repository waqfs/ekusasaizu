"""WebSocket-based live coaching session manager."""

import logging
import json
import time
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

from .schemas import BatchPayload, SessionConfig, SessionStartResponse
from .gemini import build_gemini_request, send_to_gemini

logger = logging.getLogger("ekusasaizu.session")


class LiveSession:
    """Manages a single live coaching session over WebSocket."""

    def __init__(self, session_id: str, config: SessionConfig):
        self.session_id = session_id
        self.config = config
        self.started_at = time.time()
        self.batch_count = 0
        self.total_reps = 0

    async def handle_batch(self, payload: BatchPayload) -> dict:
        """Process a batch of data from the frontend."""
        self.batch_count += 1
        self.total_reps = max(self.total_reps, payload.workout_status.rep_count)

        logger.info(
            "BATCH [%s] #%d | exercise=%s reps=%d score=%.0f "
            "pose_frames=%d form_events=%d audio=%s",
            self.session_id,
            self.batch_count,
            payload.exercise,
            payload.workout_status.rep_count,
            payload.workout_status.current_score,
            len(payload.pose_frames),
            len(payload.form_events),
            "yes" if payload.audio_chunk_b64 else "no",
        )

        # Build and send to Gemini (currently just logging)
        gemini_request = build_gemini_request(payload)
        gemini_response = await send_to_gemini(gemini_request)

        return {
            "type": "coaching",
            "text": gemini_response.coaching_text,
            "suggestions": gemini_response.suggestions,
            "batch_number": self.batch_count,
        }


# Active sessions registry
_sessions: dict[str, LiveSession] = {}


def create_session(config: SessionConfig) -> SessionStartResponse:
    """Create a new live coaching session."""
    session_id = str(uuid4())
    session = LiveSession(session_id=session_id, config=config)
    _sessions[session_id] = session

    logger.info(
        "SESSION CREATED [%s] exercise=%s interval=%dms",
        session_id,
        config.exercise,
        config.batch_interval_ms,
    )

    return SessionStartResponse(session_id=session_id, config=config)


def get_session(session_id: str) -> LiveSession | None:
    return _sessions.get(session_id)


def end_session(session_id: str) -> dict | None:
    """End a session and return summary."""
    session = _sessions.pop(session_id, None)
    if not session:
        return None

    duration = time.time() - session.started_at
    summary = {
        "session_id": session_id,
        "exercise": session.config.exercise,
        "duration_seconds": round(duration, 1),
        "total_batches": session.batch_count,
        "total_reps": session.total_reps,
    }

    logger.info(
        "SESSION ENDED [%s] duration=%.1fs batches=%d reps=%d",
        session_id,
        duration,
        session.batch_count,
        session.total_reps,
    )

    return summary


async def websocket_session_handler(websocket: WebSocket):
    """Handle a WebSocket connection for a live coaching session."""
    await websocket.accept()
    session_id: str | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "start":
                config = SessionConfig(**data.get("config", {}))
                result = create_session(config)
                session_id = result.session_id
                await websocket.send_json(
                    {
                        "type": "session_started",
                        "session_id": result.session_id,
                        "config": result.config.model_dump(),
                    }
                )

            elif msg_type == "batch":
                if not session_id:
                    await websocket.send_json(
                        {"type": "error", "message": "No active session"}
                    )
                    continue

                session = get_session(session_id)
                if not session:
                    await websocket.send_json(
                        {"type": "error", "message": "Session not found"}
                    )
                    continue

                payload = BatchPayload(**data.get("payload", {}))
                payload.session_id = session_id
                response = await session.handle_batch(payload)
                await websocket.send_json(response)

            elif msg_type == "end":
                if session_id:
                    summary = end_session(session_id)
                    await websocket.send_json(
                        {"type": "session_ended", "summary": summary}
                    )
                    session_id = None

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        if session_id:
            end_session(session_id)
        logger.info("WebSocket disconnected [%s]", session_id or "no-session")
    except Exception:
        logger.exception("WebSocket error [%s]", session_id or "no-session")
        if session_id:
            end_session(session_id)
