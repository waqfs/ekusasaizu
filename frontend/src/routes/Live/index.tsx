import { useState, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { DashboardLayout } from '@component/DashboardLayout.jsx';
import { PoseOverlay } from '@component/PoseOverlay.jsx';
import { useCameraSession } from '../../lib/useCameraSession';
import { usePoseStream } from '../../lib/usePoseStream';
import { useWorkoutFormState } from '../../lib/useWorkoutFormState';
import { fetchExerciseConfig } from '../../lib/api';
import type { ExerciseConfig } from '../../lib/configAnalyzer';

const mockMessages = [
  { from: 'agent', text: "Welcome! Enable your camera and I'll start tracking your form." },
  { from: 'agent', text: 'MediaPipe Pose Landmarker will detect 33 body keypoints in real time.' },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Live() {
  const { query } = useLocation();
  const exerciseId = query.exercise ?? 'squat';

  // Exercise config loaded from backend
  const [config, setConfig] = useState<ExerciseConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    setConfigLoading(true);
    setConfigError(null);
    fetchExerciseConfig(exerciseId)
      .then(setConfig)
      .catch(err => setConfigError(err.message))
      .finally(() => setConfigLoading(false));
  }, [exerciseId]);

  const exerciseName = config?.name ?? exerciseId.charAt(0).toUpperCase() + exerciseId.slice(1);

  const camera = useCameraSession();
  const pose = usePoseStream(camera.videoRef);
  const workout = useWorkoutFormState(config);

  const [micOn, setMicOn] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const [elapsed, setElapsed] = useState(0);
  const [videoSize, setVideoSize] = useState({ w: 1280, h: 720 });
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Process landmarks through the workout analyzer
  useEffect(() => {
    workout.processLandmarks(pose.landmarks);
  }, [pose.landmarks]);

  // Update video dimensions when available
  useEffect(() => {
    const video = camera.videoRef.current;
    if (video && camera.isActive) {
      const onMeta = () => setVideoSize({ w: video.videoWidth || 1280, h: video.videoHeight || 720 });
      video.addEventListener('loadedmetadata', onMeta);
      return () => video.removeEventListener('loadedmetadata', onMeta);
    }
  }, [camera.isActive]);

  // Session timer
  useEffect(() => {
    if (camera.isActive) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [camera.isActive]);

  const handleCameraToggle = async () => {
    if (camera.isActive) {
      pose.stopDetection();
      camera.stop();
    } else {
      await camera.start();
      if (!pose.isReady && !pose.isLoading) {
        pose.initWorker();
      }
    }
  };

  // Start detection once both camera and pose model are ready
  useEffect(() => {
    if (camera.isActive && pose.isReady) {
      pose.startDetection();
      setMessages(prev => [...prev, { from: 'agent', text: `Pose model loaded! Tracking your ${exerciseName} form now.` }]);
    }
  }, [camera.isActive, pose.isReady]);

  // Add form feedback to chat
  const lastIssueRef = useRef('');
  useEffect(() => {
    if (workout.formIssues.length > 0 && workout.isBodyVisible) {
      const issue = workout.formIssues[0];
      if (issue !== lastIssueRef.current) {
        lastIssueRef.current = issue;
        setMessages(prev => [...prev, { from: 'agent', text: issue }]);
      }
    }
  }, [workout.formIssues, workout.isBodyVisible]);

  // Announce rep completions
  const lastRepRef = useRef(0);
  useEffect(() => {
    if (workout.repCount > lastRepRef.current) {
      lastRepRef.current = workout.repCount;
      setMessages(prev => [...prev, { from: 'agent', text: `Rep ${workout.repCount} complete! Score: ${workout.currentScore}` }]);
    }
  }, [workout.repCount]);

  const handleSendMessage = (e: Event) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages([...messages, { from: 'user', text: chatInput }]);
    setChatInput('');
  };

  const handleEndSession = () => {
    pose.destroy();
    camera.stop();
  };

  const isHoldExercise = config?.type === 'hold';
  const feedbackColor = workout.formIssues[0]?.startsWith('Good') ? 'text-emerald-400' : 'text-amber-400';

  return (
    <DashboardLayout>
      <div class="p-6 h-full flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-lg font-normal text-stone-200">Live Session</h1>
            <p class="text-sm text-stone-400">
              Exercise: {exerciseName}
              {isHoldExercise ? ` — Hold: ${formatTime(workout.holdDuration)}` : ` — Rep ${workout.repCount}`}
            </p>
          </div>
          <div class="flex items-center gap-3">
            {camera.isActive && (
              <span class="flex items-center gap-2 text-sm">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span class="text-red-400 font-medium">Live</span>
              </span>
            )}
            {pose.isReady && <span class="text-xs text-stone-500">{pose.fps} fps</span>}
            <span class="text-sm text-stone-500">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Main Content */}
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* Camera Feed */}
          <div class="lg:col-span-2 flex flex-col gap-4">
            <div ref={containerRef} class="flex-1 bg-stone-900 border border-stone-800 rounded-lg overflow-hidden relative min-h-100">
              {/* Hidden video element for camera feed */}
              <video
                ref={camera.videoRef}
                class="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)', display: camera.isActive ? 'block' : 'none' }}
                autoPlay
                playsInline
                muted
              />

              {/* Pose skeleton overlay */}
              {camera.isActive && pose.landmarks && <PoseOverlay landmarks={pose.landmarks} width={videoSize.w} height={videoSize.h} mirrored />}

              {/* Overlays when camera is active */}
              {camera.isActive && (
                <>
                  {/* Form feedback overlay */}
                  <div class="absolute top-4 left-4 bg-stone-950/80 backdrop-blur-sm border border-stone-700 rounded-lg px-4 py-2 max-w-xs">
                    {pose.isLoading && <p class="text-stone-400 text-sm">Loading pose model…</p>}
                    {pose.error && <p class="text-red-400 text-sm">{pose.error}</p>}
                    {pose.isReady && workout.formIssues.length > 0 && <p class={`${feedbackColor} text-sm font-medium`}>{workout.formIssues[0]}</p>}
                    {pose.isReady && !workout.isBodyVisible && !pose.isLoading && (
                      <p class="text-stone-400 text-sm">Step into frame — position your full body</p>
                    )}
                  </div>

                  {/* Score overlay */}
                  <div class="absolute top-4 right-4 bg-stone-950/80 backdrop-blur-sm border border-stone-700 rounded-lg px-4 py-3 text-center">
                    {isHoldExercise ? (
                      <>
                        <p class="text-xs text-stone-400">Hold Time</p>
                        <p class="text-2xl font-bold text-amber-400">{formatTime(workout.holdDuration)}</p>
                      </>
                    ) : (
                      <>
                        <p class="text-xs text-stone-400">Score</p>
                        <p class="text-2xl font-bold text-amber-400">{workout.currentScore || '—'}</p>
                      </>
                    )}
                  </div>

                  {/* Rep counter (bottom center) */}
                  {!isHoldExercise && (
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-950/80 backdrop-blur-sm border border-stone-700 rounded-lg px-6 py-2 text-center">
                      <p class="text-xs text-stone-400">Reps</p>
                      <p class="text-3xl font-bold text-stone-100">{workout.repCount}</p>
                    </div>
                  )}

                  {/* Body visibility indicator */}
                  {pose.isReady && (
                    <div class="absolute bottom-4 right-4">
                      <div class={`w-3 h-3 rounded-full ${workout.isBodyVisible ? 'bg-emerald-500' : 'bg-stone-600 animate-pulse'}`} />
                    </div>
                  )}
                </>
              )}

              {/* Camera off state */}
              {!camera.isActive && (
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center">
                    {configLoading && <p class="text-stone-400 text-sm mb-3">Loading exercise configuration…</p>}
                    {configError && (
                      <div class="mb-4">
                        <p class="text-red-400 text-sm">Failed to load config: {configError}</p>
                        <p class="text-stone-600 text-xs mt-1">Make sure the backend is running at localhost:8000</p>
                      </div>
                    )}
                    {!configLoading && !configError && (
                      <>
                        <svg class="w-16 h-16 mx-auto text-stone-700 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H4.5a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z"
                          />
                        </svg>
                        <p class="text-stone-500">Camera is off</p>
                        <p class="text-stone-600 text-xs mt-1">Enable your camera to start pose detection</p>
                      </>
                    )}
                    {camera.error && <p class="text-red-400 text-xs mt-2">{camera.error}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div class="flex items-center gap-4 flex-wrap">
              <div class="flex items-center gap-2">
                <button
                  onClick={handleCameraToggle}
                  class={`flex items-center gap-2 px-4 py-2.5 text-sm font-light tracking-wide transition-all ${
                    camera.isActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-stone-800 text-stone-400 border border-stone-700'
                  }`}
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H4.5a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z"
                    />
                  </svg>
                  Camera {camera.isActive ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => setMicOn(!micOn)}
                  class={`flex items-center gap-2 px-4 py-2.5 text-sm font-light tracking-wide transition-all ${
                    micOn ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-stone-800 text-stone-400 border border-stone-700'
                  }`}
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                    />
                  </svg>
                  Mic {micOn ? 'On' : 'Off'}
                </button>
                <a
                  href="/exercise"
                  onClick={handleEndSession}
                  class="flex items-center gap-2 px-4 py-2.5 text-sm font-light tracking-wide bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                    />
                  </svg>
                  End Session
                </a>
              </div>

              {/* Status badges */}
              <div class="flex-1 flex items-center gap-2 lg:ml-4 flex-wrap">
                <div
                  class={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    pose.isReady ? 'bg-emerald-500/10 text-emerald-400' : pose.isLoading ? 'bg-amber-500/10 text-amber-400' : 'bg-stone-800 text-stone-500'
                  }`}
                >
                  {pose.isReady ? '● Pose Model Ready' : pose.isLoading ? '◌ Loading Model…' : '○ Model Idle'}
                </div>
                {workout.isBodyVisible && <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">● Body Tracked</div>}
                {workout.currentPhase !== 'idle' && (
                  <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">Phase: {workout.currentPhase}</div>
                )}
              </div>
            </div>
          </div>

          {/* Agent Chat Panel */}
          <div class="flex flex-col bg-stone-900/30 border border-stone-800/30 rounded-lg overflow-hidden">
            <div class="px-4 py-3 border-b border-stone-800">
              <h3 class="text-xs font-medium tracking-wide text-stone-300">AI Coach</h3>
              <p class="text-xs text-stone-500">Real-time feedback and communication</p>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div class={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    class={`max-w-[85%] px-3.5 py-2 rounded-lg text-sm ${
                      msg.from === 'user' ? 'bg-amber-500/10 text-amber-100 border border-amber-500/20' : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} class="p-3 border-t border-stone-800">
              <div class="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onInput={e => setChatInput((e.target as HTMLInputElement).value)}
                  placeholder="Ask the coach..."
                  class="flex-1 px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
                <button type="submit" class="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
