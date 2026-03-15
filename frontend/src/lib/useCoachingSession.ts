import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { NormalizedLandmark, FormEvent, WorkoutState } from './types';

const WS_URL = `ws://${window.location.hostname}:8000/ws/session`;

interface ExerciseCommand {
  type: string;
  exercise_id: string;
}

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

interface CoachingCallbacks {
  onCoachMessage: (msg: string) => void;
  onCommand?: (cmd: ExerciseCommand) => void;
}

/**
 * Hook for managing a WebSocket coaching session with the backend.
 * Supports real-time coaching during exercise AND conversational chat.
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
  const callbacksRef = useRef<CoachingCallbacks | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const handleCommands = useCallback((commands: ExerciseCommand[]) => {
    if (!commands || commands.length === 0) return;
    for (const cmd of commands) {
      callbacksRef.current?.onCommand?.(cmd);
    }
  }, []);

  const connect = useCallback((callbacks: CoachingCallbacks) => {
    callbacksRef.current = callbacks;

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
        sessionIdRef.current = data.session_id;
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
        if (data.text) callbacksRef.current?.onCoachMessage(data.text);
        handleCommands(data.commands);
      } else if (data.type === 'chat_response') {
        if (data.text) callbacksRef.current?.onCoachMessage(data.text);
        handleCommands(data.commands);
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
    sessionIdRef.current = null;
    setState({ isConnected: false, sessionId: null, lastCoachMessage: null, batchCount: 0 });
  }, []);

  const sendChat = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat', text }));
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
    audioChunkRef.current = b64;
  }, []);

  const sendBatch = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const workout = latestWorkoutRef.current;
    if (!workout) return;

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
      },
      audio_chunk_b64: audioChunkRef.current,
      angle_values: latestAngleValuesRef.current,
    };

    ws.send(JSON.stringify({ type: 'batch', payload }));
    pendingEventsRef.current = [];
    audioChunkRef.current = null;
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
    addFormEvent,
    updateWorkoutState,
    updateAngleValues,
    setAudioChunk,
  };
}
