import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';

interface CameraSession {
  videoRef: RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  error: string | null;
  hasPermission: boolean | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useCameraSession(facingMode: 'user' | 'environment' = 'user'): CameraSession {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setHasPermission(true);
    } catch (err: unknown) {
      const e = err as DOMException;
      const msg = e.name === 'NotAllowedError' ? 'Camera permission denied' : e.name === 'NotFoundError' ? 'No camera found' : `Camera error: ${e.message}`;
      setError(msg);
      if (e.name === 'NotAllowedError') setHasPermission(false);
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return { videoRef, isActive, error, hasPermission, start, stop };
}
