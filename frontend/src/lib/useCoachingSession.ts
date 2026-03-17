import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { NormalizedLandmark, FormEvent, WorkoutState } from './types';

function getWsUrl(): string {
  const base = import.meta.env.VITE_API_URL;
  if (base) {
    const wsBase = base.replace(/^http/, 'ws');
    return `${wsBase}/ws/session`;
  }
  return `ws://${window.location.hostname}:8000/ws/session`;
}

const WS_URL = getWsUrl();

interface ExerciseCommand {
  type: string;
  exercise_id: string;
}

interface SessionState {
  isConnected: boolean;
  geminiConnected: boolean;
  sessionId: string | null;
}

interface UseCoachingSessionOptions {
  exercise: string;
  batchIntervalMs?: number;
  geminiApiKey?: string;
}

interface CoachingCallbacks {
  onTranscript: (role: 'user' | 'agent', text: string) => void;
  onAudioChunk?: (pcmB64: string, sampleRate: number) => void;
  onAudioEnd?: () => void;
  onCommand?: (cmd: ExerciseCommand) => void;
  onSetExercise?: (exerciseId: string, config: any) => void;
  onSetRepGoal?: (count: number) => void;
  onInterrupted?: () => void;
}

/**
 * Hook for managing a WebSocket coaching session with Gemini Live.
 * Supports bidirectional audio streaming and text chat.
 */
export function useCoachingSession(options: UseCoachingSessionOptions) {
  const { exercise, batchIntervalMs = 3000, geminiApiKey } = options;

  const [state, setState] = useState<SessionState>({
    isConnected: false,
    geminiConnected: false,
    sessionId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pendingEventsRef = useRef<FormEvent[]>([]);
  const latestWorkoutRef = useRef<WorkoutState | null>(null);
  const latestAngleValuesRef = useRef<Record<string, number>>({});
  const callbacksRef = useRef<CoachingCallbacks | null>(null);
  const lastSentRepRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback(
    (callbacks: CoachingCallbacks) => {
      callbacksRef.current = callbacks;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            config: {
              exercise,
              batch_interval_ms: batchIntervalMs,
              audio_enabled: true,
              gemini_api_key: geminiApiKey || undefined,
            },
          }),
        );
      };

      ws.onmessage = event => {
        const data = JSON.parse(event.data);

        if (data.type === 'session_started') {
          sessionIdRef.current = data.session_id;
          setState(s => ({
            ...s,
            isConnected: true,
            sessionId: data.session_id,
            geminiConnected: !!data.gemini_connected,
          }));

          // Start periodic batch sending for workout data
          intervalRef.current = setInterval(() => {
            sendBatch();
          }, batchIntervalMs);
        } else if (data.type === 'transcript') {
          callbacksRef.current?.onTranscript(data.role, data.text);
        } else if (data.type === 'audio_chunk') {
          callbacksRef.current?.onAudioChunk?.(data.pcm16_b64, data.sample_rate_hz || 24000);
        } else if (data.type === 'agent_audio_end') {
          callbacksRef.current?.onAudioEnd?.();
        } else if (data.type === 'set_exercise') {
          callbacksRef.current?.onSetExercise?.(data.exercise_id, data.config);
        } else if (data.type === 'set_rep_goal') {
          callbacksRef.current?.onSetRepGoal?.(data.count);
        } else if (data.type === 'interrupted') {
          callbacksRef.current?.onInterrupted?.();
        } else if (data.type === 'error') {
          console.error('Session error:', data.message);
        }
      };

      ws.onerror = err => {
        console.error('WS error:', err);
      };

      ws.onclose = () => {
        setState(s => ({ ...s, isConnected: false, geminiConnected: false }));
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    },
    [exercise, batchIntervalMs, geminiApiKey],
  );

  const disconnect = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }));
      ws.close();
    }
    sessionIdRef.current = null;
    setState({ isConnected: false, geminiConnected: false, sessionId: null });
  }, []);

  const sendChat = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat', text }));
  }, []);

  const sendAudioChunk = useCallback((pcmB64: string, sampleRate: number = 16000) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'audio_chunk',
        pcm16_b64: pcmB64,
        sample_rate_hz: sampleRate,
      }),
    );
  }, []);

  const addFormEvent = useCallback((event: FormEvent) => {
    pendingEventsRef.current.push(event);
  }, []);

  const updateWorkoutState = useCallback((workout: WorkoutState) => {
    latestWorkoutRef.current = workout;
  }, []);

  const updateAngleValues = useCallback((angles: Record<string, number>) => {
    latestAngleValuesRef.current = angles;
  }, []);

  const sendBatch = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const workout = latestWorkoutRef.current;
    if (!workout) return;

    // Only send reps not yet sent
    const newReps = (workout.repHistory ?? []).filter(r => r.repNumber > lastSentRepRef.current);
    if (newReps.length > 0) {
      lastSentRepRef.current = newReps[newReps.length - 1].repNumber;
    }

    const payload = {
      session_id: sessionIdRef.current || '',
      exercise,
      timestamp: Date.now(),
      pose_frames: [],
      form_events: [...pendingEventsRef.current],
      workout_status: {
        exercise,
        rep_count: workout.repCount,
        current_phase: workout.currentPhase,
        current_score: workout.currentScore,
        hold_duration: workout.holdDuration,
        is_body_visible: workout.isBodyVisible,
        form_issues: workout.formIssues,
        missing_body_parts: workout.missingBodyParts,
      },
      angle_values: latestAngleValuesRef.current,
      rep_history: newReps,
    };

    ws.send(JSON.stringify({ type: 'batch', payload }));
    pendingEventsRef.current = [];
  }, [exercise]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      wsRef.current?.close();
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendChat,
    sendAudioChunk,
    addFormEvent,
    updateWorkoutState,
    updateAngleValues,
  };
}
