/**
 * Exercise configuration loader — reads JSON configs from the exercises/ directory.
 */

import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';

const EXERCISES_DIR = join(import.meta.dir, 'exercises');

interface ExerciseSummary {
  id: string;
  name: string;
  type: string;
  description: string;
  camera_angle: string;
}

const cache = new Map<string, Record<string, any>>();

async function loadAll(): Promise<Map<string, Record<string, any>>> {
  if (cache.size > 0) return cache;

  try {
    const files = await readdir(EXERCISES_DIR);
    for (const file of files.sort()) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(EXERCISES_DIR, file), 'utf-8');
        const config = JSON.parse(raw);
        const id = config.id ?? basename(file, '.json');
        cache.set(id, config);
        console.log(`Loaded exercise config: ${id} (${file})`);
      } catch (e) {
        console.error(`Failed to load exercise config ${file}:`, e);
      }
    }
  } catch {
    console.warn(`Exercises directory not found: ${EXERCISES_DIR}`);
  }

  return cache;
}

export async function listExercises(): Promise<ExerciseSummary[]> {
  const configs = await loadAll();
  return Array.from(configs.values()).map(cfg => ({
    id: cfg.id,
    name: cfg.name,
    type: cfg.type,
    description: cfg.description,
    camera_angle: cfg.camera_angle ?? 'front',
  }));
}

export async function getExerciseConfig(exerciseId: string): Promise<Record<string, any> | null> {
  const configs = await loadAll();
  return configs.get(exerciseId) ?? null;
}

export function reloadExercises(): void {
  cache.clear();
}
