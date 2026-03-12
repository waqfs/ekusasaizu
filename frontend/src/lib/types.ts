export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type FormEvent =
  | { type: 'rep_started' }
  | { type: 'rep_completed'; score: number }
  | { type: 'depth_too_shallow' }
  | { type: 'knees_caving' }
  | { type: 'hips_dropping' }
  | { type: 'hips_sagging' }
  | { type: 'back_arching' }
  | { type: 'hold_started' }
  | { type: 'hold_completed'; duration: number }
  | { type: 'good_form' }
  | { type: 'body_not_visible' }
  | { type: 'framing_issue'; message: string };

export type ExerciseType = 'pushups' | 'squats' | 'plank' | 'lunges' | 'burpees';

export interface WorkoutState {
  repCount: number;
  currentPhase: 'idle' | 'descending' | 'bottom' | 'ascending' | 'top' | 'holding';
  formIssues: string[];
  currentScore: number;
  isBodyVisible: boolean;
  holdDuration: number;
  events: FormEvent[];
}

export interface PoseWorkerMessage {
  type: 'init' | 'detect' | 'destroy';
  frame?: ImageBitmap;
  timestamp?: number;
}

export interface PoseWorkerResult {
  type: 'ready' | 'result' | 'error';
  landmarks?: NormalizedLandmark[][];
  worldLandmarks?: NormalizedLandmark[][];
  timestamp?: number;
  error?: string;
}
