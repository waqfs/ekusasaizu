import { useRef, useEffect } from 'preact/hooks';
import type { NormalizedLandmark } from '../lib/types';
import { SKELETON_CONNECTIONS } from '../lib/landmarks';

interface PoseOverlayProps {
  landmarks: NormalizedLandmark[] | null;
  width: number;
  height: number;
  mirrored?: boolean;
  contain?: boolean;
}

export function PoseOverlay({ landmarks, width, height, mirrored = true, contain = false }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    const toX = (x: number) => (mirrored ? (1 - x) * width : x * width);
    const toY = (y: number) => y * height;

    // Draw skeleton connections
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.lineWidth = 2;
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;
      if ((la.visibility ?? 0) < 0.1 || (lb.visibility ?? 0) < 0.1) continue;
      ctx.beginPath();
      ctx.moveTo(toX(la.x), toY(la.y));
      ctx.lineTo(toX(lb.x), toY(lb.y));
      ctx.stroke();
    }

    // Draw joint points
    for (const lm of landmarks) {
      if (!lm || (lm.visibility ?? 0) < 0.1) continue;
      ctx.beginPath();
      ctx.arc(toX(lm.x), toY(lm.y), 3, 0, 2 * Math.PI);
      ctx.fillStyle = (lm.visibility ?? 0) > 0.7 ? 'rgba(245, 158, 11, 0.9)' : 'rgba(168, 162, 158, 0.6)';
      ctx.fill();
    }
  }, [landmarks, width, height, mirrored, contain]);

  const fitStyle = contain ? 'object-contain' : 'object-cover';

  return <canvas ref={canvasRef} class={`absolute inset-0 pointer-events-none ${fitStyle}`} style={{ width: '100%', height: '100%' }} />;
}
