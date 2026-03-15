"""WebSocket-based live coaching session manager.

Uses the Gemini Live API for bidirectional audio/text streaming.
"""

import asyncio
import base64
import logging
import json
import os
import time
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

from .schemas import BatchPayload, SessionConfig, SessionStartResponse
from .gemini_live import GeminiLiveSession
from .coach_prompt import get_system_prompt, build_coaching_prompt

logger = logging.getLogger("ekusasaizu.session")


def _get_api_key(config: SessionConfig) -> str | None:
    """Resolve API key from session config or environment."""
    return (config.gemini_api_key or "").strip() or os.environ.get("GEMINI_API_KEY")


async def websocket_session_handler(websocket: WebSocket):
    """Handle a WebSocket connection for a live coaching session.

    Protocol:
    → { type: "start", config: SessionConfig }
    ← { type: "session_started", session_id }

    → { type: "chat", text: string }
    ← { type: "transcript", role: "user"|"agent", text }
    ← { type: "audio_chunk", pcm16_b64, sample_rate_hz: 24000 }

    → { type: "audio_chunk", pcm16_b64, sample_rate_hz: 16000 }

    → { type: "batch", payload: BatchPayload }
    ← { type: "batch_ack", batch_number }

    → { type: "end" }
    ← { type: "session_ended", summary }
    """
    await websocket.accept()

    session_id: str | None = None
    gemini: GeminiLiveSession | None = None
    started_at: float = 0
    batch_count: int = 0
    total_reps: int = 0
    exercise: str = ""
    send_lock = asyncio.Lock()
    agent_speaking: bool = False

    async def ws_send(data: dict):
        async with send_lock:
            await websocket.send_json(data)

    async def on_gemini_text(text: str):
        """Gemini produced text — forward to client."""
        await ws_send({"type": "transcript", "role": "agent", "text": text})

    async def on_gemini_audio(audio_bytes: bytes):
        """Gemini produced audio — forward to client as base64 PCM."""
        nonlocal agent_speaking
        agent_speaking = True
        b64 = base64.b64encode(audio_bytes).decode("ascii")
        await ws_send(
            {
                "type": "audio_chunk",
                "pcm16_b64": b64,
                "sample_rate_hz": 24000,
                "channels": 1,
            }
        )

    async def on_gemini_error(message: str):
        """Gemini reported an error."""
        logger.error("Gemini error [%s]: %s", session_id, message)
        await ws_send({"type": "error", "message": message})

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "start":
                config = SessionConfig(**data.get("config", {}))
                exercise = config.exercise
                session_id = str(uuid4())
                started_at = time.time()
                batch_count = 0
                total_reps = 0

                api_key = _get_api_key(config)

                if api_key:
                    system_prompt = get_system_prompt()
                    gemini = GeminiLiveSession(
                        api_key=api_key,
                        system_instruction=system_prompt,
                        on_text=on_gemini_text,
                        on_audio=on_gemini_audio,
                        on_error=on_gemini_error,
                    )
                    try:
                        await gemini.connect()
                        logger.info(
                            "SESSION STARTED [%s] exercise=%s with Gemini Live",
                            session_id,
                            exercise,
                        )
                    except Exception as exc:
                        logger.error(
                            "Gemini Live connect failed: %s — running without AI", exc
                        )
                        await ws_send(
                            {
                                "type": "error",
                                "message": f"Gemini connect failed: {exc}",
                            }
                        )
                        gemini = None
                else:
                    logger.info(
                        "SESSION STARTED [%s] exercise=%s (no API key)",
                        session_id,
                        exercise,
                    )

                await ws_send(
                    {
                        "type": "session_started",
                        "session_id": session_id,
                        "config": config.model_dump(),
                        "gemini_connected": gemini is not None,
                    }
                )

            elif msg_type == "chat":
                text = data.get("text", "").strip()
                if not text or not session_id:
                    continue

                # Forward user text to Gemini Live
                if gemini:
                    await gemini.send_text(text)
                    # Echo user text back as transcript
                    await ws_send({"type": "transcript", "role": "user", "text": text})
                else:
                    # No Gemini — echo back a message
                    await ws_send({"type": "transcript", "role": "user", "text": text})
                    await ws_send(
                        {
                            "type": "transcript",
                            "role": "agent",
                            "text": "AI coaching requires a Gemini API key. Add one in Settings.",
                        }
                    )

            elif msg_type == "audio_chunk":
                if not session_id or not gemini:
                    logger.debug(
                        "audio_chunk dropped: session=%s gemini=%s",
                        session_id,
                        gemini is not None,
                    )
                    continue

                pcm16_b64 = data.get("pcm16_b64", "")
                if pcm16_b64:
                    pcm_bytes = base64.b64decode(pcm16_b64)
                    sample_rate = data.get("sample_rate_hz", 16000)

                    logger.debug(
                        "Forwarding audio chunk to Gemini: %d bytes, rate=%d",
                        len(pcm_bytes),
                        sample_rate,
                    )
                    await gemini.send_audio(
                        pcm_bytes,
                        mime_type=f"audio/pcm;rate={sample_rate}",
                    )

            elif msg_type == "batch":
                if not session_id:
                    continue

                payload = BatchPayload(**data.get("payload", {}))
                payload.session_id = session_id
                batch_count += 1
                total_reps = max(total_reps, payload.workout_status.rep_count)

                # Send workout context to Gemini as grounding
                if gemini and (payload.form_events or payload.angle_values):
                    context = build_coaching_prompt(
                        exercise=payload.exercise,
                        rep_count=payload.workout_status.rep_count,
                        form_events=[e.model_dump() for e in payload.form_events],
                        form_issues=payload.workout_status.form_issues,
                        current_score=payload.workout_status.current_score,
                        hold_duration=payload.workout_status.hold_duration,
                        angle_values=payload.angle_values,
                    )
                    await gemini.send_grounding_context(
                        {
                            "exercise": payload.exercise,
                            "context": context,
                        }
                    )

                await ws_send({"type": "batch_ack", "batch_number": batch_count})

            elif msg_type == "end":
                if gemini:
                    await gemini.close()
                    gemini = None

                duration = time.time() - started_at if started_at else 0
                summary = {
                    "session_id": session_id,
                    "exercise": exercise,
                    "duration_seconds": round(duration, 1),
                    "total_batches": batch_count,
                    "total_reps": total_reps,
                }
                await ws_send({"type": "session_ended", "summary": summary})

                logger.info(
                    "SESSION ENDED [%s] duration=%.1fs batches=%d reps=%d",
                    session_id,
                    duration,
                    batch_count,
                    total_reps,
                )
                session_id = None

            elif msg_type == "ping":
                await ws_send({"type": "pong"})

    except WebSocketDisconnect:
        if gemini:
            await gemini.close()
        logger.info("WebSocket disconnected [%s]", session_id or "no-session")
    except Exception:
        logger.exception("WebSocket error [%s]", session_id or "no-session")
        if gemini:
            await gemini.close()
