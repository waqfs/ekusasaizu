import { useState } from 'preact/hooks';
import { DashboardLayout } from '@component/DashboardLayout.jsx';

interface Checkpoint {
  name: string;
  description: string;
  score: number | null;
}

interface ExerciseData {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  muscleGroups: string[];
  difficulty: string;
  checkpoints: Checkpoint[];
  overallScore: number | null;
}

const exercises: ExerciseData[] = [
  {
    id: 'pushups',
    name: 'Push-Ups',
    description:
      'A fundamental compound exercise that builds upper body pushing strength. Push-ups engage the chest, shoulders, and triceps while requiring core stabilization throughout the movement.',
    benefits: [
      'Builds chest, shoulder, and tricep strength',
      'Improves core stability and endurance',
      'No equipment needed — train anywhere',
      'Scalable difficulty for all fitness levels',
    ],
    muscleGroups: ['Chest', 'Shoulders', 'Triceps', 'Core'],
    difficulty: 'Beginner',
    checkpoints: [
      { name: 'Top Position', description: 'Arms fully extended, body in straight line from head to heels', score: 92 },
      { name: 'Midway Down', description: 'Controlled descent, elbows tracking at 45° angle', score: 78 },
      { name: 'Bottom Position', description: 'Chest near floor, elbows at approximately 90°', score: 85 },
      { name: 'Midway Up', description: 'Controlled ascent, maintaining rigid body line', score: 81 },
    ],
    overallScore: 84,
  },
  {
    id: 'squats',
    name: 'Squats',
    description:
      'The king of lower body exercises. Squats develop leg and glute strength while improving mobility, balance, and functional movement patterns used in daily life.',
    benefits: [
      'Strengthens quads, hamstrings, and glutes',
      'Improves hip and ankle mobility',
      'Boosts functional movement patterns',
      'Increases metabolic rate',
    ],
    muscleGroups: ['Quadriceps', 'Hamstrings', 'Glutes', 'Core'],
    difficulty: 'Beginner',
    checkpoints: [
      { name: 'Standing Position', description: 'Feet shoulder-width apart, weight balanced', score: 88 },
      { name: 'Midway Down', description: 'Knees tracking over toes, back neutral', score: 72 },
      { name: 'Full Depth', description: 'Thighs parallel or below, chest up', score: 68 },
      { name: 'Midway Up', description: 'Driving through heels, knees stable', score: 75 },
    ],
    overallScore: 76,
  },
  {
    id: 'planks',
    name: 'Planks',
    description:
      'An isometric hold that builds incredible core strength and endurance. Planks train the entire anterior chain and teach proper body alignment under tension.',
    benefits: ['Develops deep core strength', 'Improves posture and spinal alignment', 'Reduces risk of back injuries', 'Enhances total body stability'],
    muscleGroups: ['Core', 'Shoulders', 'Back', 'Glutes'],
    difficulty: 'Beginner',
    checkpoints: [
      { name: 'Entry Position', description: 'Forearms on ground, elbows under shoulders', score: 95 },
      { name: 'Hold — Body Line', description: 'Straight line from head to heels, no sagging', score: 91 },
      { name: 'Hold — Hip Position', description: 'Hips level, not piking or dropping', score: 88 },
    ],
    overallScore: 91,
  },
  {
    id: 'lunges',
    name: 'Lunges',
    description:
      'A unilateral exercise that builds single-leg strength and balance. Lunges address muscle imbalances and improve stability for athletic performance and daily activities.',
    benefits: ['Builds single-leg strength and balance', 'Corrects muscular imbalances', 'Improves hip flexor flexibility', 'Enhances athletic performance'],
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings', 'Calves'],
    difficulty: 'Intermediate',
    checkpoints: [
      { name: 'Starting Position', description: 'Standing tall, feet hip-width apart', score: 87 },
      { name: 'Step Forward', description: 'Long stride, maintaining upright torso', score: 79 },
      { name: 'Low Position', description: 'Both knees at 90°, back knee near floor', score: 76 },
      { name: 'Return', description: 'Driving through front heel to stand', score: 83 },
    ],
    overallScore: 81,
  },
  {
    id: 'burpees',
    name: 'Burpees',
    description:
      'A full-body explosive exercise combining a squat thrust with a push-up and jump. Burpees are excellent for building cardiovascular endurance and total body conditioning.',
    benefits: ['Full-body cardiovascular conditioning', 'Burns calories efficiently', 'Builds explosive power', 'Improves coordination and agility'],
    muscleGroups: ['Full Body', 'Core', 'Chest', 'Legs'],
    difficulty: 'Advanced',
    checkpoints: [
      { name: 'Standing', description: 'Upright, ready position', score: null },
      { name: 'Squat Down', description: 'Hands to floor, weight in heels', score: null },
      { name: 'Plank', description: 'Jump feet back, body straight', score: null },
      { name: 'Push-Up', description: 'Chest to floor and press up', score: null },
      { name: 'Jump', description: 'Explosive jump, arms overhead', score: null },
    ],
    overallScore: null,
  },
];

function scoreColor(score: number) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-amber-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBar(score: number) {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 80) return 'bg-amber-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

function difficultyBadge(difficulty: string) {
  if (difficulty === 'Beginner') return 'bg-emerald-500/10 text-emerald-400';
  if (difficulty === 'Intermediate') return 'bg-amber-500/10 text-amber-400';
  return 'bg-red-500/10 text-red-400';
}

export function Exercise() {
  const [selectedId, setSelectedId] = useState<string>('pushups');
  const selected = exercises.find(e => e.id === selectedId)!;

  return (
    <DashboardLayout>
      <div class="p-8">
        <div class="mb-8">
          <h1 class="text-xl font-normal text-stone-200">Exercises</h1>
          <p class="text-stone-500 text-sm font-light mt-1">Select an exercise to view details, technique checkpoints, and start a session.</p>
        </div>

        {/* Exercise Grid */}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
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
                <span class={`text-xs px-2 py-0.5 rounded-full ${difficultyBadge(ex.difficulty)}`}>{ex.difficulty}</span>
              </div>
              <div class="mt-3">
                {ex.overallScore !== null ? (
                  <span class={`text-2xl font-bold ${scoreColor(ex.overallScore)}`}>{ex.overallScore}</span>
                ) : (
                  <span class="text-sm text-stone-600">No data yet</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Exercise Detail */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Description & Benefits */}
          <div class="col-span-2 space-y-6">
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-lg font-normal text-stone-200">{selected.name}</h2>
                  <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${difficultyBadge(selected.difficulty)}`}>{selected.difficulty}</span>
                    {selected.muscleGroups.map(mg => (
                      <span class="text-xs px-2.5 py-1 rounded-full bg-stone-800 text-stone-400">{mg}</span>
                    ))}
                  </div>
                </div>
                {selected.overallScore !== null && (
                  <div class="text-center">
                    <div class={`text-3xl font-bold ${scoreColor(selected.overallScore)}`}>{selected.overallScore}</div>
                    <span class="text-xs text-stone-500">Overall Score</span>
                  </div>
                )}
              </div>
              <p class="text-stone-400 text-sm leading-relaxed">{selected.description}</p>
            </div>

            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">Benefits</h3>
              <ul class="space-y-3">
                {selected.benefits.map(b => (
                  <li class="flex items-start gap-3 text-sm text-stone-400">
                    <svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Checkpoints */}
          <div class="space-y-6">
            <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-6">
              <h3 class="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">Technique Checkpoints</h3>
              <div class="space-y-4">
                {selected.checkpoints.map((cp, i) => (
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-[10px] text-stone-400 font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span class="text-sm text-stone-300">{cp.name}</span>
                      </div>
                      {cp.score !== null ? (
                        <span class={`text-sm font-semibold ${scoreColor(cp.score)}`}>{cp.score}</span>
                      ) : (
                        <span class="text-xs text-stone-600">—</span>
                      )}
                    </div>
                    <p class="text-xs text-stone-500 ml-7 mb-2">{cp.description}</p>
                    {cp.score !== null && (
                      <div class="ml-7 h-1 bg-stone-800 overflow-hidden">
                        <div class={`h-full ${scoreBar(cp.score)}`} style={{ width: `${cp.score}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <a
              href={`/live?exercise=${selected.id}`}
              class="block w-full py-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-center transition-all shadow-md shadow-amber-900/20"
            >
              Start {selected.name}
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
