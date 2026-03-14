/**
 * API client for the exercise backend.
 * Base URL defaults to localhost:8000 in dev, and can be overridden via VITE_API_URL.
 */

import type { ExerciseConfig } from './configAnalyzer';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface ExerciseSummary {
  id: string;
  name: string;
  type: string;
  description: string;
  camera_angle: string;
}

export async function fetchExercises(): Promise<ExerciseSummary[]> {
  const res = await fetch(`${BASE}/api/exercises`);
  if (!res.ok) throw new Error(`Failed to fetch exercises: ${res.status}`);
  return res.json();
}

export async function fetchExerciseConfig(id: string): Promise<ExerciseConfig> {
  const res = await fetch(`${BASE}/api/exercises/${encodeURIComponent(id)}/config`);
  if (!res.ok) throw new Error(`Failed to fetch config for ${id}: ${res.status}`);
  return res.json();
}
