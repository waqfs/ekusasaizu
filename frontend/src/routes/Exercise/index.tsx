import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '@component/DashboardLayout.jsx';
import { fetchExercises, type ExerciseSummary } from '../../lib/api';

function difficultyBadge(type: string) {
  if (type === 'hold') return 'bg-amber-500/10 text-amber-400';
  return 'bg-emerald-500/10 text-emerald-400';
}

export function Exercise() {
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExercises()
      .then(data => {
        setExercises(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = exercises.find(e => e.id === selectedId);

  return (
    <DashboardLayout>
      <div class="p-8">
        <div class="mb-8">
          <h1 class="text-xl font-normal text-stone-200">Exercises</h1>
          <p class="text-stone-500 text-sm font-light mt-1">Select an exercise to view details and start a session.</p>
        </div>

        {loading && <p class="text-stone-400 text-sm">Loading exercises…</p>}
        {error && (
          <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p class="text-red-400 text-sm">Failed to load exercises: {error}</p>
            <p class="text-stone-500 text-xs mt-1">Make sure the backend is running at localhost:8000</p>
          </div>
        )}

        {/* Exercise Grid */}
        {!loading && exercises.length > 0 && (
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {exercises.map(ex => (
              <button
                onClick={() => setSelectedId(ex.id)}
                class={`p-4 rounded-lg border text-left transition-all ${
                  selectedId === ex.id
                    ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
                    : 'bg-stone-900/50 border-stone-800 hover:border-stone-700'
                }`}
              >
                <h3 class={`font-medium text-sm ${selectedId === ex.id ? 'text-amber-400' : 'text-stone-200'}`}>{ex.name}</h3>
                <div class="flex items-center gap-2 mt-2">
                  <span class={`text-xs px-2 py-0.5 rounded-full ${difficultyBadge(ex.type)}`}>{ex.type}</span>
                </div>
                <p class="text-xs text-stone-500 mt-2 line-clamp-2">{ex.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Selected Exercise Detail */}
        {selected && (
          <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2 class="text-lg font-normal text-stone-200">{selected.name}</h2>
                <div class="flex items-center gap-2 mt-2">
                  <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${difficultyBadge(selected.type)}`}>{selected.type}</span>
                  <span class="text-xs px-2.5 py-1 rounded-full bg-stone-800 text-stone-400">{selected.camera_angle} camera</span>
                </div>
              </div>
            </div>
            <p class="text-stone-400 text-sm leading-relaxed mb-6">{selected.description}</p>

            <a
              href={`/live?exercise=${selected.id}`}
              class="inline-block px-6 py-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-center transition-all shadow-md shadow-amber-900/20"
            >
              Start {selected.name}
            </a>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
