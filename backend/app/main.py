"""Ekusasaizu backend — FastAPI server for live AI exercise coaching."""

import logging

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .live_session import websocket_session_handler
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


# --- WebSocket endpoint ---


@app.websocket("/ws/session")
async def ws_session(websocket: WebSocket):
    """WebSocket endpoint for real-time coaching sessions with Gemini Live.

    Protocol:
    → { type: "start", config: SessionConfig }
    ← { type: "session_started", session_id, config, gemini_connected }

    → { type: "chat", text: string }
    ← { type: "transcript", role: "user"|"agent", text }

    → { type: "audio_chunk", pcm16_b64, sample_rate_hz: 16000 }
    ← { type: "audio_chunk", pcm16_b64, sample_rate_hz: 24000, channels: 1 }

    → { type: "batch", payload: BatchPayload }
    ← { type: "batch_ack", batch_number }

    → { type: "end" }
    ← { type: "session_ended", summary }
    """
    await websocket_session_handler(websocket)
