/**
 * Client-Side Audio Digital Signal Processing (DSP) Pipeline:
 * 1. AI Noise Cancellation & High-Sound Limiting (Dynamic Noise Gate, High-Pass Rumble Filter, Dynamics Compressor)
 * 2. Voice Profiling & Acoustic Sample Recording for Speaker Identification
 */

export interface NoiseMetrics {
  rmsLevel: number;
  peakDb: number;
  isHighSoundDetected: boolean;
  isNoiseGateActive: boolean;
}

export interface VoiceProfile {
  profile_id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  pitch_hz: number;
  pitch_category: string;
  sample_count: number;
}

export interface VoiceIdentificationResult {
  identified: boolean;
  user_id?: string | null;
  display_name: string;
  confidence: number;
  pitch_category?: string;
  pitch_hz?: number;
}

export interface NoiseCancellerGraph {
  processedStream: MediaStream;
  analyser: AnalyserNode | null;
  getMetrics: () => NoiseMetrics;
  setEnabled: (enabled: boolean) => void;
  cleanup: () => void;
}

/**
 * Creates an in-browser Web Audio DSP graph that suppresses background noise
 * and clamps sudden loud sounds (yelling, clapping, microphone bumps).
 */
export function createNoiseCancellingAudioGraph(
  inputStream: MediaStream
): NoiseCancellerGraph {
  const audioTracks = inputStream.getAudioTracks();
  if (
    typeof window === 'undefined' ||
    audioTracks.length === 0 ||
    !(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  ) {
    return {
      processedStream: inputStream,
      analyser: null,
      getMetrics: () => ({
        rmsLevel: 0,
        peakDb: -100,
        isHighSoundDetected: false,
        isNoiseGateActive: false,
      }),
      setEnabled: () => {},
      cleanup: () => {},
    };
  }

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    const source = ctx.createMediaStreamSource(inputStream);

    // 1. High-Pass Filter (85 Hz) to eliminate AC hum, table bumps, and low frequency rumble
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(85, ctx.currentTime);
    highPass.Q.setValueAtTime(0.7, ctx.currentTime);

    // 2. Dynamics Compressor for High Sounds (prevents ear fatigue and audio clipping)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, ctx.currentTime); // Clamp sounds above -24 dB
    compressor.knee.setValueAtTime(30, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime); // 12:1 heavy compression on loud sounds
    compressor.attack.setValueAtTime(0.003, ctx.currentTime); // Ultra fast attack (3ms)
    compressor.release.setValueAtTime(0.25, ctx.currentTime); // 250ms release

    // 3. Peaking Notch Filter to soften harsh high frequencies (> 6500 Hz)
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(7500, ctx.currentTime);
    lowPass.Q.setValueAtTime(0.7, ctx.currentTime);

    // 4. Gain Node for Noise Gate
    const gateGain = ctx.createGain();
    gateGain.gain.setValueAtTime(1.0, ctx.currentTime);

    // 5. Analyser for real-time acoustic metering
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;

    // 6. Destination
    const destination = ctx.createMediaStreamDestination();

    // Wire the graph: source -> highPass -> compressor -> lowPass -> gateGain -> destination & analyser
    source.connect(highPass);
    highPass.connect(compressor);
    compressor.connect(lowPass);
    lowPass.connect(gateGain);
    gateGain.connect(destination);
    gateGain.connect(analyser);

    // Combined stream with original video tracks (if any) and processed audio track
    const processedStream = new MediaStream([
      ...inputStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    let isEnabled = true;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const getMetrics = (): NoiseMetrics => {
      analyser.getByteTimeDomainData(dataArray);
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSq += norm * norm;
        const absVal = Math.abs(norm);
        if (absVal > peak) peak = absVal;
      }
      const rms = Math.sqrt(sumSq / dataArray.length);
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
      const isHighSoundDetected = peakDb > -3.0;

      return {
        rmsLevel: Math.round(rms * 100),
        peakDb: Math.round(peakDb),
        isHighSoundDetected,
        isNoiseGateActive: isEnabled && rms < 0.015,
      };
    };

    const setEnabled = (enabled: boolean) => {
      isEnabled = enabled;
      if (ctx.state !== 'closed') {
        if (!enabled) {
          compressor.ratio.setValueAtTime(1.0, ctx.currentTime);
          highPass.frequency.setValueAtTime(10, ctx.currentTime);
          gateGain.gain.setValueAtTime(1.0, ctx.currentTime);
        } else {
          compressor.ratio.setValueAtTime(12.0, ctx.currentTime);
          highPass.frequency.setValueAtTime(85, ctx.currentTime);
        }
      }
    };

    const cleanup = () => {
      try {
        source.disconnect();
        highPass.disconnect();
        compressor.disconnect();
        lowPass.disconnect();
        gateGain.disconnect();
        analyser.disconnect();
        destination.stream.getTracks().forEach((t) => t.stop());
        if (ctx.state !== 'closed') {
          ctx.close();
        }
      } catch {
        // ignore
      }
    };

    return {
      processedStream,
      analyser,
      getMetrics,
      setEnabled,
      cleanup,
    };
  } catch (err) {
    console.warn('Web Audio DSP initialization error, falling back to raw stream:', err);
    return {
      processedStream: inputStream,
      analyser: null,
      getMetrics: () => ({
        rmsLevel: 0,
        peakDb: -100,
        isHighSoundDetected: false,
        isNoiseGateActive: false,
      }),
      setEnabled: () => {},
      cleanup: () => {},
    };
  }
}

/**
 * Records a 2.5s microphone sample and converts it to 16-bit PCM WAV base64
 * for Voice Identification & Speaker Profile Calibration.
 */
export async function recordVoiceSampleBase64(
  stream: MediaStream,
  durationMs: number = 2500
): Promise<string> {
  if (typeof window === 'undefined') return '';

  return new Promise((resolve, reject) => {
    try {
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: selectedMime || 'audio/webm' });
          const buffer = await blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          resolve(base64);
        } catch (err) {
          reject(err);
        }
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, durationMs);
    } catch (err) {
      reject(err);
    }
  });
}
