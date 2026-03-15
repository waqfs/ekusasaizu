"""Ekusasaizu backend — FastAPI server for live AI exercise coaching."""

import logging

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .schemas import SessionConfig, SessionStartResponse, BatchPayload
from .live_session import (
    create_session,
    get_session,
    end_session,
    websocket_session_handler,
)
from .gemini import build_gemini_request, send_to_gemini
from .exercise_loader import list_exercises, get_exercise_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("ekusasaizu")

app = FastAPI(
    title="Ekusasaizu API",
    description="AI-powered exercise coaching backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- REST endpoints ---


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/exercises")
async def get_exercises():
    """List all available exercises with summary info."""
    return list_exercises()


@app.get("/api/exercises/{exercise_id}/config")
async def get_exercise(exercise_id: str):
    """Get the full MediaPipe configuration for an exercise."""
    config = get_exercise_config(exercise_id)
    if not config:
        return {"error": f"Exercise '{exercise_id}' not found"}
    return config


@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(config: SessionConfig):
    """Create a new coaching session and return its ID + config."""
    return create_session(config)


@app.post("/api/session/{session_id}/batch")
async def receive_batch(session_id: str, payload: BatchPayload):
    """Receive a batch of pose/audio/event data and return coaching response.

    This is the REST alternative to the WebSocket flow — useful for testing
    or clients that don't support WebSocket.
    """
    payload.session_id = session_id
    session = get_session(session_id)
    if not session:
        return {"error": "Session not found"}

    return await session.handle_batch(payload)


@app.post("/api/session/{session_id}/end")
async def stop_session(session_id: str):
    """End a session and return summary."""
    summary = end_session(session_id)
    if not summary:
        return {"error": "Session not found"}
    return summary


# --- WebSocket endpoint ---


@app.websocket("/ws/session")
async def ws_session(websocket: WebSocket):
    """WebSocket endpoint for real-time coaching sessions.

    Protocol:
    → { type: "start", config: SessionConfig }
    ← { type: "session_started", session_id, config }

    → { type: "batch", payload: BatchPayload }
    ← { type: "coaching", text, suggestions, batch_number }

    → { type: "end" }
    ← { type: "session_ended", summary }

    → { type: "ping" }
    ← { type: "pong" }
    """
    await websocket_session_handler(websocket)
