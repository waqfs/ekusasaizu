import { useState, useCallback, useRef, useMemo } from 'preact/hooks';
import type { NormalizedLandmark, FormEvent, WorkoutState } from './types';
import { ConfigDrivenAnalyzer, type ExerciseConfig } from './configAnalyzer';
import { isBodyVisible, isPoseHumanSized } from './landmarks';

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
};

/**
 * Hook that drives the workout state machine using a JSON exercise config.
 * Pass `null` config to get an idle state (before config is loaded).
 */
export function useWorkoutFormState(config: ExerciseConfig | null) {
  const [state, setState] = useState<WorkoutState>(INITIAL_STATE);
  const holdStartRef = useRef<number>(0);

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
        setState(s => ({ ...s, isBodyVisible: false, formIssues: ['Position your full body in the camera frame'] }));
        return;
      }

      // Size check — reject detections that are too small to be a real person
      if (!isPoseHumanSized(landmarks)) {
        setState(s => ({ ...s, isBodyVisible: false, formIssues: ['No person detected — step closer or adjust camera'] }));
        return;
      }

      // Body check — require shoulders + hips to be visible
      const CORE_LANDMARKS = [11, 12, 23, 24]; // shoulders, hips
      if (!isBodyVisible(landmarks, CORE_LANDMARKS, 0.3)) {
        setState(s => ({ ...s, isBodyVisible: false, formIssues: ['Some body parts are not visible — adjust camera'] }));
        return;
      }

      const events = analyzer.process(landmarks);
      const issues: string[] = [];
      const angleValues = analyzer.getAngleValues();

      setState(prev => {
        let { repCount, currentPhase, holdDuration } = prev;
        let newScore = 0;

        for (const event of events) {
          if (event.type === 'rep_completed') {
            repCount = analyzer.repCount;
            newScore = event.score ?? 0;
            currentPhase = analyzer.phase;
          } else if (event.type === 'good_form') {
            if (issues.length === 0) issues.push('Good form — keep it up!');
          } else {
            // Look up message for this event type
            const msg = messageMap.get(event.type);
            if (msg) issues.push(msg);
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
          holdDuration,
          events,
          angleValues,
          repCycleIndex: analyzer.phaseIndex,
        };
      });
    },
    [analyzer, messageMap, config],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    holdStartRef.current = 0;
    analyzer?.reset();
  }, [analyzer]);

  return { ...state, processLandmarks, reset };
}
