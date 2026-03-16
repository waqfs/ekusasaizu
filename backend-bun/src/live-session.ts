/**
 * WebSocket-based live coaching session manager.
 *
 * Handles the same protocol as the Python FastAPI backend so the frontend
 * works without changes.
 *
 * Protocol:
 * → { type: "start", config: SessionConfig }
 * ← { type: "session_started", session_id, config, gemini_connected }
 *
 * → { type: "chat", text: string }
 * ← { type: "transcript", role: "user"|"agent", text }
 *
 * → { type: "audio_chunk", pcm16_b64, sample_rate_hz: 16000 }
 * ← { type: "audio_chunk", pcm16_b64, sample_rate_hz: 24000, channels: 1 }
 *
 * → { type: "batch", payload: BatchPayload }
 * ← { type: "batch_ack", batch_number }
 *
 * → { type: "end" }
 * ← { type: "session_ended", summary }
 */

import { GeminiLiveSession, type GeminiCallbacks } from './gemini-live';
import { getSystemPrompt, buildCoachingPrompt } from './coach-prompt';
import { getExerciseConfig } from './exercise-loader';
import type { ServerWebSocket } from 'bun';

interface SessionConfig {
  exercise: string;
  batch_interval_ms?: number;
  audio_enabled?: boolean;
  gemini_api_key?: string;
}

function getApiKey(config: SessionConfig): string | null {
  return config.gemini_api_key?.trim() || process.env.GEMINI_API_KEY || null;
}

export async function handleWebSocketMessage(ws: ServerWebSocket<{ session: SessionState | null }>, raw: string) {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    return;
  }

  const msgType = data.type;
  let state = ws.data.session;

  if (msgType === 'start') {
    const config: SessionConfig = data.config ?? {};
    const sessionId = crypto.randomUUID();
    const apiKey = getApiKey(config);

    state = {
      sessionId,
      exercise: config.exercise ?? '',
      config,
      startedAt: Date.now(),
      batchCount: 0,
      totalReps: 0,
      gemini: null,
    };
    ws.data.session = state;

    if (apiKey) {
      const systemPrompt = await getSystemPrompt();

      const callbacks: GeminiCallbacks = {
        onAudio: (b64Audio: string) => {
          ws.send(
            JSON.stringify({
              type: 'audio_chunk',
              pcm16_b64: b64Audio,
              sample_rate_hz: 24000,
              channels: 1,
            }),
          );
        },
        onText: (text: string) => {
          ws.send(JSON.stringify({ type: 'transcript', role: 'agent', text }));
        },
        onError: (message: string) => {
          console.error(`Gemini error [${sessionId}]: ${message}`);
          ws.send(JSON.stringify({ type: 'error', message }));
        },
        onFunctionCall: async (name: string, args: Record<string, any>) => {
          if (name === 'set_exercise') {
            const exerciseId = args.exercise_id ?? '';
            const exerciseConfig = await getExerciseConfig(exerciseId);
            if (!exerciseConfig) {
              return { error: `Exercise '${exerciseId}' not found` };
            }
            ws.send(
              JSON.stringify({
                type: 'set_exercise',
                exercise_id: exerciseId,
                config: exerciseConfig,
              }),
            );
            if (state) state.exercise = exerciseId;
            console.log(`Exercise switched to ${exerciseId} [${sessionId}]`);
            return { success: true, exercise_id: exerciseId };
          }
          return { error: `Unknown function: ${name}` };
        },
        onInputTranscript: (text: string) => {
          ws.send(JSON.stringify({ type: 'transcript', role: 'user', text }));
        },
        onOutputTranscript: (text: string) => {
          ws.send(JSON.stringify({ type: 'transcript', role: 'agent', text }));
        },
      };

      const gemini = new GeminiLiveSession(apiKey, systemPrompt, callbacks);
      try {
        await gemini.connect();
        state.gemini = gemini;
        console.log(`SESSION STARTED [${sessionId}] exercise=${config.exercise} with Gemini Live`);
      } catch (err: any) {
        console.error(`Gemini Live connect failed: ${err} — running without AI`);
        ws.send(JSON.stringify({ type: 'error', message: `Gemini connect failed: ${err}` }));
      }
    } else {
      console.log(`SESSION STARTED [${sessionId}] exercise=${config.exercise} (no API key)`);
    }

    ws.send(
      JSON.stringify({
        type: 'session_started',
        session_id: sessionId,
        config,
        gemini_connected: state.gemini !== null,
      }),
    );
  } else if (msgType === 'chat') {
    const text = data.text?.trim();
    if (!text || !state) return;

    if (state.gemini) {
      await state.gemini.sendText(text);
      ws.send(JSON.stringify({ type: 'transcript', role: 'user', text }));
    } else {
      ws.send(JSON.stringify({ type: 'transcript', role: 'user', text }));
      ws.send(
        JSON.stringify({
          type: 'transcript',
          role: 'agent',
          text: 'AI coaching requires a Gemini API key. Add one in Settings.',
        }),
      );
    }
  } else if (msgType === 'audio_chunk') {
    if (!state?.gemini) return;
    const pcm16B64 = data.pcm16_b64;
    if (pcm16B64) {
      // Fire-and-forget — don't await to prevent backpressure on rapid audio chunks
      state.gemini.sendAudio(pcm16B64);
    }
  } else if (msgType === 'batch') {
    if (!state) return;
    const payload = data.payload ?? {};
    state.batchCount++;
    const repCount = payload.workout_status?.rep_count ?? 0;
    state.totalReps = Math.max(state.totalReps, repCount);

    if (state.gemini && (payload.form_events?.length || payload.angle_values)) {
      const context = buildCoachingPrompt({
        exercise: payload.exercise ?? state.exercise,
        repCount,
        formEvents: payload.form_events ?? [],
        formIssues: payload.workout_status?.form_issues ?? [],
        currentScore: payload.workout_status?.current_score ?? 0,
        holdDuration: payload.workout_status?.hold_duration ?? null,
        angleValues: payload.angle_values ?? null,
      });
      await state.gemini.sendGroundingContext({
        exercise: payload.exercise ?? state.exercise,
        context,
      });
    }

    ws.send(JSON.stringify({ type: 'batch_ack', batch_number: state.batchCount }));
  } else if (msgType === 'end') {
    if (state?.gemini) {
      await state.gemini.close();
      state.gemini = null;
    }

    const duration = state ? (Date.now() - state.startedAt) / 1000 : 0;
    const summary = {
      session_id: state?.sessionId ?? null,
      exercise: state?.exercise ?? '',
      duration_seconds: Math.round(duration * 10) / 10,
      total_batches: state?.batchCount ?? 0,
      total_reps: state?.totalReps ?? 0,
    };

    ws.send(JSON.stringify({ type: 'session_ended', summary }));
    console.log(`SESSION ENDED [${state?.sessionId}] duration=${duration.toFixed(1)}s batches=${state?.batchCount} reps=${state?.totalReps}`);
    ws.data.session = null;
  } else if (msgType === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
  }
}

export async function handleWebSocketClose(ws: ServerWebSocket<{ session: SessionState | null }>) {
  const state = ws.data.session;
  if (state?.gemini) {
    await state.gemini.close();
  }
  console.log(`WebSocket disconnected [${state?.sessionId ?? 'no-session'}]`);
  ws.data.session = null;
}

interface SessionState {
  sessionId: string;
  exercise: string;
  config: SessionConfig;
  startedAt: number;
  batchCount: number;
  totalReps: number;
  gemini: GeminiLiveSession | null;
}
