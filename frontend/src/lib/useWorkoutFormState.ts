import { useState, useCallback, useRef, useMemo } from 'preact/hooks';
import type { NormalizedLandmark, FormEvent, WorkoutState, RepSnapshot } from './types';
import { ConfigDrivenAnalyzer, type ExerciseConfig } from './configAnalyzer';
import { isBodyVisible, isPoseHumanSized } from './landmarks';

// Landmark index to human-readable body part name
const LANDMARK_NAMES: Record<number, string> = {
  11: 'left shoulder',
  12: 'right shoulder',
  13: 'left elbow',
  14: 'right elbow',
  15: 'left wrist',
  16: 'right wrist',
  23: 'left hip',
  24: 'right hip',
  25: 'left knee',
  26: 'right knee',
  27: 'left ankle',
  28: 'right ankle',
};

/** Check which required body part groups are not visible */
function getMissingBodyParts(landmarks: NormalizedLandmark[], config: ExerciseConfig | null): string[] {
  if (!config?.required_landmarks) return [];
  const missing: string[] = [];
  const rl = config.required_landmarks as Record<string, number[]>;
  for (const [group, indices] of Object.entries(rl)) {
    const invisible = indices.filter(idx => !landmarks[idx] || (landmarks[idx].visibility ?? 0) < 0.3);
    if (invisible.length > 0) {
      const parts = invisible.map(idx => LANDMARK_NAMES[idx] ?? `landmark ${idx}`);
      missing.push(`${group} (${parts.join(', ')})`);
    }
  }
  return missing;
}

const INITIAL_STATE: WorkoutState = {
  repCount: 0,
  currentPhase: 'idle',
  formIssues: [],
  currentScore: 0,
  isBodyVisible: false,
  holdDuration: 0,
  events: [],
  angleValues: {},
  repCycleIndex: 0,
  missingBodyParts: [],
  repHistory: [],
};

/**
 * Hook that drives the workout state machine using a JSON exercise config.
 * Pass `null` config to get an idle state (before config is loaded).
 */
export function useWorkoutFormState(config: ExerciseConfig | null) {
  const [state, setState] = useState<WorkoutState>(INITIAL_STATE);
  const holdStartRef = useRef<number>(0);
  const repStartRef = useRef<number>(performance.now());
  const repPhaseAnglesRef = useRef<Record<string, Record<string, number>>>({});
  const repIssuesRef = useRef<Set<string>>(new Set());
  const lastSnapshotRepRef = useRef<number>(0);

  const analyzer = useMemo(() => {
    if (!config) return null;
    return new ConfigDrivenAnalyzer(config);
  }, [config]);

  // Build a message lookup from form_checks in the config
  const messageMap = useMemo(() => {
    if (!config) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const check of config.form_checks) {
      map.set(check.event_type, check.message);
    }
    return map;
  }, [config]);

  const processLandmarks = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      if (!analyzer || !landmarks || landmarks.length < 33) {
        setState(s => ({ ...s, isBodyVisible: false, missingBodyParts: ['full body'], formIssues: ['Position your full body in the camera frame'] }));
        return;
      }

      // Size check — reject detections that are too small to be a real person
      if (!isPoseHumanSized(landmarks)) {
        setState(s => ({ ...s, isBodyVisible: false, missingBodyParts: ['full body'], formIssues: ['No person detected — step closer or adjust camera'] }));
        return;
      }

      // Body check — require shoulders + hips to be visible
      const CORE_LANDMARKS = [11, 12, 23, 24]; // shoulders, hips
      if (!isBodyVisible(landmarks, CORE_LANDMARKS, 0.3)) {
        // Determine which required landmark groups are missing
        const missing = getMissingBodyParts(landmarks, config);
        setState(s => ({
          ...s,
          isBodyVisible: false,
          missingBodyParts: missing,
          formIssues: missing.length > 0 ? [`Not visible: ${missing.join(', ')}`] : ['Some body parts are not visible — adjust camera'],
        }));
        return;
      }

      // Check exercise-specific required landmarks
      const missing = getMissingBodyParts(landmarks, config);
      if (missing.length > 0) {
        setState(s => ({ ...s, isBodyVisible: false, missingBodyParts: missing, formIssues: [`Not visible: ${missing.join(', ')}`] }));
        return;
      }

      const events = analyzer.process(landmarks);
      const issues: string[] = [];
      const angleValues = analyzer.getAngleValues();

      // Record angles at current phase for per-rep tracking
      const phase = analyzer.phase;
      if (phase && phase !== 'idle') {
        repPhaseAnglesRef.current[phase] = { ...angleValues };
      }

      setState(prev => {
        let { repCount, currentPhase, holdDuration, repHistory } = prev;
        let newScore = 0;

        for (const event of events) {
          if (event.type === 'rep_completed') {
            repCount = analyzer.repCount;
            newScore = event.score ?? 0;
            currentPhase = analyzer.phase;

            // Snapshot this rep if not already captured
            if (repCount > lastSnapshotRepRef.current) {
              const snapshot: RepSnapshot = {
                repNumber: repCount,
                score: newScore,
                phaseAngles: { ...repPhaseAnglesRef.current },
                formIssues: [...repIssuesRef.current],
                durationMs: Math.round(performance.now() - repStartRef.current),
              };
              repHistory = [...repHistory.slice(-9), snapshot]; // keep last 10
              lastSnapshotRepRef.current = repCount;

              // Flag extremely bad form for proactive coaching (score < 50 or 2+ issues)
              if (newScore < 50 || snapshot.formIssues.length >= 2) {
                events.push({
                  type: 'bad_form_alert',
                  score: newScore,
                  message: snapshot.formIssues.length > 0 ? snapshot.formIssues.join(', ') : 'very low score',
                });
              }

              // Reset for next rep
              repPhaseAnglesRef.current = {};
              repIssuesRef.current = new Set();
              repStartRef.current = performance.now();
            }
          } else if (event.type === 'good_form') {
            if (issues.length === 0) issues.push('Good form — keep it up!');
          } else {
            // Look up message for this event type
            const msg = messageMap.get(event.type);
            if (msg) {
              issues.push(msg);
              repIssuesRef.current.add(event.type);
            }
          }
        }

        currentPhase = analyzer.phase;

        // Handle hold-type exercises
        if (config?.type === 'hold') {
          if (currentPhase === 'hold' || currentPhase === 'top') {
            if (holdStartRef.current === 0) holdStartRef.current = performance.now();
            holdDuration = Math.floor((performance.now() - holdStartRef.current) / 1000);
          } else {
            holdStartRef.current = 0;
          }
        }

        return {
          repCount,
          currentPhase,
          formIssues: issues,
          currentScore: newScore || prev.currentScore,
          isBodyVisible: true,
          missingBodyParts: [],
          holdDuration,
          events,
          angleValues,
          repCycleIndex: analyzer.phaseIndex,
          repHistory,
        };
      });
    },
    [analyzer, messageMap, config],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    holdStartRef.current = 0;
    repStartRef.current = performance.now();
    repPhaseAnglesRef.current = {};
    repIssuesRef.current = new Set();
    lastSnapshotRepRef.current = 0;
    analyzer?.reset();
  }, [analyzer]);

  return { ...state, processLandmarks, reset };
}
