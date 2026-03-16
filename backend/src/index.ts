/**
 * Ekusasaizu backend — Bun server for live AI exercise coaching.
 *
 * Replaces the Python FastAPI backend with native Bun HTTP + WebSocket.
 * Uses the @google/genai JS SDK for fast Gemini Live connections.
 */

import { listExercises, getExerciseConfig } from './exercise-loader';
import { getSystemPrompt } from './coach-prompt';
import { handleWebSocketMessage, handleWebSocketClose } from './live-session';

const PORT = Number(process.env.PORT || 8000);

const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // --- WebSocket upgrade ---
    if (url.pathname === '/ws/session') {
      const upgraded = server.upgrade(req, {
        data: { session: null },
      });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // --- CORS preflight ---
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // --- REST endpoints ---

    if (url.pathname === '/health' && req.method === 'GET') {
      return json({ status: 'ok' });
    }

    if (url.pathname === '/api/exercises' && req.method === 'GET') {
      const exercises = await listExercises();
      return json(exercises);
    }

    // /api/exercises/{id}/config
    const configMatch = url.pathname.match(/^\/api\/exercises\/([^/]+)\/config$/);
    if (configMatch && req.method === 'GET') {
      const id = decodeURIComponent(configMatch[1]);
      const config = await getExerciseConfig(id);
      if (!config) return json({ error: `Exercise '${id}' not found` }, 404);
      return json(config);
    }

    if (url.pathname === '/api/system-prompt' && req.method === 'GET') {
      const prompt = await getSystemPrompt();
      return json({ prompt });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() });
  },

  websocket: {
    open(_ws) {
      console.log('WebSocket connected');
    },
    async message(ws, message) {
      const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
      await handleWebSocketMessage(ws as any, raw);
    },
    async close(ws, _code, _reason) {
      await handleWebSocketClose(ws as any);
    },
  },
});

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

console.log(`Ekusasaizu backend running on http://localhost:${PORT}`);
