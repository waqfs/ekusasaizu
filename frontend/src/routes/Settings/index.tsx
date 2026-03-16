import { useState } from 'preact/hooks';
import { DashboardLayout } from '@component/DashboardLayout.jsx';

type SettingsTab = 'profile' | 'agent' | 'logs';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'agent', label: 'Agent' },
  { id: 'logs', label: 'Logs' },
];

const mockLogs = [
  { timestamp: '2026-03-10 18:32', exercise: 'Push-Ups', event: 'Session completed — 15 reps, score 88', level: 'info' },
  { timestamp: '2026-03-10 18:30', exercise: 'Push-Ups', event: 'Checkpoint alert: Hip sagging detected at Bottom Position', level: 'warn' },
  { timestamp: '2026-03-10 18:28', exercise: 'Push-Ups', event: 'Session started — camera and microphone initialized', level: 'info' },
  { timestamp: '2026-03-10 14:15', exercise: 'Squats', event: 'Session completed — 20 reps, score 75', level: 'info' },
  { timestamp: '2026-03-10 14:10', exercise: 'Squats', event: 'Form correction: Knees caving inward at Full Depth', level: 'warn' },
  { timestamp: '2026-03-10 14:08', exercise: 'Squats', event: 'Agent feedback: "Try pushing your knees out as you descend"', level: 'info' },
  { timestamp: '2026-03-09 09:45', exercise: 'Planks', event: 'Session completed — 4 holds, score 92', level: 'info' },
  { timestamp: '2026-03-09 09:40', exercise: 'Planks', event: 'Session started', level: 'info' },
  { timestamp: '2026-03-08 17:00', exercise: 'System', event: 'Camera permissions granted', level: 'info' },
  { timestamp: '2026-03-08 16:58', exercise: 'System', event: 'Account created successfully', level: 'info' },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <DashboardLayout>
      <div class="p-8">
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-stone-100">Settings</h1>
          <p class="text-stone-400 text-sm mt-1">Manage your profile, agent preferences, and view activity logs.</p>
        </div>

        {/* Tabs */}
        <div class="flex gap-1 mb-8 bg-stone-900/30 border border-stone-800/30 rounded-lg p-1 w-fit">
          {tabs.map(tab => (
            <button
              onClick={() => setActiveTab(tab.id)}
              class={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && <ProfileSettings />}
        {activeTab === 'agent' && <AgentSettings />}
        {activeTab === 'logs' && <LogsSettings />}
      </div>
    </DashboardLayout>
  );
}

function ProfileSettings() {
  return (
    <div class="max-w-2xl space-y-6">
      <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-stone-200 mb-6">Profile Information</h3>
        <div class="space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-stone-300 mb-1.5">Username</label>
              <input
                type="text"
                value="user123"
                class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-300 mb-1.5">Display Name</label>
              <input
                type="text"
                value="User"
                class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-300 mb-1.5">Email</label>
            <input
              type="email"
              value="user@example.com"
              class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-300 mb-1.5">Camera Quality</label>
            <select class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 transition-colors">
              <option>480p</option>
              <option selected>720p</option>
              <option>1080p</option>
            </select>
          </div>
        </div>
      </div>

      <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-stone-200 mb-6">Preferences</h3>
        <div class="space-y-4">
          <ToggleRow label="Email Notifications" description="Receive weekly progress summaries" defaultOn />
          <ToggleRow label="Sound Effects" description="Play sounds for checkpoint completions" defaultOn />
          <ToggleRow label="Dark Mode" description="Use dark theme (default)" defaultOn />
        </div>
      </div>

      <button class="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium transition-colors">Save Changes</button>
    </div>
  );
}

function AgentSettings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [saved, setSaved] = useState(false);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div class="max-w-2xl space-y-6">
      {/* Gemini API Key */}
      <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-stone-200 mb-2">Gemini API Key</h3>
        <p class="text-xs text-stone-500 mb-4">
          Provide your own Gemini API key for AI coaching. If empty, the server's default key will be used (if configured).
        </p>
        <div class="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onInput={e => setApiKey((e.target as HTMLInputElement).value)}
            placeholder="AIza..."
            class="flex-1 px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
          <button
            onClick={handleSaveApiKey}
            class="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium text-sm transition-colors"
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-stone-200 mb-6">Agent Behavior</h3>

        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-stone-300 mb-1.5">Feedback Frequency</label>
            <select class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 transition-colors">
              <option>Every checkpoint</option>
              <option selected>Every rep</option>
              <option>Every 5 reps</option>
              <option>End of set only</option>
            </select>
            <p class="text-xs text-stone-500 mt-1.5">How often the agent provides technique feedback.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-300 mb-1.5">Coaching Style</label>
            <select class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 transition-colors">
              <option>Strict — detailed corrections</option>
              <option selected>Balanced — corrections with encouragement</option>
              <option>Encouraging — focus on positives</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-300 mb-1.5">Voice</label>
            <select class="w-full px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 transition-colors">
              <option selected>Default (Text only)</option>
              <option>Coach Alex (Male)</option>
              <option>Coach Sara (Female)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-300 mb-3">Difficulty Adjustment</label>
            <div class="flex gap-3 flex-wrap">
              {['Auto', 'Easy', 'Normal', 'Hard'].map(level => (
                <button
                  class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    level === 'Auto'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-stone-800 text-stone-400 border border-stone-700 hover:border-stone-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p class="text-xs text-stone-500 mt-1.5">Auto adjusts based on your technique scores.</p>
          </div>
        </div>
      </div>

      <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-stone-200 mb-6">Agent Features</h3>
        <div class="space-y-4">
          <ToggleRow label="Real-Time Overlay" description="Show form feedback overlaid on camera feed" defaultOn />
          <ToggleRow label="Voice Feedback" description="Agent speaks corrections aloud" defaultOn={false} />
          <ToggleRow label="Auto-Count Reps" description="Automatically count repetitions" defaultOn />
          <ToggleRow label="Rest Timer" description="Suggest rest periods between sets" defaultOn />
        </div>
      </div>

      <button class="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium transition-colors">Save Agent Settings</button>
    </div>
  );
}

function LogsSettings() {
  return (
    <div class="space-y-6">
      <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-stone-800 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-stone-200">Activity Logs</h3>
          <span class="text-xs text-stone-500">{mockLogs.length} entries</span>
        </div>
        <div class="divide-y divide-stone-800/50">
          {mockLogs.map(log => (
            <div class="px-6 py-3 flex items-start gap-4 hover:bg-stone-800/20 transition-colors">
              <div class={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.level === 'warn' ? 'bg-amber-500' : 'bg-stone-600'}`} />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-stone-300">{log.event}</p>
                <div class="flex items-center gap-3 mt-1">
                  <span class="text-xs text-stone-500">{log.timestamp}</span>
                  <span class="text-xs text-stone-600">·</span>
                  <span class="text-xs text-stone-500">{log.exercise}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, defaultOn = false }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-stone-300">{label}</p>
        <p class="text-xs text-stone-500">{description}</p>
      </div>
      <button onClick={() => setOn(!on)} class={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-amber-500' : 'bg-stone-700'}`}>
        <div class={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
