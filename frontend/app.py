"""
Ekusasaizu — Real-time pose detection via browser webcam (WebRTC).

Visit the site, activate your camera, and see pose skeleton overlay in real-time.
The camera is accessed through the browser (works on phones), and frames are
processed server-side using the same MediaPipe pipeline from tmp-streamlit with
the detect-with-fallback strategy (brightness enhancement → upscale).
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import av
import cv2
import numpy as np
import streamlit as st
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import pose_landmarker
import mediapipe as mp
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

APP_NAME = "エクササイズ — Ekusasaizu"
MODELS_DIR = Path("models")

POSE_MODEL_URLS = {
    0: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    1: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    2: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}

SKELETON_CONNECTIONS = pose_landmarker.PoseLandmarksConnections.POSE_LANDMARKS

# ---------------------------------------------------------------------------
# Model asset management
# ---------------------------------------------------------------------------


def ensure_pose_model(complexity: int = 2) -> Path:
    """Download the pose model if not present, return local path."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    complexity = complexity if complexity in (0, 1, 2) else 2
    url = POSE_MODEL_URLS[complexity]
    file_name = f"pose_landmarker_{complexity}.task"
    model_path = MODELS_DIR / file_name
    if not model_path.exists():
        from urllib.request import Request, urlopen

        request = Request(url, headers={"User-Agent": "Ekusasaizu/1.0"})
        with urlopen(request, timeout=120) as response:
            model_path.write_bytes(response.read())
    return model_path


# ---------------------------------------------------------------------------
# Pose processor — exact copy of tmp-streamlit pipeline
# ---------------------------------------------------------------------------


class PoseProcessor:
    """MediaPipe PoseLandmarker with brightness/upscale fallback."""

    def __init__(
        self,
        model_complexity: int = 2,
        num_poses: int = 2,
        detection_confidence: float = 0.5,
        tracking_confidence: float = 0.5,
    ):
        model_path = ensure_pose_model(model_complexity)
        base_options = mp_python.BaseOptions(model_asset_path=str(model_path))

        self._landmarker_image = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=base_options,
                running_mode=vision.RunningMode.IMAGE,
                num_poses=num_poses,
                min_pose_detection_confidence=detection_confidence,
                min_pose_presence_confidence=detection_confidence,
                min_tracking_confidence=tracking_confidence,
                output_segmentation_masks=False,
            )
        )
        self._landmarker_video = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=base_options,
                running_mode=vision.RunningMode.VIDEO,
                num_poses=num_poses,
                min_pose_detection_confidence=detection_confidence,
                min_pose_presence_confidence=detection_confidence,
                min_tracking_confidence=tracking_confidence,
                output_segmentation_masks=False,
            )
        )
        self._frame_count = 0
        self._start_ts = int(time.time() * 1000)

    def detect(self, frame_bgr: np.ndarray) -> list:
        """Detect pose with fallback: base → enhanced brightness → upscale."""
        self._frame_count += 1
        timestamp_ms = int(time.time() * 1000) - self._start_ts
        if timestamp_ms <= 0:
            timestamp_ms = self._frame_count * 33

        result = self._landmarker_video.detect_for_video(
            self._to_mp_image(frame_bgr), timestamp_ms
        )
        if result.pose_landmarks:
            return result.pose_landmarks

        # Fallback 1: brightness enhancement
        enhanced = cv2.convertScaleAbs(frame_bgr, alpha=1.2, beta=10)
        result = self._landmarker_image.detect(self._to_mp_image(enhanced))
        if result.pose_landmarks:
            return result.pose_landmarks

        # Fallback 2: 1.5x upscale
        upscaled = cv2.resize(
            frame_bgr, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC
        )
        result = self._landmarker_image.detect(self._to_mp_image(upscaled))
        if result.pose_landmarks:
            return result.pose_landmarks

        return []

    def close(self):
        self._landmarker_image.close()
        self._landmarker_video.close()

    @staticmethod
    def _to_mp_image(frame_bgr: np.ndarray) -> mp.Image:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------


def draw_skeleton(
    frame_bgr: np.ndarray,
    pose_landmarks: list,
    point_color: tuple = (0, 200, 255),
    line_color: tuple = (0, 140, 255),
) -> np.ndarray:
    """Draw skeleton overlay on frame."""
    h, w = frame_bgr.shape[:2]

    for landmarks in pose_landmarks:
        for connection in SKELETON_CONNECTIONS:
            s, e = int(connection.start), int(connection.end)
            if s >= len(landmarks) or e >= len(landmarks):
                continue
            p1, p2 = landmarks[s], landmarks[e]
            x1, y1 = int(p1.x * w), int(p1.y * h)
            x2, y2 = int(p2.x * w), int(p2.y * h)
            cv2.line(frame_bgr, (x1, y1), (x2, y2), line_color, 2, cv2.LINE_AA)

        for lmk in landmarks:
            x, y = int(lmk.x * w), int(lmk.y * h)
            vis = getattr(lmk, "visibility", 0)
            color = point_color if vis > 0.5 else (128, 128, 128)
            cv2.circle(frame_bgr, (x, y), 3, color, -1, cv2.LINE_AA)

    return frame_bgr


# ---------------------------------------------------------------------------
# WebRTC video processor
# ---------------------------------------------------------------------------


class PoseVideoProcessor(VideoProcessorBase):
    """Processes each video frame through the MediaPipe pipeline."""

    def __init__(self):
        self._processor: Optional[PoseProcessor] = None
        self.model_complexity = 2
        self.num_poses = 2
        self.detection_confidence = 0.5
        self.tracking_confidence = 0.5
        self.poses_detected = 0
        self.inference_ms = 0.0

    def _ensure_processor(self):
        if self._processor is None:
            self._processor = PoseProcessor(
                model_complexity=self.model_complexity,
                num_poses=self.num_poses,
                detection_confidence=self.detection_confidence,
                tracking_confidence=self.tracking_confidence,
            )

    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        self._ensure_processor()

        frame_bgr = frame.to_ndarray(format="bgr24")

        t0 = time.perf_counter()
        pose_landmarks = self._processor.detect(frame_bgr)
        self.inference_ms = (time.perf_counter() - t0) * 1000
        self.poses_detected = len(pose_landmarks)

        if pose_landmarks:
            frame_bgr = draw_skeleton(frame_bgr, pose_landmarks)

        return av.VideoFrame.from_ndarray(frame_bgr, format="bgr24")


# ---------------------------------------------------------------------------
# Streamlit app
# ---------------------------------------------------------------------------

st.set_page_config(page_title=APP_NAME, layout="wide")

# Minimal header
st.markdown(
    f"<h1 style='text-align:center; font-weight:200; letter-spacing:0.15em;'>{APP_NAME}</h1>",
    unsafe_allow_html=True,
)
st.markdown(
    "<p style='text-align:center; color:#888; font-size:0.9rem;'>"
    "Real-time AI exercise coaching — activate your camera to begin"
    "</p>",
    unsafe_allow_html=True,
)

# Sidebar controls
with st.sidebar:
    st.header("Settings")
    model_complexity = st.selectbox(
        "Model",
        [0, 1, 2],
        index=2,
        format_func=lambda x: ["Lite", "Full", "Heavy"][x],
    )
    num_poses = st.slider("Max Poses", 1, 5, 2)
    detection_confidence = st.slider("Detection Confidence", 0.0, 1.0, 0.5, 0.05)
    tracking_confidence = st.slider("Tracking Confidence", 0.0, 1.0, 0.5, 0.05)


# WebRTC streamer — browser provides the camera feed
ctx = webrtc_streamer(
    key="pose-detection",
    mode=WebRtcMode.SENDRECV,
    video_processor_factory=PoseVideoProcessor,
    media_stream_constraints={"video": True, "audio": False},
    async_processing=True,
)

# Push settings to the processor when they change
if ctx.video_processor:
    ctx.video_processor.model_complexity = model_complexity
    ctx.video_processor.num_poses = num_poses
    ctx.video_processor.detection_confidence = detection_confidence
    ctx.video_processor.tracking_confidence = tracking_confidence

# Stats display
if ctx.state.playing and ctx.video_processor:
    stats_cols = st.columns(2)
    stats_cols[0].metric("Poses Detected", ctx.video_processor.poses_detected)
    stats_cols[1].metric("Inference", f"{ctx.video_processor.inference_ms:.0f} ms")
