import type { NormalizedLandmark, FormEvent, ExerciseType } from './types';
import { LANDMARK, angleBetween, isBodyVisible } from './landmarks';

// Required landmarks per exercise for visibility checking
const REQUIRED_LANDMARKS: Record<ExerciseType, number[]> = {
  pushups: [
    LANDMARK.LEFT_SHOULDER,
    LANDMARK.RIGHT_SHOULDER,
    LANDMARK.LEFT_ELBOW,
    LANDMARK.RIGHT_ELBOW,
    LANDMARK.LEFT_WRIST,
    LANDMARK.RIGHT_WRIST,
    LANDMARK.LEFT_HIP,
    LANDMARK.RIGHT_HIP,
    LANDMARK.LEFT_ANKLE,
    LANDMARK.RIGHT_ANKLE,
  ],
  squats: [
    LANDMARK.LEFT_SHOULDER,
    LANDMARK.RIGHT_SHOULDER,
    LANDMARK.LEFT_HIP,
    LANDMARK.RIGHT_HIP,
    LANDMARK.LEFT_KNEE,
    LANDMARK.RIGHT_KNEE,
    LANDMARK.LEFT_ANKLE,
    LANDMARK.RIGHT_ANKLE,
  ],
  plank: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_ANKLE],
  lunges: [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE, LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_ANKLE],
  burpees: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE],
};

export function checkVisibility(landmarks: NormalizedLandmark[], exercise: ExerciseType): boolean {
  return isBodyVisible(landmarks, REQUIRED_LANDMARKS[exercise] ?? [], 0.5);
}

/** Analyze push-up form from landmarks */
export function analyzePushups(landmarks: NormalizedLandmark[]): FormEvent[] {
  const events: FormEvent[] = [];
  const ls = landmarks;

  // Elbow angle (arm bend)
  const leftElbowAngle = angleBetween(ls[LANDMARK.LEFT_SHOULDER], ls[LANDMARK.LEFT_ELBOW], ls[LANDMARK.LEFT_WRIST]);
  const rightElbowAngle = angleBetween(ls[LANDMARK.RIGHT_SHOULDER], ls[LANDMARK.RIGHT_ELBOW], ls[LANDMARK.RIGHT_WRIST]);
  const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

  // Body alignment (shoulder-hip-ankle angle)
  const leftBodyAngle = angleBetween(ls[LANDMARK.LEFT_SHOULDER], ls[LANDMARK.LEFT_HIP], ls[LANDMARK.LEFT_ANKLE]);
  const rightBodyAngle = angleBetween(ls[LANDMARK.RIGHT_SHOULDER], ls[LANDMARK.RIGHT_HIP], ls[LANDMARK.RIGHT_ANKLE]);
  const avgBodyAngle = (leftBodyAngle + rightBodyAngle) / 2;

  // Hip sag detection (body should be ~straight, 160-180 degrees)
  if (avgBodyAngle < 150) {
    events.push({ type: 'hips_dropping' });
  } else if (avgBodyAngle > 190) {
    events.push({ type: 'back_arching' });
  } else {
    events.push({ type: 'good_form' });
  }

  // Phase detection based on elbow angle
  if (avgElbowAngle < 100) {
    events.push({ type: 'rep_started' });
  } else if (avgElbowAngle > 160) {
    events.push({ type: 'rep_completed', score: Math.round(Math.min(100, avgBodyAngle / 1.8)) });
  }

  return events;
}

/** Analyze squat form from landmarks */
export function analyzeSquats(landmarks: NormalizedLandmark[]): FormEvent[] {
  const events: FormEvent[] = [];
  const ls = landmarks;

  // Knee angle (depth)
  const leftKneeAngle = angleBetween(ls[LANDMARK.LEFT_HIP], ls[LANDMARK.LEFT_KNEE], ls[LANDMARK.LEFT_ANKLE]);
  const rightKneeAngle = angleBetween(ls[LANDMARK.RIGHT_HIP], ls[LANDMARK.RIGHT_KNEE], ls[LANDMARK.RIGHT_ANKLE]);
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  // Check for knee cave (knees collapsing inward)
  const kneeDistance = Math.abs(ls[LANDMARK.LEFT_KNEE].x - ls[LANDMARK.RIGHT_KNEE].x);
  const ankleDistance = Math.abs(ls[LANDMARK.LEFT_ANKLE].x - ls[LANDMARK.RIGHT_ANKLE].x);
  if (kneeDistance < ankleDistance * 0.7) {
    events.push({ type: 'knees_caving' });
  }

  // Depth check
  if (avgKneeAngle > 130 && avgKneeAngle < 170) {
    events.push({ type: 'depth_too_shallow' });
  } else if (avgKneeAngle <= 130) {
    events.push({ type: 'good_form' });
  }

  // Phase detection
  if (avgKneeAngle < 100) {
    events.push({ type: 'rep_started' });
  } else if (avgKneeAngle > 160) {
    const score = Math.round(Math.max(60, 100 - Math.abs(avgKneeAngle - 170)));
    events.push({ type: 'rep_completed', score });
  }

  return events;
}

/** Analyze plank form from landmarks */
export function analyzePlank(landmarks: NormalizedLandmark[]): FormEvent[] {
  const events: FormEvent[] = [];
  const ls = landmarks;

  // Body alignment (shoulder-hip-ankle should be ~straight)
  const leftBodyAngle = angleBetween(ls[LANDMARK.LEFT_SHOULDER], ls[LANDMARK.LEFT_HIP], ls[LANDMARK.LEFT_ANKLE]);
  const rightBodyAngle = angleBetween(ls[LANDMARK.RIGHT_SHOULDER], ls[LANDMARK.RIGHT_HIP], ls[LANDMARK.RIGHT_ANKLE]);
  const avgBodyAngle = (leftBodyAngle + rightBodyAngle) / 2;

  if (avgBodyAngle < 155) {
    events.push({ type: 'hips_sagging' });
  } else if (avgBodyAngle > 195) {
    events.push({ type: 'hips_dropping' });
  } else {
    events.push({ type: 'good_form' });
    events.push({ type: 'hold_started' });
  }

  return events;
}

/** Analyze lunge form from landmarks */
export function analyzeLunges(landmarks: NormalizedLandmark[]): FormEvent[] {
  const events: FormEvent[] = [];
  const ls = landmarks;

  const leftKneeAngle = angleBetween(ls[LANDMARK.LEFT_HIP], ls[LANDMARK.LEFT_KNEE], ls[LANDMARK.LEFT_ANKLE]);
  const rightKneeAngle = angleBetween(ls[LANDMARK.RIGHT_HIP], ls[LANDMARK.RIGHT_KNEE], ls[LANDMARK.RIGHT_ANKLE]);

  // Determine which leg is forward (lower knee y = forward in camera coords)
  const leftForward = ls[LANDMARK.LEFT_KNEE].y > ls[LANDMARK.RIGHT_KNEE].y;
  const frontKneeAngle = leftForward ? leftKneeAngle : rightKneeAngle;

  // Front knee should be ~90 degrees at bottom
  if (frontKneeAngle > 120) {
    events.push({ type: 'depth_too_shallow' });
  } else if (frontKneeAngle >= 70 && frontKneeAngle <= 120) {
    events.push({ type: 'good_form' });
  }

  // Phase detection
  if (frontKneeAngle < 100) {
    events.push({ type: 'rep_started' });
  } else if (frontKneeAngle > 150) {
    events.push({ type: 'rep_completed', score: Math.round(Math.min(100, 90 + (150 - frontKneeAngle))) });
  }

  return events;
}

/** Get the appropriate analyzer for an exercise type */
export function getAnalyzer(exercise: ExerciseType): (landmarks: NormalizedLandmark[]) => FormEvent[] {
  switch (exercise) {
    case 'pushups':
      return analyzePushups;
    case 'squats':
      return analyzeSquats;
    case 'plank':
      return analyzePlank;
    case 'lunges':
      return analyzeLunges;
    case 'burpees':
      return analyzePushups; // Simplified: use pushup analysis
    default:
      return () => [];
  }
}
