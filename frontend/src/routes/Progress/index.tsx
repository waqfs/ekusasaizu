import { DashboardLayout } from '@component/DashboardLayout.jsx';

const stats = [
  { label: 'Day Streak', value: '12', change: '+2 this week' },
  { label: 'Workouts', value: '47', change: '+5 this week' },
  { label: 'Avg. Technique', value: '82%', change: '+3% from last week' },
  { label: 'Total Minutes', value: '1,240', change: '+180 this week' },
];

const weeklyActivity = [
  { day: 'Mon', minutes: 30, score: 85 },
  { day: 'Tue', minutes: 25, score: 79 },
  { day: 'Wed', minutes: 45, score: 91 },
  { day: 'Thu', minutes: 0, score: 0 },
  { day: 'Fri', minutes: 35, score: 84 },
  { day: 'Sat', minutes: 50, score: 88 },
  { day: 'Sun', minutes: 20, score: 76 },
];

const goals = [
  { name: 'Complete 30 Push-Ups', progress: 24, target: 30 },
  { name: 'Hold Plank for 2 Minutes', progress: 90, target: 120 },
  { name: '25 Squats with 90+ Score', progress: 18, target: 25 },
  { name: 'Work Out 5 Days This Week', progress: 4, target: 5 },
];

const recentWorkouts = [
  { exercise: 'Push-Ups', date: 'Mar 10', score: 88, duration: '15 min', reps: 45 },
  { exercise: 'Squats', date: 'Mar 10', score: 75, duration: '20 min', reps: 30 },
  { exercise: 'Planks', date: 'Mar 9', score: 92, duration: '10 min', reps: 4 },
  { exercise: 'Lunges', date: 'Mar 8', score: 81, duration: '18 min', reps: 24 },
  { exercise: 'Burpees', date: 'Mar 7', score: 69, duration: '12 min', reps: 15 },
];

const techniqueByExercise = [
  { name: 'Planks', score: 92 },
  { name: 'Push-Ups', score: 84 },
  { name: 'Lunges', score: 81 },
  { name: 'Squats', score: 76 },
  { name: 'Burpees', score: 69 },
];

function scoreColor(score: number) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-cyan-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBadge(score: number) {
  if (score >= 90) return 'bg-emerald-500/10 text-emerald-400';
  if (score >= 80) return 'bg-cyan-500/10 text-cyan-400';
  if (score >= 70) return 'bg-amber-500/10 text-amber-400';
  return 'bg-red-500/10 text-red-400';
}

function scoreBar(score: number) {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 80) return 'bg-cyan-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

const statAccents = ['text-cyan-400', 'text-blue-400', 'text-violet-400', 'text-emerald-400'];

export function Progress() {
  return (
    <DashboardLayout>
      <div class="p-8">
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-100">Progress Dashboard</h1>
          <p class="text-gray-400 text-sm mt-1">Track your fitness journey and technique improvements.</p>
        </div>

        {/* Stats Cards */}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <p class="text-sm text-gray-400 mb-1">{stat.label}</p>
              <p class="text-3xl font-bold text-gray-100">{stat.value}</p>
              <p class={`text-xs mt-2 ${statAccents[i]}`}>{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Weekly Activity */}
        <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 class="text-lg font-semibold text-gray-200 mb-6">Weekly Activity</h2>
          <div class="flex items-end gap-3 h-40">
            {weeklyActivity.map(day => {
              const height = day.minutes ? Math.max((day.minutes / 50) * 100, 10) : 5;
              return (
                <div class="flex-1 flex flex-col items-center gap-2">
                  <span class="text-xs text-gray-400">{day.minutes > 0 ? `${day.minutes}m` : '—'}</span>
                  <div class="w-full relative" style={{ height: `${height}%` }}>
                    <div class={`w-full h-full rounded-lg ${day.minutes > 0 ? 'bg-linear-to-t from-cyan-600 to-cyan-400' : 'bg-gray-800'}`} />
                  </div>
                  <span class="text-xs text-gray-500 font-medium">{day.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Goals */}
          <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 class="text-lg font-semibold text-gray-200 mb-5">Current Goals</h2>
            <div class="space-y-4">
              {goals.map(goal => {
                const pct = Math.round((goal.progress / goal.target) * 100);
                return (
                  <div>
                    <div class="flex justify-between text-sm mb-1.5">
                      <span class="text-gray-300">{goal.name}</span>
                      <span class="text-gray-500">
                        {goal.progress}/{goal.target}
                      </span>
                    </div>
                    <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div class="h-full bg-linear-to-r from-cyan-500 to-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technique by Exercise */}
          <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 class="text-lg font-semibold text-gray-200 mb-5">Technique Scores</h2>
            <div class="space-y-4">
              {techniqueByExercise.map(ex => (
                <div class="flex items-center gap-4">
                  <span class="text-sm text-gray-300 w-24">{ex.name}</span>
                  <div class="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div class={`h-full rounded-full transition-all ${scoreBar(ex.score)}`} style={{ width: `${ex.score}%` }} />
                  </div>
                  <span class={`text-sm font-semibold w-10 text-right ${scoreColor(ex.score)}`}>{ex.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Workouts */}
        <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-5">Recent Workouts</h2>
          <table class="w-full">
            <thead>
              <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th class="pb-3 font-medium">Exercise</th>
                <th class="pb-3 font-medium">Date</th>
                <th class="pb-3 font-medium">Score</th>
                <th class="pb-3 font-medium">Duration</th>
                <th class="pb-3 font-medium">Reps</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              {recentWorkouts.map(w => (
                <tr class="text-sm">
                  <td class="py-3 text-gray-200 font-medium">{w.exercise}</td>
                  <td class="py-3 text-gray-400">{w.date}</td>
                  <td class="py-3">
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${scoreBadge(w.score)}`}>{w.score}</span>
                  </td>
                  <td class="py-3 text-gray-400">{w.duration}</td>
                  <td class="py-3 text-gray-400">{w.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
