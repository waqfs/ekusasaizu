import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { DashboardLayout } from '@component/DashboardLayout.jsx';
import type { NormalizedLandmark } from '../../lib/types';
import { SKELETON_CONNECTIONS } from '../../lib/landmarks';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

interface FrameResult {
  time: number;
  landmarks: NormalizedLandmark[] | null;
}

export function RawDemo() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ w: 640, h: 480 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processPercent, setProcessPercent] = useState(10);
  const [frames, setFrames] = useState<FrameResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // Init MediaPipe in IMAGE mode (more reliable for seeked frames)
  const initModel = useCallback(async () => {
    setModelLoading(true);
    setModelError(null);
    try {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        outputSegmentationMasks: false,
      });
      landmarkerRef.current = landmarker;
      setModelReady(true);
    } catch (err: unknown) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setModelLoading(false);
    }
  }, []);

  // Cleanup
  useEffect(
    () => () => {
      if (landmarkerRef.current) landmarkerRef.current.close();
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

  // Process video frame-by-frame using IMAGE mode
  const processVideo = useCallback(async () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

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

    // We need a canvas to grab frames for IMAGE mode
    const offscreen = document.createElement('canvas');
    offscreen.width = video.videoWidth;
    offscreen.height = video.videoHeight;
    const offCtx = offscreen.getContext('2d')!;

    for (let i = 0; i < totalFrames; i++) {
      const time = i * interval;
      video.currentTime = time;

      await new Promise<void>(resolve => {
        video.addEventListener('seeked', () => resolve(), { once: true });
      });
      // Wait for the frame to actually render
      await new Promise<void>(r => setTimeout(r, 50));

      let landmarks: NormalizedLandmark[] | null = null;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          // Draw video frame to offscreen canvas, then detect
          offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
          const result = landmarker.detect(offscreen);
          landmarks = (result.landmarks?.[0] as NormalizedLandmark[]) ?? null;
        } catch {
          // skip frame
        }
      }

      results.push({ time, landmarks });
      setProcessProgress(Math.round(((i + 1) / totalFrames) * 100));
    }

    setFrames(results);
    setCurrentIdx(0);
    video.currentTime = 0;
    setIsProcessing(false);
  }, [processPercent]);

  // Seek video on scrub
  const handleScrub = (e: Event) => {
    const idx = parseInt((e.target as HTMLInputElement).value, 10);
    setCurrentIdx(idx);
    const video = videoRef.current;
    if (video && frames[idx]) video.currentTime = frames[idx].time;
  };

  // Draw skeleton on canvas for current frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoSize.w;
    canvas.height = videoSize.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frame = frames[currentIdx];
    if (!frame?.landmarks) return;
    const lms = frame.landmarks;

    // Draw connections
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
    ctx.lineWidth = 3;
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const la = lms[a];
      const lb = lms[b];
      if (!la || !lb) continue;
      ctx.beginPath();
      ctx.moveTo(la.x * canvas.width, la.y * canvas.height);
      ctx.lineTo(lb.x * canvas.width, lb.y * canvas.height);
      ctx.stroke();
    }

    // Draw points
    for (const lm of lms) {
      if (!lm) continue;
      ctx.beginPath();
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, 2 * Math.PI);
      ctx.fillStyle = (lm.visibility ?? 0) > 0.5 ? 'rgba(245, 158, 11, 1)' : 'rgba(168, 162, 158, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [frames, currentIdx, videoSize]);

  const currentFrame = frames[currentIdx] ?? null;
  const detectedCount = frames.filter(f => f.landmarks !== null).length;

  return (
    <DashboardLayout>
      <div class="p-6 h-full flex flex-col">
        <div class="mb-4">
          <h1 class="text-lg font-normal text-stone-200">Raw MediaPipe Demo</h1>
          <p class="text-stone-500 text-sm font-light mt-1">Minimal pose detection — no analyzer, just raw MediaPipe output to verify detection works.</p>
        </div>

        {/* Controls */}
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <label class="px-4 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm cursor-pointer hover:border-stone-600 transition-all">
            Choose Video
            <input type="file" accept="video/*" onChange={handleFileSelect} class="hidden" />
          </label>

          {!modelReady && (
            <button
              onClick={initModel}
              disabled={modelLoading}
              class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {modelLoading ? 'Loading Model…' : 'Load Pose Model'}
            </button>
          )}
          {modelReady && <span class="px-3 py-1.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">● Model Ready (IMAGE mode)</span>}
          {modelError && <span class="text-red-400 text-xs">{modelError}</span>}

          {videoSrc && modelReady && (
            <>
              <div class="flex items-center gap-2">
                <label class="text-xs text-stone-400">Process</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={processPercent}
                  onInput={e => setProcessPercent(parseInt((e.target as HTMLInputElement).value, 10))}
                  class="w-24 accent-amber-500"
                />
                <span class="text-xs text-stone-300 w-8">{processPercent}%</span>
              </div>
              <button
                onClick={processVideo}
                disabled={isProcessing}
                class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isProcessing ? `Processing… ${processProgress}%` : `Process First ${processPercent}%`}
              </button>
            </>
          )}
        </div>

        {/* Main */}
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* Video + Overlay */}
          <div class="lg:col-span-2 flex flex-col gap-3">
            <div class="flex-1 bg-stone-900 border border-stone-800 rounded-lg overflow-hidden relative min-h-80">
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
                </>
              ) : (
                <div class="absolute inset-0 flex items-center justify-center">
                  <p class="text-stone-500">Load a video to start</p>
                </div>
              )}
            </div>

            {/* Scrubber */}
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
                <span>Detected: {currentFrame.landmarks ? 'YES ✓' : 'NO ✗'}</span>
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
            {/* Stats */}
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Detection Stats</h3>
              {frames.length > 0 ? (
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Total Frames</span>
                    <span class="text-sm font-mono text-amber-400">{frames.length}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Detected</span>
                    <span class="text-sm font-mono text-emerald-400">{detectedCount}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Missed</span>
                    <span class="text-sm font-mono text-red-400">{frames.length - detectedCount}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-stone-300">Detection Rate</span>
                    <span class="text-sm font-mono text-amber-400">{((detectedCount / frames.length) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ) : (
                <p class="text-xs text-stone-600">Process a video to see stats</p>
              )}
            </div>

            {/* Raw Landmarks for current frame */}
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Landmarks (Frame {currentIdx + 1})</h3>
              {currentFrame?.landmarks ? (
                <div class="space-y-1 max-h-80 overflow-y-auto text-[11px] font-mono">
                  {currentFrame.landmarks.map((lm, i) => (
                    <div class={`flex gap-2 ${(lm.visibility ?? 0) > 0.5 ? 'text-stone-300' : 'text-stone-600'}`}>
                      <span class="w-6 text-right text-stone-500">{i}</span>
                      <span>
                        x:{lm.x.toFixed(3)} y:{lm.y.toFixed(3)} z:{lm.z.toFixed(3)}
                      </span>
                      <span class={(lm.visibility ?? 0) > 0.5 ? 'text-emerald-400' : 'text-red-400'}>v:{(lm.visibility ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p class="text-xs text-stone-600">{currentFrame ? 'No landmarks detected' : 'No frame selected'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
