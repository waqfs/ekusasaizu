/**
 * Gemini Live API session manager (Bun/TypeScript).
 *
 * Uses the @google/genai JS SDK for bidirectional streaming —
 * the same SDK that works fast in the reference implementation.
 *
 * Model: gemini-2.5-flash-native-audio-preview-12-2025
 * Audio input:  16 kHz mono PCM16 LE
 * Audio output: 24 kHz mono PCM16 LE
 */

import { GoogleGenAI, Modality, Type, type Session } from '@google/genai';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export interface GeminiCallbacks {
  onAudio: (b64Audio: string) => void;
  onText: (text: string) => void;
  onError: (message: string) => void;
  onInterrupted?: () => void;
  onFunctionCall?: (name: string, args: Record<string, any>) => Promise<Record<string, any>>;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
}

export class GeminiLiveSession {
  private session: Session | null = null;
  private ai: GoogleGenAI;
  private systemInstruction: string;
  private callbacks: GeminiCallbacks;
  private running = false;

  constructor(apiKey: string, systemInstruction: string, callbacks: GeminiCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
    this.systemInstruction = systemInstruction;
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    try {
      this.running = true;
      this.session = await this.ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'set_exercise',
                  description:
                    'Switch the client to a different exercise. Call this when the user wants to change exercises or you want to recommend a new exercise.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      exercise_id: {
                        type: Type.STRING,
                        description: "The exercise ID to switch to (e.g. 'squat', 'lat_pull_down').",
                      },
                    },
                    required: ['exercise_id'],
                  },
                },
                {
                  name: 'get_rep_count',
                  description: 'Get the current rep count for the active exercise.',
                },
                {
                  name: 'get_exercise',
                  description: 'Get the currently set exercise ID.',
                },
                {
                  name: 'is_person_in_view',
                  description:
                    'Check whether the person is currently visible in the camera for the active exercise. If not in view, returns which body regions are required.',
                },
                {
                  name: 'get_checkpoint',
                  description:
                    'Get the current stage/checkpoint the person is on according to MediaPipe pose tracking (e.g. top, descending, bottom, ascending).',
                },
                {
                  name: 'get_form',
                  description:
                    'Get detailed form analysis for the current exercise: per-rep scores, joint angles at key phases, recurring form issues, and trend data. Use this to give specific form improvement advice or when the user asks about their form.',
                },
                {
                  name: 'set_rep_goal',
                  description: 'Set a rep goal for the current exercise. Use when the user says something like "let\'s do 10 reps" or "I want to do 15 squats".',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      count: {
                        type: Type.NUMBER,
                        description: 'The target number of reps to complete.',
                      },
                    },
                    required: ['count'],
                  },
                },
                {
                  name: 'increase_rep_goal',
                  description: 'Increase the current rep goal by a given amount. Use when the user says "let\'s do another 10" or "add 5 more reps".',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      count: {
                        type: Type.NUMBER,
                        description: 'The number of additional reps to add to the current goal.',
                      },
                    },
                    required: ['count'],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session connected');
          },
          onmessage: (msg: any) => {
            this.handleMessage(msg);
          },
          onerror: (err: any) => {
            console.error('Gemini Live error:', err);
            this.callbacks.onError(String(err?.message ?? err));
          },
          onclose: (ev: any) => {
            console.log('Gemini Live session closed:', ev?.reason ?? 'unknown');
            if (this.running) {
              // Unexpected close — try reconnect
              this.reconnect();
            }
          },
        },
      });
    } catch (err: any) {
      this.callbacks.onError(`connect_failed: ${err?.message ?? err}`);
      throw err;
    }
  }

  private handleMessage(msg: any): void {
    const sc = msg?.serverContent;

    // Handle tool calls — these come at the top level, separate from serverContent
    if (msg?.toolCall?.functionCalls) {
      console.log('Gemini tool call:', JSON.stringify(msg.toolCall));
      for (const fc of msg.toolCall.functionCalls) {
        if (this.callbacks.onFunctionCall) {
          this.callbacks
            .onFunctionCall(fc.name, fc.args ?? {})
            .then(result => {
              console.log('Sending tool response:', JSON.stringify({ id: fc.id, name: fc.name, result }));
              this.session?.sendToolResponse({
                functionResponses: [
                  {
                    id: fc.id,
                    name: fc.name,
                    response: result,
                  },
                ],
              });
            })
            .catch(err => {
              console.error('Function call handler error:', err);
            });
        }
      }
    }

    if (!sc) return;

    // Handle server-side interruption (user started speaking while Gemini was talking)
    if (sc.interrupted) {
      this.callbacks.onInterrupted?.();
    }

    // Handle audio + text from model turns
    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
          this.callbacks.onAudio(part.inlineData.data);
        } else if (part.text) {
          this.callbacks.onText(part.text);
        }
      }
    }

    // Handle transcriptions
    if (sc.inputTranscription?.text) {
      this.callbacks.onInputTranscript?.(sc.inputTranscription.text);
    }
    if (sc.outputTranscription?.text) {
      this.callbacks.onOutputTranscript?.(sc.outputTranscription.text);
    }
  }

  async sendAudio(pcm16B64: string): Promise<void> {
    if (!this.session) return;
    try {
      await this.session.sendRealtimeInput({
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: pcm16B64,
        },
      });
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes('1011') || msg.includes('ping') || msg.toLowerCase().includes('close')) {
        console.warn('Gemini disconnected during sendAudio, reconnecting...');
        this.reconnect();
      } else {
        this.callbacks.onError(`send_audio_failed: ${msg}`);
      }
    }
  }

  async sendText(text: string): Promise<void> {
    if (!this.session || !text.trim()) return;
    try {
      await this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: text.trim() }] }],
        turnComplete: true,
      });
    } catch (err: any) {
      this.callbacks.onError(`send_text_failed: ${err?.message ?? err}`);
    }
  }

  async sendGroundingContext(context: Record<string, any>): Promise<void> {
    if (!this.session) return;
    const compact = JSON.stringify({ workout_update: context });
    try {
      await this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: compact }] }],
        turnComplete: false,
      });
    } catch (err: any) {
      this.callbacks.onError(`send_context_failed: ${err?.message ?? err}`);
    }
  }

  async close(): Promise<void> {
    this.running = false;
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // ignore close errors
      }
      this.session = null;
    }
    console.log('Gemini Live session closed');
  }

  private async reconnect(): Promise<void> {
    if (!this.running) return;
    console.log('Reconnecting Gemini Live session...');
    try {
      if (this.session) {
        try {
          this.session.close();
        } catch {
          /* ignore */
        }
        this.session = null;
      }
      await this.connect();
      console.log('Gemini Live session reconnected');
    } catch (err: any) {
      console.error('Reconnect failed:', err);
      this.callbacks.onError(`reconnect_failed: ${err?.message ?? err}`);
    }
  }
}
