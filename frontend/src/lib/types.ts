export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FormEvent {
  type: string;
  score?: number;
  duration?: number;
  message?: string;
}

export interface WorkoutState {
  repCount: number;
  currentPhase: string;
  formIssues: string[];
  currentScore: number;
  isBodyVisible: boolean;
  holdDuration: number;
  events: FormEvent[];
  angleValues: Record<string, number>;
  repCycleIndex: number;
  missingBodyParts: string[];
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
