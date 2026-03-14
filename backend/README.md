# Ekusasaizu Backend

FastAPI server for Ekusasaizu.

## Prerequisites

- Python 3.10+
- pip

## Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Run the Server

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The server starts at `http://localhost:8000`, and API docs are available at `http://localhost:8000/docs`.

## API Endpoints

| Method | Path                      | Description                      |
| ------ | ------------------------- | -------------------------------- |
| GET    | `/health`                 | Health check                     |
| POST   | `/api/session/start`      | Create a new coaching session    |
| POST   | `/api/session/{id}/batch` | Submit batch pose/audio data     |
| POST   | `/api/session/{id}/end`   | End session, get summary         |
| WS     | `/ws/session`             | WebSocket for real-time sessions |

## WebSocket Protocol

Connect to `/ws/session` and send JSON messages:

```
→ { "type": "start", "config": { "exercise": "squats", "batch_interval_ms": 3000 } }
← { "type": "session_started", "session_id": "...", "config": { ... } }

→ { "type": "batch", "payload": { "exercise": "squats", "pose_frames": [...], ... } }
← { "type": "coaching", "text": "...", "suggestions": [], "batch_number": 1 }

→ { "type": "end" }
← { "type": "session_ended", "summary": { ... } }
```
