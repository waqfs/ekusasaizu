import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

const INPUT_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 640; // 40ms of audio at 16kHz — matches Gemini's optimal chunk size

interface AudioCaptureOptions {
  noiseGateThreshold?: number; // RMS threshold (0-1) for the speaking UI indicator
}

interface AudioCaptureState {
  isCapturing: boolean;
  isSpeaking: boolean;
  volume: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function int16ToBase64(input: Int16Array): string {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  let binary = '';
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    binary += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return btoa(binary);
}

function downsampleTo16k(input: Float32Array, sourceSampleRate: number): Float32Array {
  if (sourceSampleRate === INPUT_SAMPLE_RATE) return input;
  const ratio = sourceSampleRate / INPUT_SAMPLE_RATE;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < output.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accumulator = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
      accumulator += input[i];
      count++;
    }
    output[offsetResult] = accumulator / Math.max(1, count);
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return output;
}

/**
 * Hook for capturing microphone audio and streaming PCM16 chunks.
 *
 * Matches the reference implementation's approach:
 * - ScriptProcessor with 1024 buffer (~21ms callbacks at 48kHz)
 * - Immediate sending of 640-sample Int16 chunks (40ms of audio)
 * - No interval-based batching — minimal latency
 */
export function useAudioCapture(options: AudioCaptureOptions = {}) {
  const { noiseGateThreshold = 0.02 } = options;

  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    isSpeaking: false,
    volume: 0,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const pendingSamplesRef = useRef<number[]>([]);
  const onChunkRef = useRef<((b64: string) => void) | null>(null);

  const start = useCallback(
    async (onChunk: (b64Audio: string) => void) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
        onChunkRef.current = onChunk;
        pendingSamplesRef.current = [];

        const ctx = new AudioContext();
        contextRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume();
        const nativeSampleRate = ctx.sampleRate;

        const source = ctx.createMediaStreamSource(stream);

        // Small buffer (1024) for low-latency callbacks (~21ms at 48kHz)
        const processor = ctx.createScriptProcessor(1024, 1, 1);
        processorRef.current = processor;

        // Mute gain node prevents feedback loop
        const mute = ctx.createGain();
        mute.gain.value = 0;
        muteRef.current = mute;

        processor.onaudioprocess = e => {
          const data = e.inputBuffer.getChannelData(0);

          // Calculate RMS for UI
          let energy = 0;
          for (let i = 0; i < data.length; i++) {
            energy += data[i] * data[i];
          }
          const rms = Math.sqrt(energy / data.length);
          const isSpeaking = rms > noiseGateThreshold;
          setState({ isCapturing: true, isSpeaking, volume: clamp(rms * 8, 0, 1) });

          // Downsample to 16kHz and accumulate
          const downsampled = downsampleTo16k(data, nativeSampleRate);
          const pending = pendingSamplesRef.current;
          for (let i = 0; i < downsampled.length; i++) {
            const s = clamp(downsampled[i], -1, 1);
            pending.push(s < 0 ? s * 32768 : s * 32767);
          }

          // Send 640-sample chunks immediately — no batching delay
          while (pending.length >= CHUNK_SAMPLES) {
            const pcmChunk = Int16Array.from(pending.splice(0, CHUNK_SAMPLES));
            onChunkRef.current?.(int16ToBase64(pcmChunk));
          }
        };

        source.connect(processor);
        processor.connect(mute);
        mute.connect(ctx.destination);

        setState({ isCapturing: true, isSpeaking: false, volume: 0 });
      } catch (err) {
        console.error('Mic capture failed:', err);
      }
    },
    [noiseGateThreshold],
  );

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    muteRef.current?.disconnect();
    contextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    pendingSamplesRef.current = [];
    setState({ isCapturing: false, isSpeaking: false, volume: 0 });
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { ...state, start, stop };
}
