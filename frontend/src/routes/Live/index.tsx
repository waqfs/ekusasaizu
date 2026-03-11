import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { DashboardLayout } from '@component/DashboardLayout.jsx';

const mockMessages = [
  { from: 'agent', text: "Welcome! Ready to start your push-up session. Enable your camera when you're ready." },
  { from: 'agent', text: "Camera detected. I can see you — let's get started!" },
  { from: 'agent', text: 'Get into position. Arms shoulder-width apart, body straight.' },
  { from: 'user', text: 'Like this?' },
  { from: 'agent', text: 'Great top position! Score: 92. Now begin your descent — keep your elbows at a 45° angle.' },
  { from: 'agent', text: "Watch your hip position — try to keep your body in a straight line. You're sagging slightly." },
  { from: 'user', text: "How's my form now?" },
  { from: 'agent', text: 'Much better! Your bottom position looks solid. Chest is close to the floor and elbows are at good angles. Score: 85.' },
];

const mockCheckpoints = [
  { name: 'Top', active: false, completed: true, score: 92 },
  { name: 'Mid Down', active: false, completed: true, score: 78 },
  { name: 'Bottom', active: true, completed: false, score: 85 },
  { name: 'Mid Up', active: false, completed: false, score: null },
];

export function Live() {
  const { query } = useLocation();
  const exerciseName = query.exercise ? query.exercise.charAt(0).toUpperCase() + query.exercise.slice(1) : 'Push-Ups';

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(mockMessages);

  const handleSendMessage = (e: Event) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages([...messages, { from: 'user', text: chatInput }]);
    setChatInput('');
  };

  return (
    <DashboardLayout>
      <div class="p-6 h-full flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-xl font-bold text-gray-100">Live Session</h1>
            <p class="text-sm text-gray-400">Exercise: {exerciseName} — Rep 5 of 10</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-2 text-sm">
              <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span class="text-red-400 font-medium">Recording</span>
            </span>
            <span class="text-sm text-gray-500">03:24</span>
          </div>
        </div>

        {/* Main Content */}
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* Camera Feed */}
          <div class="lg:col-span-2 flex flex-col gap-4">
            <div class="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden relative min-h-[400px]">
              {cameraOn ? (
                <div class="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div class="text-center">
                    <svg class="w-16 h-16 mx-auto text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H4.5a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z"
                      />
                    </svg>
                    <p class="text-gray-500 text-sm">Camera feed active</p>
                    <p class="text-gray-600 text-xs mt-1">Your camera preview would appear here</p>
                  </div>
                  {/* Agent overlay feedback */}
                  <div class="absolute top-4 left-4 bg-gray-950/80 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
                    <p class="text-cyan-400 text-sm font-medium">✓ Good form — keep your back straight</p>
                  </div>
                  {/* Score overlay */}
                  <div class="absolute top-4 right-4 bg-gray-950/80 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-3 text-center">
                    <p class="text-xs text-gray-400">Current Score</p>
                    <p class="text-2xl font-bold text-cyan-400">85</p>
                  </div>
                </div>
              ) : (
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center">
                    <svg class="w-16 h-16 mx-auto text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H4.5a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z"
                      />
                    </svg>
                    <p class="text-gray-500">Camera is off</p>
                    <p class="text-gray-600 text-xs mt-1">Enable your camera to begin</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls + Checkpoints */}
            <div class="flex items-center gap-4 flex-wrap">
              {/* Controls */}
              <div class="flex items-center gap-2">
                <button
                  onClick={() => setCameraOn(!cameraOn)}
                  class={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    cameraOn ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H4.5a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z"
                    />
                  </svg>
                  Camera {cameraOn ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => setMicOn(!micOn)}
                  class={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    micOn ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700'
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
                  class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
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

              {/* Checkpoint Progress */}
              <div class="flex-1 flex items-center gap-1 lg:ml-4 flex-wrap">
                {mockCheckpoints.map((cp, i) => (
                  <div class="flex items-center gap-1">
                    <div
                      class={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        cp.active
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : cp.completed
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {cp.completed && (
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      {cp.name}
                      {cp.score !== null && <span class="font-bold">{cp.score}</span>}
                    </div>
                    {i < mockCheckpoints.length - 1 && <div class={`w-4 h-px ${cp.completed ? 'bg-emerald-500/30' : 'bg-gray-700'}`} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Chat Panel */}
          <div class="flex flex-col bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-800">
              <h3 class="text-sm font-semibold text-gray-200">AI Coach</h3>
              <p class="text-xs text-gray-500">Real-time feedback and communication</p>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div class={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    class={`max-w-[85%] px-3.5 py-2 rounded-xl text-sm ${
                      msg.from === 'user' ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/20' : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} class="p-3 border-t border-gray-800">
              <div class="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onInput={e => setChatInput((e.target as HTMLInputElement).value)}
                  placeholder="Ask the coach..."
                  class="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                <button type="submit" class="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-950 transition-colors">
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
