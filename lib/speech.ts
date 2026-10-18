// Speech synthesis utilities for cross-browser support
import { getLanguageByCode } from './types';

type QueueItem = {
  text: string;
  langCode: string;
  onStart?: () => void;
  onEnd?: () => void;
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let playbackQueue: QueueItem[] = [];
let isPlaying = false;
let interruptionVersion = 0; // Monotonically increasing version to detect stale playback

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

export function isCurrentlySpeaking(): boolean {
  return isPlaying && currentUtterance !== null;
}

export function stopSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  interruptionVersion++; // Invalidate all queued playback
  playbackQueue = [];
  isPlaying = false;
  currentUtterance = null;
  window.speechSynthesis.cancel();
}

export function queueSpeech(
  text: string,
  languageCode: string,
  onStart?: () => void,
  onEnd?: () => void
): void {
  if (!isSpeechSynthesisSupported()) {
    onEnd?.();
    return;
  }

  playbackQueue.push({ text, langCode: languageCode, onStart, onEnd });
  if (!isPlaying) {
    processQueue();
  }
}

function processQueue(): void {
  if (playbackQueue.length === 0) {
    isPlaying = false;
    currentUtterance = null;
    return;
  }

  const capturedVersion = interruptionVersion;
  const { text, langCode, onStart, onEnd } = playbackQueue.shift()!;

  // Check if this playback was interrupted
  if (capturedVersion !== interruptionVersion) {
    onEnd?.();
    processQueue();
    return;
  }

  isPlaying = true;
  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  const lang = getLanguageByCode(langCode);
  utterance.lang = lang.speechCode;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a matching voice
  const voices = window.speechSynthesis.getVoices();
  const matchingVoice = voices.find(
    (v) => v.lang.startsWith(lang.speechCode.split('-')[0])
  );
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  utterance.onstart = () => {
    if (capturedVersion !== interruptionVersion) {
      window.speechSynthesis.cancel();
      return;
    }
    onStart?.();
  };

  utterance.onend = () => {
    currentUtterance = null;
    // Check if interrupted before calling onEnd
    if (capturedVersion === interruptionVersion) {
      onEnd?.();
      processQueue();
    } else {
      isPlaying = false;
    }
  };

  utterance.onerror = (e) => {
    console.warn('Speech synthesis error:', e.error);
    currentUtterance = null;
    isPlaying = false;
    onEnd?.();
    processQueue();
  };

  // Chromium quirk: resume paused speech queue before speaking
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  window.speechSynthesis.speak(utterance);
}

export function getAvailableVoiceLanguages(): string[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices().map((v) => v.lang.split('-')[0]);
}
