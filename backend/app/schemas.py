from pydantic import BaseModel


class Landmark(BaseModel):
    x: float
    y: float
    z: float
    visibility: float = 0.0


class PoseFrame(BaseModel):
    """A single frame of pose landmark data."""

    timestamp: float
    landmarks: list[Landmark]


class FormEvent(BaseModel):
    """An exercise form event detected by the client."""

    type: str  # e.g. rep_completed, hips_dropping, good_form
    score: float | None = None
    duration: float | None = None
    message: str | None = None


class WorkoutStatus(BaseModel):
    """Current workout state sent from the client."""

    exercise: str
    rep_count: int = 0
    current_phase: str = "idle"
    current_score: float = 0.0
    hold_duration: float = 0.0
    is_body_visible: bool = False
    form_issues: list[str] = []


class BatchPayload(BaseModel):
    """Batched data sent at configured intervals from frontend to backend."""

    session_id: str
    exercise: str
    timestamp: float
    pose_frames: list[PoseFrame] = []
    form_events: list[FormEvent] = []
    workout_status: WorkoutStatus
    audio_chunk_b64: str | None = None  # base64-encoded audio chunk
    angle_values: dict[str, float] = {}  # Current angle debug values from analyzer


class SessionConfig(BaseModel):
    """Configuration for a live coaching session."""

    exercise: str
    batch_interval_ms: int = 3000  # How often to batch-send data (ms)
    audio_enabled: bool = False
    target_reps: int | None = None
    target_hold_seconds: int | None = None
    gemini_api_key: str | None = None  # User-provided API key (optional)


class SessionStartResponse(BaseModel):
    session_id: str
    config: SessionConfig


class GeminiRequest(BaseModel):
    """Structured request to be sent to Gemini (logged only for now)."""

    session_id: str
    exercise: str
    prompt: str
    pose_summary: dict
    audio_duration_seconds: float | None = None
    audio_transcript: str | None = None
    rep_count: int = 0
    form_events: list[FormEvent] = []
    angle_values: dict[str, float] = {}


class GeminiResponse(BaseModel):
    """Structured response from Gemini (mock for now)."""

    session_id: str
    coaching_text: str
    suggestions: list[str] = []
    score_adjustment: float | None = None
