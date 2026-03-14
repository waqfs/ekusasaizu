import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { DashboardLayout } from '@component/DashboardLayout.jsx';
import { PoseOverlay } from '@component/PoseOverlay.jsx';
import { fetchExercises, fetchExerciseConfig, type ExerciseSummary } from '../../lib/api';
import { ConfigDrivenAnalyzer, type ExerciseConfig } from '../../lib/configAnalyzer';
import type { NormalizedLandmark, FormEvent } from '../../lib/types';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

interface FrameData {
  time: number;
  landmarks: NormalizedLandmark[] | null;
  worldLandmarks: NormalizedLandmark[] | null;
}

export function Demo() {
  // --- State ---
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [config, setConfig] = useState<ExerciseConfig | null>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ w: 640, h: 480 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processPercent, setProcessPercent] = useState(25);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [landmarkerReady, setLandmarkerReady] = useState(false);
  const [landmarkerLoading, setLandmarkerLoading] = useState(false);
  const [landmarkerError, setLandmarkerError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // --- Load exercises from backend ---
  useEffect(() => {
    fetchExercises()
      .then(data => {
        setExercises(data);
        if (data.length > 0) setSelectedExerciseId(data[0].id);
      })
      .catch(() => {});
  }, []);

  // --- Load config when exercise changes ---
  useEffect(() => {
    if (!selectedExerciseId) return;
    fetchExerciseConfig(selectedExerciseId)
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [selectedExerciseId]);

  // --- Init MediaPipe PoseLandmarker ---
  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return;
    setLandmarkerLoading(true);
    setLandmarkerError(null);
    try {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        outputSegmentationMasks: false,
      });
      landmarkerRef.current = landmarker;
      setLandmarkerReady(true);
    } catch (err: unknown) {
      setLandmarkerError(err instanceof Error ? err.message : String(err));
    } finally {
      setLandmarkerLoading(false);
    }
  }, []);

  // Clean up
  useEffect(
    () => () => {
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    },
    [],
  );

  // --- Handle file selection ---
  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setFrames([]);
    setCurrentIdx(0);
    setProcessProgress(0);
  };

  // --- Process video frame-by-frame ---
  const processVideo = useCallback(async () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || !videoSrc) return;

    setIsProcessing(true);
    setFrames([]);
    setCurrentIdx(0);

    // Wait for video metadata
    await new Promise<void>(resolve => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    const duration = video.duration * (processPercent / 100);
    const fps = 15; // Sample at 15fps for analysis
    const interval = 1 / fps;
    const totalFrames = Math.ceil(duration * fps);
    const collectedFrames: FrameData[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const time = i * interval;
      video.currentTime = time;

      // Wait for the frame to be seeked
      await new Promise<void>(resolve => {
        video.addEventListener('seeked', () => resolve(), { once: true });
      });

      // Small delay to ensure the frame is rendered
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      let landmarks: NormalizedLandmark[] | null = null;
      let worldLandmarks: NormalizedLandmark[] | null = null;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          // detectForVideo needs monotonically increasing timestamps
          const ts = Math.round(time * 1000); // ms
          const result = landmarker.detectForVideo(video, ts);
          landmarks = (result.landmarks?.[0] as NormalizedLandmark[]) ?? null;
          worldLandmarks = (result.worldLandmarks?.[0] as NormalizedLandmark[]) ?? null;
        } catch {
          // frame decode error, skip
        }
      }

      collectedFrames.push({ time, landmarks, worldLandmarks });
      setProcessProgress(Math.round(((i + 1) / totalFrames) * 100));
    }

    setFrames(collectedFrames);
    setCurrentIdx(0);
    video.currentTime = 0;
    setIsProcessing(false);
  }, [videoSrc, processPercent]);

  // --- When video metadata loads, store size ---
  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (video) {
      setVideoSize({ w: video.videoWidth || 640, h: video.videoHeight || 480 });
    }
  };

  // --- Seek video when scrubbing ---
  const handleScrub = (e: Event) => {
    const idx = parseInt((e.target as HTMLInputElement).value, 10);
    setCurrentIdx(idx);
    const video = videoRef.current;
    if (video && frames[idx]) {
      video.currentTime = frames[idx].time;
    }
  };

  // --- Analyzer output for current frame ---
  const analysisResult = useMemo(() => {
    if (!config || frames.length === 0) return null;
    const analyzer = new ConfigDrivenAnalyzer(config);
    const results: Array<{ frame: number; phase: string; events: FormEvent[]; repCount: number; score: number; angles: Record<string, number> }> = [];

    for (let i = 0; i <= currentIdx; i++) {
      const f = frames[i];
      let events: FormEvent[] = [];
      if (f.landmarks && f.landmarks.length >= 33) {
        events = analyzer.process(f.landmarks);
      }

      // Extract current angles from analyzer
      const angles: Record<string, number> = {};
      if (config.angles && f.landmarks && f.landmarks.length >= 33) {
        for (const [name, angleCfg] of Object.entries(config.angles)) {
          const lm = f.landmarks;
          const l = angleBetween3(lm[angleCfg.left[0]], lm[angleCfg.left[1]], lm[angleCfg.left[2]]);
          const r = angleBetween3(lm[angleCfg.right[0]], lm[angleCfg.right[1]], lm[angleCfg.right[2]]);
          angles[name] = angleCfg.average ? (l + r) / 2 : l;
        }
      }

      results.push({
        frame: i,
        phase: analyzer.phase,
        events,
        repCount: analyzer.repCount,
        score: analyzer.lastRepScore,
        angles,
      });
    }

    return results[results.length - 1] ?? null;
  }, [config, frames, currentIdx]);

  const currentFrame = frames[currentIdx] ?? null;

  return (
    <DashboardLayout>
      <div class="p-6 h-full flex flex-col">
        <div class="mb-4">
          <h1 class="text-lg font-normal text-stone-200">Demo — Video Analysis</h1>
          <p class="text-stone-500 text-sm font-light mt-1">Load a video, run MediaPipe pose detection, and scrub through frames to analyze form.</p>
        </div>

        {/* Controls Bar */}
        <div class="flex flex-wrap items-center gap-3 mb-4">
          {/* Exercise Selector */}
          <select
            value={selectedExerciseId}
            onChange={e => setSelectedExerciseId((e.target as HTMLSelectElement).value)}
            class="px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-200 text-sm focus:outline-none focus:border-amber-500"
          >
            {exercises.map(ex => (
              <option value={ex.id}>{ex.name}</option>
            ))}
          </select>

          {/* File picker */}
          <label class="px-4 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-sm cursor-pointer hover:border-stone-600 transition-all">
            Choose Video
            <input type="file" accept="video/*" onChange={handleFileSelect} class="hidden" />
          </label>

          {/* Init Model */}
          {!landmarkerReady && (
            <button
              onClick={initLandmarker}
              disabled={landmarkerLoading}
              class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 transition-all"
            >
              {landmarkerLoading ? 'Loading Model…' : 'Load Pose Model'}
            </button>
          )}
          {landmarkerReady && <span class="px-3 py-1.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">● Model Ready</span>}
          {landmarkerError && <span class="text-red-400 text-xs">{landmarkerError}</span>}

          {/* Process Button */}
          {videoSrc && landmarkerReady && (
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
                class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 transition-all"
              >
                {isProcessing ? `Processing… ${processProgress}%` : `Process First ${processPercent}%`}
              </button>
            </>
          )}
        </div>

        {/* Main Content */}
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
                  {currentFrame?.landmarks && (
                    <PoseOverlay landmarks={currentFrame.landmarks} width={videoSize.w} height={videoSize.h} mirrored={false} contain />
                  )}
                </>
              ) : (
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center">
                    <svg class="w-16 h-16 mx-auto text-stone-700 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 12 6 12.504 6 13.125"
                      />
                    </svg>
                    <p class="text-stone-500">No video loaded</p>
                    <p class="text-stone-600 text-xs mt-1">Choose a video file to begin analysis</p>
                  </div>
                </div>
              )}
            </div>

            {/* Scrub Slider */}
            {frames.length > 0 && (
              <div class="flex items-center gap-3">
                <span class="text-xs text-stone-500 w-16 text-right">Frame {currentIdx + 1}</span>
                <input type="range" min="0" max={frames.length - 1} value={currentIdx} onInput={handleScrub} class="flex-1 accent-amber-500" />
                <span class="text-xs text-stone-500 w-16">{frames.length} total</span>
              </div>
            )}

            {/* Timeline info */}
            {currentFrame && (
              <div class="flex items-center gap-4 text-xs text-stone-500">
                <span>Time: {currentFrame.time.toFixed(2)}s</span>
                <span>Landmarks: {currentFrame.landmarks ? '33 detected' : 'none'}</span>
                {isProcessing && (
                  <div class="flex-1">
                    <div class="h-1 bg-stone-800 overflow-hidden">
                      <div class="h-full bg-amber-500 transition-all" style={{ width: `${processProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Panel */}
          <div class="flex flex-col gap-3 overflow-y-auto">
            {/* Angles */}
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Angles</h3>
              {analysisResult && Object.keys(analysisResult.angles).length > 0 ? (
                <div class="space-y-2">
                  {Object.entries(analysisResult.angles).map(([name, value]) => (
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-stone-300">{name}</span>
                      <span class="text-sm font-mono text-amber-400">{value.toFixed(1)}°</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p class="text-xs text-stone-600">No angle data — process a video first</p>
              )}
            </div>

            {/* Phase & Reps */}
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">State</h3>
              {analysisResult ? (
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-stone-300">Phase</span>
                    <span class="text-sm font-mono text-amber-400">{analysisResult.phase}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-stone-300">Reps</span>
                    <span class="text-sm font-mono text-amber-400">{analysisResult.repCount}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-stone-300">Last Score</span>
                    <span class="text-sm font-mono text-amber-400">{analysisResult.score || '—'}</span>
                  </div>
                </div>
              ) : (
                <p class="text-xs text-stone-600">No state data</p>
              )}
            </div>

            {/* Form Events */}
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Form Events (this frame)</h3>
              {analysisResult && analysisResult.events.length > 0 ? (
                <div class="space-y-1">
                  {analysisResult.events.map(ev => (
                    <div
                      class={`text-xs px-2 py-1 rounded ${ev.type === 'good_form' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}
                    >
                      {ev.type}
                      {ev.score !== undefined && ` (score: ${ev.score})`}
                    </div>
                  ))}
                </div>
              ) : (
                <p class="text-xs text-stone-600">No events at this frame</p>
              )}
            </div>

            {/* Config Info */}
            {config && (
              <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-4">
                <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Exercise Config</h3>
                <div class="space-y-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-stone-400">Name</span>
                    <span class="text-stone-200">{config.name}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-stone-400">Type</span>
                    <span class="text-stone-200">{config.type}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-stone-400">Phases</span>
                    <span class="text-stone-200">{config.phase_order.join(' → ')}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-stone-400">Form Checks</span>
                    <span class="text-stone-200">{config.form_checks.length}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-stone-400">Smoothing α</span>
                    <span class="text-stone-200">{config.smoothing.ema_alpha}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// --- Utility ---
function angleBetween3(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}
