/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let poseLandmarker: PoseLandmarker | null = null;

async function init() {
  try {
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    self.postMessage({ type: 'ready' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', error: msg });
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, frame, timestamp } = e.data;

  if (type === 'init') {
    await init();
  } else if (type === 'detect') {
    if (!poseLandmarker || !frame) return;
    try {
      const result = poseLandmarker.detectForVideo(frame, timestamp);
      frame.close();
      self.postMessage({
        type: 'result',
        landmarks: result.landmarks,
        worldLandmarks: result.worldLandmarks,
        timestamp,
      });
    } catch (err: unknown) {
      frame.close();
      const msg = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', error: msg });
    }
  } else if (type === 'destroy') {
    if (poseLandmarker) {
      poseLandmarker.close();
      poseLandmarker = null;
    }
  }
};
