import { useState, useCallback, useRef } from 'preact/hooks';
import type { NormalizedLandmark, FormEvent, ExerciseType, WorkoutState } from './types';
import { checkVisibility, getAnalyzer } from './analyzers';

const INITIAL_STATE: WorkoutState = {
  repCount: 0,
  currentPhase: 'idle',
  formIssues: [],
  currentScore: 0,
  isBodyVisible: false,
  holdDuration: 0,
  events: [],
};

export function useWorkoutFormState(exercise: ExerciseType) {
  const [state, setState] = useState<WorkoutState>(INITIAL_STATE);
  const phaseRef = useRef<'top' | 'bottom'>('top');
  const holdStartRef = useRef<number>(0);
  const analyzer = getAnalyzer(exercise);

  const processLandmarks = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      if (!landmarks || landmarks.length < 33) {
        setState(s => ({ ...s, isBodyVisible: false, formIssues: ['Position your full body in the camera frame'] }));
        return;
      }

      const visible = checkVisibility(landmarks, exercise);
      if (!visible) {
        setState(s => ({ ...s, isBodyVisible: false, formIssues: ['Some body parts are not visible — adjust camera'] }));
        return;
      }

      const events = analyzer(landmarks);
      const issues: string[] = [];

      setState(prev => {
        let { repCount, currentPhase, holdDuration } = prev;
        let newScore = 0;

        for (const event of events) {
          switch (event.type) {
            case 'rep_started':
              if (phaseRef.current === 'top') {
                phaseRef.current = 'bottom';
                currentPhase = 'descending';
              }
              break;
            case 'rep_completed':
              if (phaseRef.current === 'bottom') {
                phaseRef.current = 'top';
                repCount++;
                currentPhase = 'top';
                newScore = event.score;
              }
              break;
            case 'depth_too_shallow':
              issues.push('Go deeper — increase your range of motion');
              break;
            case 'knees_caving':
              issues.push('Keep your knees aligned over your toes');
              break;
            case 'hips_dropping':
              issues.push('Raise your hips — keep your body straight');
              break;
            case 'hips_sagging':
              issues.push('Tighten your core — prevent hip sag');
              break;
            case 'back_arching':
              issues.push('Flatten your back — engage your core');
              break;
            case 'hold_started':
              if (currentPhase !== 'holding') {
                holdStartRef.current = performance.now();
                currentPhase = 'holding';
              }
              holdDuration = Math.floor((performance.now() - holdStartRef.current) / 1000);
              break;
            case 'good_form':
              if (issues.length === 0) issues.push('Good form — keep it up!');
              break;
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
        };
      });
    },
    [exercise, analyzer],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    phaseRef.current = 'top';
    holdStartRef.current = 0;
  }, []);

  return { ...state, processLandmarks, reset };
}
