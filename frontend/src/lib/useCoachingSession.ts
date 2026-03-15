import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { NormalizedLandmark, FormEvent, WorkoutState } from './types';

const WS_URL = `ws://${window.location.hostname}:8000/ws/session`;

interface SessionState {
  isConnected: boolean;
  sessionId: string | null;
  lastCoachMessage: string | null;
  batchCount: number;
}

interface UseCoachingSessionOptions {
  exercise: string;
  batchIntervalMs?: number;
  geminiApiKey?: string;
}

/**
 * Hook for managing a WebSocket coaching session with the backend.
 * Batches pose data, form events, audio, and angle values to send periodically.
 */
export function useCoachingSession(options: UseCoachingSessionOptions) {
  const { exercise, batchIntervalMs = 3000, geminiApiKey } = options;

  const [state, setState] = useState<SessionState>({
    isConnected: false,
    sessionId: null,
    lastCoachMessage: null,
    batchCount: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pendingEventsRef = useRef<FormEvent[]>([]);
  const latestWorkoutRef = useRef<WorkoutState | null>(null);
  const latestAngleValuesRef = useRef<Record<string, number>>({});
  const audioChunkRef = useRef<string | null>(null);
  const onCoachMessageRef = useRef<((msg: string) => void) | null>(null);

  const connect = useCallback((onCoachMessage: (msg: string) => void) => {
    onCoachMessageRef.current = onCoachMessage;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'start',
        config: {
          exercise,
          batch_interval_ms: batchIntervalMs,
          audio_enabled: true,
          gemini_api_key: geminiApiKey || undefined,
        },
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'session_started') {
        setState(s => ({ ...s, isConnected: true, sessionId: data.session_id }));

        // Start periodic batch sending
        intervalRef.current = setInterval(() => {
          sendBatch();
        }, batchIntervalMs);
      } else if (data.type === 'coaching') {
        setState(s => ({
          ...s,
          lastCoachMessage: data.text,
          batchCount: data.batch_number,
        }));
        onCoachMessageRef.current?.(data.text);
      }
    };

    ws.onerror = (err) => {
      console.error('WS error:', err);
    };

    ws.onclose = () => {
      setState(s => ({ ...s, isConnected: false }));
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [exercise, batchIntervalMs, geminiApiKey]);

  const disconnect = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }));
      ws.close();
    }
    setState({ isConnected: false, sessionId: null, lastCoachMessage: null, batchCount: 0 });
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

  const setAudioChunk = useCallback((b64: string) => {
    audioChunkRef.current = b64; // Overwrite — latest chunk wins
  }, []);

  const sendBatch = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const workout = latestWorkoutRef.current;
    if (!workout) return;

    const payload = {
      session_id: state.sessionId || '',
      exercise,
      timestamp: Date.now(),
      pose_frames: [], // We send form events instead of raw frames
      form_events: [...pendingEventsRef.current],
      workout_status: {
        exercise,
        rep_count: workout.repCount,
        current_phase: workout.currentPhase,
        current_score: workout.currentScore,
        hold_duration: workout.holdDuration,
        is_body_visible: workout.isBodyVisible,
        form_issues: workout.formIssues,
      },
      audio_chunk_b64: audioChunkRef.current,
      angle_values: latestAngleValuesRef.current,
    };

    ws.send(JSON.stringify({ type: 'batch', payload }));
    pendingEventsRef.current = [];
    audioChunkRef.current = null;
  }, [exercise, state.sessionId]);

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
    addFormEvent,
    updateWorkoutState,
    updateAngleValues,
    setAudioChunk,
  };
}
