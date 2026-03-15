import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

interface AudioCaptureOptions {
  noiseGateThreshold?: number; // RMS threshold (0-1) to consider audio as speech
  sampleRate?: number;
  chunkIntervalMs?: number; // How often to check and send audio
}

interface AudioCaptureState {
  isCapturing: boolean;
  isSpeaking: boolean;
  volume: number;
}

/**
 * Hook for capturing microphone audio with a noise gate.
 * Only produces audio chunks when volume exceeds the threshold.
 */
export function useAudioCapture(options: AudioCaptureOptions = {}) {
  const { noiseGateThreshold = 0.02, chunkIntervalMs = 2000 } = options;

  const [state, setState] = useState<AudioCaptureState>({
    isCapturing: false,
    isSpeaking: false,
    volume: 0,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const rafRef = useRef<number>(0);
  const onChunkRef = useRef<((b64: string) => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const start = useCallback(async (onChunk: (b64Audio: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      onChunkRef.current = onChunk;

      const ctx = new AudioContext({ sampleRate: 16000 });
      contextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Use ScriptProcessor to capture PCM data
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      let isSpeaking = false;

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

        isSpeaking = rms > noiseGateThreshold;
        if (isSpeaking) {
          chunksRef.current.push(new Float32Array(data));
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      // Periodically flush audio chunks
      intervalRef.current = setInterval(() => {
        if (chunksRef.current.length > 0) {
          const allSamples = mergeChunks(chunksRef.current);
          chunksRef.current = [];
          const b64 = float32ToBase64PCM(allSamples);
          onChunkRef.current?.(b64);
        }
      }, chunkIntervalMs);

      // Volume meter via analyser
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        setState({ isCapturing: true, isSpeaking, volume: avg });
        rafRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      setState({ isCapturing: true, isSpeaking: false, volume: 0 });
    } catch (err) {
      console.error('Mic capture failed:', err);
    }
  }, [noiseGateThreshold, chunkIntervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    processorRef.current?.disconnect();
    contextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    chunksRef.current = [];
    setState({ isCapturing: false, isSpeaking: false, volume: 0 });
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { ...state, start, stop };
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function float32ToBase64PCM(samples: Float32Array): string {
  // Convert float32 [-1,1] to int16 PCM
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
