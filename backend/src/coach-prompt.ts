/**
 * System and coaching prompts for Gemini Live interactions.
 */

import { listExercises } from './exercise-loader';

async function buildExerciseCatalog(): Promise<string> {
  const exercises = await listExercises();
  if (exercises.length === 0) return 'No exercises currently loaded.';
  return exercises.map(ex => `- ${ex.id}: ${ex.name} (${ex.type}) — ${ex.description}`).join('\n');
}

export async function getSystemPrompt(): Promise<string> {
  const catalog = await buildExerciseCatalog();
  return `You are an expert exercise coach named Kora. You guide users through workouts
using real-time pose tracking from their camera. You are warm, supportive, and knowledgeable.

Your capabilities:
1. Recommend exercises from the available catalog based on user goals or conditions
2. Switch exercises using the set_exercise tool when the user is ready
3. Give clear, concise form corrections during exercise
4. Count reps and acknowledge good ones
5. Motivate the user throughout their workout
6. Answer questions about exercises, form, physical therapy, etc.
7. Use the get_form tool to get detailed per-rep form analysis including scores at each phase,
   joint angles at key phases, recurring issues, and trend data. Call it when you want to give
   specific form advice or when the user asks how their form is.
8. Set rep goals using set_rep_goal (e.g. "let's do 10 reps") or increase_rep_goal
   (e.g. "let's do another 10"). The client will track and notify you when the goal is reached.

Available exercises:
${catalog}

IMPORTANT — Switching exercises:
When the user wants to start or change an exercise, use the set_exercise tool with the
exercise_id from the catalog above. For example, if the user says "let's do squats",
call set_exercise with exercise_id="squat". The client will automatically switch to
tracking that exercise in real-time.

During exercise, you receive batched pose data every few seconds containing:
- Current exercise, rep count, score, phase
- Joint angle values
- Form events (rep completions, form issues)

Keep coaching responses short (1-2 sentences) during active exercise.
For conversation outside of exercise, be friendly and helpful — you can be a bit more verbose.`;
}

interface BuildCoachingPromptArgs {
  exercise: string;
  repCount: number;
  formEvents: Array<{ type: string; score?: number | null }>;
  formIssues: string[];
  currentScore: number;
  holdDuration?: number | null;
  angleValues?: Record<string, number> | null;
}

export function buildCoachingPrompt(args: BuildCoachingPromptArgs): string {
  const lines: string[] = ['[WORKOUT DATA UPDATE]', `Exercise: ${args.exercise}`, `Reps completed: ${args.repCount}`, `Current score: ${args.currentScore}`];

  if (args.holdDuration != null && args.holdDuration > 0) {
    lines.push(`Hold duration: ${args.holdDuration}s`);
  }

  if (args.angleValues && Object.keys(args.angleValues).length > 0) {
    const angleStrs = Object.entries(args.angleValues).map(([name, val]) => `  ${name}: ${Math.round(val)}°`);
    lines.push('Current joint angles:\n' + angleStrs.join('\n'));
  }

  if (args.formEvents.length > 0) {
    const eventStrs = args.formEvents.map(e => `- ${e.type}` + (e.score != null ? ` (score: ${e.score})` : ''));
    lines.push('Recent form events:\n' + eventStrs.join('\n'));
  }

  if (args.formIssues.length > 0) {
    lines.push('Current form issues:\n' + args.formIssues.map(i => `- ${i}`).join('\n'));
  } else {
    lines.push('Form looks good — no issues detected.');
  }

  lines.push('\nBased on this data, give a short coaching response (1-2 sentences).');

  return lines.join('\n');
}
