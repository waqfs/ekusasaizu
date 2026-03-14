import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { NormalizedLandmark } from './types';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

interface PoseStreamState {
  landmarks: NormalizedLandmark[] | null;
  worldLandmarks: NormalizedLandmark[] | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  fps: number;
}

export function usePoseStream(videoRef: RefObject<HTMLVideoElement | null>) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const [state, setState] = useState<PoseStreamState>({
    landmarks: null,
    worldLandmarks: null,
    isReady: false,
    isLoading: false,
    error: null,
    fps: 0,
  });

  const initWorker = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      landmarkerRef.current = landmarker;
      setState(s => ({ ...s, isReady: true, isLoading: false }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, error: msg, isLoading: false }));
    }

    // FPS counter
    fpsIntervalRef.current = setInterval(() => {
      setState(s => ({ ...s, fps: frameCountRef.current }));
      frameCountRef.current = 0;
    }, 1000);
  }, []);

  const startDetection = useCallback(() => {
    if (!landmarkerRef.current || !videoRef.current) return;

    const landmarker = landmarkerRef.current;
    const video = videoRef.current;

    const detect = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const now = performance.now();
        if (now - lastTimestampRef.current >= 33) {
          try {
            const result = landmarker.detectForVideo(video, now);
            frameCountRef.current++;
            setState(s => ({
              ...s,
              landmarks: result.landmarks?.[0] ?? null,
              worldLandmarks: result.worldLandmarks?.[0] ?? null,
            }));
          } catch {
            // Video frame not ready
          }
          lastTimestampRef.current = now;
        }
      }
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  const stopDetection = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const destroy = useCallback(() => {
    stopDetection();
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    if (landmarkerRef.current) {
      landmarkerRef.current.close();
      landmarkerRef.current = null;
    }
    setState({
      landmarks: null,
      worldLandmarks: null,
      isReady: false,
      isLoading: false,
      error: null,
      fps: 0,
    });
  }, [stopDetection]);

  useEffect(() => () => destroy(), []);

  return {
    ...state,
    initWorker,
    startDetection,
    stopDetection,
    destroy,
  };
}
