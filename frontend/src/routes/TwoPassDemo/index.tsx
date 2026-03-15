import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { DashboardLayout } from '@component/DashboardLayout.jsx';
import type { NormalizedLandmark } from '../../lib/types';
import { SKELETON_CONNECTIONS } from '../../lib/landmarks';
import { FilesetResolver, PoseLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

type PoseModelType = 'mediapipe' | 'movenet';

// MoveNet uses 17 COCO keypoints – skeleton connections by index
const MOVENET_SKELETON: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4], // face
  [5, 6],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10], // arms
  [5, 11],
  [6, 12],
  [11, 12], // torso
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16], // legs
];

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FrameResult {
  time: number;
  bbox: BBox | null;
  landmarks: NormalizedLandmark[] | null;
}

type CropMode = 'none' | 'auto' | 'manual';

/** Apply histogram equalization to a canvas (in-place) for better detection in dim environments */
function equalizeHistogram(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Build luminance histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[lum]++;
  }

  // Cumulative distribution
  const cdf = new Uint32Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];

  const cdfMin = cdf.find(v => v > 0) ?? 0;
  const total = w * h;
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(((cdf[i] - cdfMin) / (total - cdfMin)) * 255);
  }

  // Apply per-channel scaling based on luminance shift
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const scale = lum > 0 ? lut[lum] / lum : 1;
    data[i] = Math.min(255, Math.round(data[i] * scale));
    data[i + 1] = Math.min(255, Math.round(data[i + 1] * scale));
    data[i + 2] = Math.min(255, Math.round(data[i + 2] * scale));
  }

  ctx.putImageData(imageData, 0, 0);
}

export function TwoPassDemo() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ w: 640, h: 480 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processPercent, setProcessPercent] = useState(10);
  const [frames, setFrames] = useState<FrameResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [bboxPadding, setBboxPadding] = useState(0.15);
  const [cropMode, setCropMode] = useState<CropMode>('none'); // none = full frame, auto = object detector, manual = user ROI
  const [manualRoi, setManualRoi] = useState<BBox | null>(null);
  const [isDrawingRoi, setIsDrawingRoi] = useState(false);
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null);
  const [useHistEq, setUseHistEq] = useState(false);
  const [poseModel, setPoseModel] = useState<PoseModelType>('mediapipe');
  const [activeModel, setActiveModel] = useState<PoseModelType | null>(null);

  const [detectorReady, setDetectorReady] = useState(false);
  const [poseReady, setPoseReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const movenetRef = useRef<poseDetection.PoseDetector | null>(null);

  // Convert mouse coords on the video container to video pixel coords
  const toVideoCoords = useCallback(
    (e: MouseEvent) => {
      const container = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const { w: vw, h: vh } = videoSize;
      // object-contain: figure out actual rendered video area
      const scale = Math.min(container.width / vw, container.height / vh);
      const rw = vw * scale;
      const rh = vh * scale;
      const ox = (container.width - rw) / 2;
      const oy = (container.height - rh) / 2;
      const x = ((e.clientX - container.left - ox) / rw) * vw;
      const y = ((e.clientY - container.top - oy) / rh) * vh;
      return { x: Math.max(0, Math.min(vw, x)), y: Math.max(0, Math.min(vh, y)) };
    },
    [videoSize],
  );

  const handleRoiMouseDown = useCallback(
    (e: MouseEvent) => {
      if (cropMode !== 'manual' || isProcessing) return;
      const p = toVideoCoords(e);
      setRoiStart(p);
      setIsDrawingRoi(true);
    },
    [cropMode, isProcessing, toVideoCoords],
  );

  const handleRoiMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDrawingRoi || !roiStart) return;
      const p = toVideoCoords(e);
      const x = Math.min(roiStart.x, p.x);
      const y = Math.min(roiStart.y, p.y);
      const w = Math.abs(p.x - roiStart.x);
      const h = Math.abs(p.y - roiStart.y);
      setManualRoi({ x, y, w, h });
    },
    [isDrawingRoi, roiStart, toVideoCoords],
  );

  const handleRoiMouseUp = useCallback(() => {
    setIsDrawingRoi(false);
    setRoiStart(null);
  }, []);

  // Draw the manual ROI overlay
  useEffect(() => {
    const canvas = roiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = videoSize.w;
    canvas.height = videoSize.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (cropMode === 'manual' && manualRoi) {
      // Dim area outside ROI
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(manualRoi.x, manualRoi.y, manualRoi.w, manualRoi.h);
      // Draw ROI border
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(manualRoi.x, manualRoi.y, manualRoi.w, manualRoi.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.font = '12px monospace';
      ctx.fillText(`ROI ${Math.round(manualRoi.w)}×${Math.round(manualRoi.h)}`, manualRoi.x, manualRoi.y - 4);
    }
  }, [manualRoi, cropMode, videoSize]);

  // Init models based on selected poseModel
  const initModels = useCallback(async () => {
    setModelsLoading(true);
    setModelError(null);
    // Clean up previous models
    detectorRef.current?.close();
    landmarkerRef.current?.close();
    if (movenetRef.current) {
      movenetRef.current.dispose();
      movenetRef.current = null;
    }
    setDetectorReady(false);
    setPoseReady(false);
    setActiveModel(null);

    try {
      // Always load Object Detector for first pass
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');

      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/latest/efficientdet_lite0.tflite',
        },
        runningMode: 'IMAGE',
        maxResults: 5,
        scoreThreshold: 0.3,
        categoryAllowlist: ['person'],
      });
      detectorRef.current = detector;
      setDetectorReady(true);

      if (poseModel === 'mediapipe') {
        // MediaPipe PoseLandmarker (heavy)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
          },
          runningMode: 'IMAGE',
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
          outputSegmentationMasks: false,
        });
        landmarkerRef.current = landmarker;
      } else {
        // MoveNet Thunder via TF.js — ensure WebGL backend is ready
        await tf.setBackend('webgl');
        await tf.ready();
        const moveDetector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
        });
        movenetRef.current = moveDetector;
      }

      setPoseReady(true);
      setActiveModel(poseModel);
    } catch (err: unknown) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setModelsLoading(false);
    }
  }, [poseModel]);

  // Cleanup
  useEffect(
    () => () => {
      detectorRef.current?.close();
      landmarkerRef.current?.close();
      if (movenetRef.current) movenetRef.current.dispose();
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    },
    [],
  );

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setVideoSrc(URL.createObjectURL(file));
    setFrames([]);
    setCurrentIdx(0);
  };

  const handleVideoLoaded = () => {
    const v = videoRef.current;
    if (v) setVideoSize({ w: v.videoWidth || 640, h: v.videoHeight || 480 });
  };

  // Processing
  const processVideo = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    const landmarker = landmarkerRef.current;
    const movenet = movenetRef.current;
    const isMoveNet = activeModel === 'movenet';

    if (!video) return;
    if (isMoveNet && !movenet) return;
    if (!isMoveNet && !landmarker) return;
    if (cropMode === 'auto' && !detector) return;

    setIsProcessing(true);
    setFrames([]);
    setCurrentIdx(0);

    await new Promise<void>(resolve => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    const duration = video.duration * (processPercent / 100);
    const fps = 10;
    const interval = 1 / fps;
    const totalFrames = Math.ceil(duration * fps);
    const results: FrameResult[] = [];

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Full-frame canvas
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = vw;
    fullCanvas.height = vh;
    const fullCtx = fullCanvas.getContext('2d')!;

    // Crop canvas
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d')!;

    // Helper: run pose on a canvas, return normalized landmarks (full-frame coords)
    const runPose = async (
      srcCanvas: HTMLCanvasElement,
      offsetX: number,
      offsetY: number,
      cropW: number,
      cropH: number,
    ): Promise<NormalizedLandmark[] | null> => {
      if (isMoveNet && movenet) {
        const poses = await movenet.estimatePoses(srcCanvas);
        if (poses[0]?.keypoints) {
          return poses[0].keypoints.map(kp => ({
            x: ((kp.x / srcCanvas.width) * cropW + offsetX) / vw,
            y: ((kp.y / srcCanvas.height) * cropH + offsetY) / vh,
            z: 0,
            visibility: kp.score ?? 0,
          }));
        }
      } else if (landmarker) {
        const poseResult = landmarker.detect(srcCanvas);
        if (poseResult.landmarks?.[0]) {
          return (poseResult.landmarks[0] as NormalizedLandmark[]).map(lm => ({
            x: (lm.x * cropW + offsetX) / vw,
            y: (lm.y * cropH + offsetY) / vh,
            z: lm.z,
            visibility: lm.visibility,
          }));
        }
      }
      return null;
    };

    for (let i = 0; i < totalFrames; i++) {
      const time = i * interval;
      video.currentTime = time;
      await new Promise<void>(r => video.addEventListener('seeked', () => r(), { once: true }));
      await new Promise<void>(r => setTimeout(r, 50));

      let bbox: BBox | null = null;
      let landmarks: NormalizedLandmark[] | null = null;

      if (video.readyState >= 2 && vw > 0) {
        fullCtx.drawImage(video, 0, 0, vw, vh);

        // Apply histogram equalization if enabled
        if (useHistEq) equalizeHistogram(fullCanvas, fullCtx);

        try {
          if (cropMode === 'manual' && manualRoi && manualRoi.w > 10 && manualRoi.h > 10) {
            // Manual ROI crop
            const roi = manualRoi;
            bbox = { x: roi.x, y: roi.y, w: roi.w, h: roi.h };
            cropCanvas.width = Math.round(roi.w);
            cropCanvas.height = Math.round(roi.h);
            cropCtx.drawImage(fullCanvas, roi.x, roi.y, roi.w, roi.h, 0, 0, cropCanvas.width, cropCanvas.height);
            landmarks = await runPose(cropCanvas, roi.x, roi.y, roi.w, roi.h);
          } else if (cropMode === 'auto' && detector) {
            // Auto: Object Detector first pass
            const detections = detector.detect(fullCanvas);
            const people = detections.detections.filter(d => d.categories.some(c => c.categoryName === 'person'));

            if (people.length > 0) {
              let bestArea = 0;
              let bestBbox: BBox | null = null;
              for (const p of people) {
                const bb = p.boundingBox;
                if (!bb) continue;
                const area = bb.width * bb.height;
                if (area > bestArea) {
                  bestArea = area;
                  bestBbox = { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height };
                }
              }

              if (bestBbox) {
                const padX = bestBbox.w * bboxPadding;
                const padY = bestBbox.h * bboxPadding;
                const cx = Math.max(0, bestBbox.x - padX);
                const cy = Math.max(0, bestBbox.y - padY);
                const cw = Math.min(vw - cx, bestBbox.w + 2 * padX);
                const ch = Math.min(vh - cy, bestBbox.h + 2 * padY);

                bbox = { x: cx, y: cy, w: cw, h: ch };
                cropCanvas.width = Math.round(cw);
                cropCanvas.height = Math.round(ch);
                cropCtx.drawImage(fullCanvas, cx, cy, cw, ch, 0, 0, cropCanvas.width, cropCanvas.height);
                landmarks = await runPose(cropCanvas, cx, cy, cw, ch);
              }
            }
          } else {
            // No crop — full frame
            landmarks = await runPose(fullCanvas, 0, 0, vw, vh);
          }
        } catch {
          // skip frame
        }
      }

      results.push({ time, bbox, landmarks });
      setProcessProgress(Math.round(((i + 1) / totalFrames) * 100));
    }

    setFrames(results);
    setCurrentIdx(0);
    video.currentTime = 0;
    setIsProcessing(false);
  }, [processPercent, bboxPadding, cropMode, manualRoi, useHistEq, activeModel]);

  const handleScrub = (e: Event) => {
    const idx = parseInt((e.target as HTMLInputElement).value, 10);
    setCurrentIdx(idx);
    const video = videoRef.current;
    if (video && frames[idx]) video.currentTime = frames[idx].time;
  };

  // Draw skeleton + bbox overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoSize.w;
    canvas.height = videoSize.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frame = frames[currentIdx];
    if (!frame) return;

    // Draw bounding box
    if (frame.bbox) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(frame.bbox.x, frame.bbox.y, frame.bbox.w, frame.bbox.h);
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.font = '12px monospace';
      ctx.fillText('Person (Pass 1)', frame.bbox.x, frame.bbox.y - 4);
    }

    // Draw skeleton
    if (frame.landmarks) {
      const lms = frame.landmarks;
      const W = canvas.width;
      const H = canvas.height;
      const connections = activeModel === 'movenet' ? MOVENET_SKELETON : SKELETON_CONNECTIONS;

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 3;
      for (const [a, b] of connections) {
        const la = lms[a];
        const lb = lms[b];
        if (!la || !lb) continue;
        ctx.beginPath();
        ctx.moveTo(la.x * W, la.y * H);
        ctx.lineTo(lb.x * W, lb.y * H);
        ctx.stroke();
      }

      for (const lm of lms) {
        if (!lm) continue;
        ctx.beginPath();
        ctx.arc(lm.x * W, lm.y * H, 4, 0, 2 * Math.PI);
        ctx.fillStyle = (lm.visibility ?? 0) > 0.5 ? 'rgba(245, 158, 11, 1)' : 'rgba(168, 162, 158, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [frames, currentIdx, videoSize, activeModel]);

  const currentFrame = frames[currentIdx] ?? null;
  const detectedCount = frames.filter(f => f.landmarks !== null).length;
  const bboxCount = frames.filter(f => f.bbox !== null).length;

  return (
    <DashboardLayout>
      <div class="p-6 h-full flex flex-col">
        <div class="mb-4">
          <h1 class="text-lg font-normal text-stone-200">Two-Pass Detection Demo</h1>
          <p class="text-stone-500 text-sm font-light mt-1">
            Compare models (MediaPipe Heavy vs MoveNet Thunder) and crop modes (full frame, manual ROI, auto detect). Enable Histogram EQ for dim environments.
          </p>
        </div>

        {/* Controls */}
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <label class="px-4 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm cursor-pointer hover:border-stone-600">
            Choose Video
            <input type="file" accept="video/*" onChange={handleFileSelect} class="hidden" />
          </label>

          <select
            value={poseModel}
            onChange={e => setPoseModel((e.target as HTMLSelectElement).value as PoseModelType)}
            disabled={modelsLoading || isProcessing}
            class="px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm"
          >
            <option value="mediapipe">MediaPipe Heavy (33 pts)</option>
            <option value="movenet">MoveNet Thunder (17 pts)</option>
          </select>

          {(!poseReady || activeModel !== poseModel) && (
            <button
              onClick={initModels}
              disabled={modelsLoading}
              class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {modelsLoading ? 'Loading Models…' : `Load ${poseModel === 'movenet' ? 'MoveNet Thunder' : 'MediaPipe Heavy'}`}
            </button>
          )}
          {poseReady && activeModel === poseModel && (
            <span class="px-3 py-1.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">
              ● {activeModel === 'movenet' ? 'MoveNet Thunder' : 'MediaPipe Heavy'} Ready
            </span>
          )}
          {modelError && <span class="text-red-400 text-xs">{modelError}</span>}

          {videoSrc && poseReady && activeModel === poseModel && (
            <>
              <select
                value={cropMode}
                onChange={e => setCropMode((e.target as HTMLSelectElement).value as CropMode)}
                disabled={isProcessing}
                class="px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm"
              >
                <option value="none">No Crop (Full Frame)</option>
                <option value="manual">Manual ROI (Draw Box)</option>
                <option value="auto">Auto Detect (Object Detector)</option>
              </select>
              {cropMode === 'manual' && (
                <span class="text-xs text-emerald-400">
                  {manualRoi ? `ROI: ${Math.round(manualRoi.w)}×${Math.round(manualRoi.h)}` : 'Click & drag on video'}
                </span>
              )}
              <label class="flex items-center gap-2 text-xs text-stone-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useHistEq}
                  onChange={e => setUseHistEq((e.target as HTMLInputElement).checked)}
                  class="accent-amber-500"
                />
                Histogram EQ
              </label>
              <div class="flex items-center gap-2">
                <label class="text-xs text-stone-400">Duration</label>
                <input
                  type="range" min="5" max="100" step="5" value={processPercent}
                  onInput={e => setProcessPercent(parseInt((e.target as HTMLInputElement).value, 10))}
                  class="w-20 accent-amber-500"
                />
                <span class="text-xs text-stone-300 w-8">{processPercent}%</span>
              </div>
              {cropMode === 'auto' && (
                <div class="flex items-center gap-2">
                  <label class="text-xs text-stone-400">Padding</label>
                  <input
                    type="range" min="0" max="50" step="5" value={bboxPadding * 100}
                    onInput={e => setBboxPadding(parseInt((e.target as HTMLInputElement).value, 10) / 100)}
                    class="w-20 accent-amber-500"
                  />
                  <span class="text-xs text-stone-300 w-8">{Math.round(bboxPadding * 100)}%</span>
                </div>
              )}
              <button
                onClick={processVideo}
                disabled={isProcessing || (cropMode === 'auto' && !detectorReady) || (cropMode === 'manual' && !manualRoi)}
                class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isProcessing ? `Processing… ${processProgress}%` : `Process (${processPercent}%)`}
              </button>
            </>
          )}
        </div>

        {/* Main */}
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          <div class="lg:col-span-2 flex flex-col gap-3">
            <div
              class={`flex-1 bg-stone-900 border border-stone-800 rounded-lg overflow-hidden relative min-h-80 ${cropMode === 'manual' ? 'cursor-crosshair' : ''}`}
              onMouseDown={handleRoiMouseDown}
              onMouseMove={handleRoiMouseMove}
              onMouseUp={handleRoiMouseUp}
              onMouseLeave={handleRoiMouseUp}
            >
              {videoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={handleVideoLoaded}
                    class="absolute inset-0 w-full h-full object-contain bg-black"
                    preload="auto"
                    muted
                  />
                  <canvas ref={canvasRef} class="absolute inset-0 pointer-events-none object-contain" style={{ width: '100%', height: '100%' }} />
                  <canvas ref={roiCanvasRef} class="absolute inset-0 pointer-events-none object-contain" style={{ width: '100%', height: '100%' }} />
                </>
              ) : (
                <div class="absolute inset-0 flex items-center justify-center">
                  <p class="text-stone-500">Load a video to start</p>
                </div>
              )}
            </div>

            {frames.length > 0 && (
              <div class="flex items-center gap-3">
                <span class="text-xs text-stone-500 w-16 text-right">Frame {currentIdx + 1}</span>
                <input type="range" min="0" max={frames.length - 1} value={currentIdx} onInput={handleScrub} class="flex-1 accent-amber-500" />
                <span class="text-xs text-stone-500 w-16">{frames.length} total</span>
              </div>
            )}

            {currentFrame && (
              <div class="flex items-center gap-4 text-xs text-stone-500">
                <span>Time: {currentFrame.time.toFixed(2)}s</span>
                <span>Person: {currentFrame.bbox ? '✓' : '✗'}</span>
                <span>Pose: {currentFrame.landmarks ? '✓' : '✗'}</span>
                {isProcessing && (
                  <div class="flex-1 h-1 bg-stone-800 overflow-hidden">
                    <div class="h-full bg-amber-500 transition-all" style={{ width: `${processProgress}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Panel */}
          <div class="flex flex-col gap-3 overflow-y-auto">
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Detection Stats</h3>
              {frames.length > 0 ? (
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Total Frames</span>
                    <span class="text-sm font-mono text-amber-400">{frames.length}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Person Detected (Pass 1)</span>
                    <span class="text-sm font-mono text-blue-400">{bboxCount}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Pose Detected (Pass 2)</span>
                    <span class="text-sm font-mono text-emerald-400">{detectedCount}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Pass 1 Rate</span>
                    <span class="text-sm font-mono text-blue-400">{((bboxCount / frames.length) * 100).toFixed(1)}%</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Pass 2 Rate</span>
                    <span class="text-sm font-mono text-emerald-400">{((detectedCount / frames.length) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ) : (
                <p class="text-xs text-stone-600">Process a video first</p>
              )}
            </div>

            {/* Bbox info */}
            {currentFrame?.bbox && (
              <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
                <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Bounding Box</h3>
                <div class="space-y-1 text-xs font-mono text-stone-300">
                  <div>
                    x: {currentFrame.bbox.x.toFixed(0)} y: {currentFrame.bbox.y.toFixed(0)}
                  </div>
                  <div>
                    w: {currentFrame.bbox.w.toFixed(0)} h: {currentFrame.bbox.h.toFixed(0)}
                  </div>
                  <div class="text-stone-500">padding: {Math.round(bboxPadding * 100)}%</div>
                </div>
              </div>
            )}

            {/* Landmarks */}
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Landmarks</h3>
              {currentFrame?.landmarks ? (
                <div class="space-y-1 max-h-60 overflow-y-auto text-[11px] font-mono">
                  {currentFrame.landmarks.map((lm, i) => (
                    <div class={`flex gap-2 ${(lm.visibility ?? 0) > 0.5 ? 'text-stone-300' : 'text-stone-600'}`}>
                      <span class="w-6 text-right text-stone-500">{i}</span>
                      <span>
                        x:{lm.x.toFixed(3)} y:{lm.y.toFixed(3)}
                      </span>
                      <span class={(lm.visibility ?? 0) > 0.5 ? 'text-emerald-400' : 'text-red-400'}>v:{(lm.visibility ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p class="text-xs text-stone-600">{currentFrame ? 'No pose detected' : 'No frame'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
