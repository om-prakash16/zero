'use client';

import { Mic, Send, AlertTriangle, Square, Zap } from 'lucide-react';
import type { ConversationStatus, Participant } from '@/lib/types';
import { getLanguageByCode } from '@/lib/types';

type Props = {
  status: ConversationStatus;
  transcript: string;
  textInput: string;
  setTextInput: (v: string) => void;
  isMicActive: boolean;
  isInterrupting: boolean;
  speechError: string;
  translationError: string;
  currentParticipant: Participant;
  otherParticipant: Participant | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onInterrupt: () => void;
  onTextSend: (e: React.FormEvent) => void;
  speechSupported: boolean;
  synthSupported: boolean;
};

export function SpeakingPanel({
  status,
  transcript,
  textInput,
  setTextInput,
  isMicActive,
  isInterrupting,
  speechError,
  translationError,
  currentParticipant,
  otherParticipant,
  onStartListening,
  onStopListening,
  onInterrupt,
  onTextSend,
  speechSupported,
  synthSupported,
}: Props) {
  const myLang = getLanguageByCode(currentParticipant.language_code);
  const theirLang = otherParticipant
    ? getLanguageByCode(otherParticipant.language_code)
    : null;

  const isListeningOrActive = status === 'listening' || isMicActive;
  const isPlaying = status === 'playing';

  // Do NOT block text input while translation is in progress.
  // Both participants can send messages at any time.
  const isInputDisabled = !otherParticipant;

  return (
    <div className="flex-shrink-0 border-t border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md transition-colors">
      {/* Live speech transcript pill */}
      {transcript && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3 pb-0">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="truncate">&ldquo;{transcript}&rdquo;</span>
          </div>
        </div>
      )}

      {/* Error notification pill */}
      {(speechError || translationError) && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2">
          <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{speechError || translationError}</span>
          </div>
        </div>
      )}

      {/* Main input controls container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 space-y-3">
        {/* Language guidance indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>
              Your input:{' '}
              <strong className="text-slate-800 dark:text-zinc-200 font-semibold">
                {myLang.name} ({myLang.nativeName})
              </strong>
            </span>
          </div>

          {theirLang ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>
                Partner output:{' '}
                <strong className="text-slate-800 dark:text-zinc-200 font-semibold">
                  {theirLang.name}
                </strong>
              </span>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-zinc-500 text-[11px]">
              Waiting for 2nd participant to join...
            </span>
          )}
        </div>

        {/* Input & Mic Controls Row */}
        <div className="flex items-center gap-2.5">
          {/* Microphone button for speech input */}
          {speechSupported && (
            <button
              onClick={isListeningOrActive ? onStopListening : onStartListening}
              disabled={isInputDisabled && !isListeningOrActive}
              type="button"
              aria-label={isListeningOrActive ? 'Stop listening' : 'Start voice input'}
              title={
                isListeningOrActive
                  ? 'Stop speech recognition'
                  : `Start speaking in ${myLang.name}`
              }
              className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                isListeningOrActive
                  ? 'bg-rose-600 text-white mic-pulse shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                  : isInputDisabled
                  ? 'bg-slate-100 text-slate-300 dark:bg-zinc-900 dark:text-zinc-600 cursor-not-allowed border border-slate-200 dark:border-zinc-800'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-white border border-slate-200 dark:border-zinc-700 shadow-xs active:scale-95'
              }`}
            >
              {isListeningOrActive ? (
                <Square className="w-4 h-4 fill-white" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Text input form — fully non-blocking and bidirectional */}
          <form onSubmit={onTextSend} className="flex-1 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                !otherParticipant
                  ? 'Waiting for partner to join before sending...'
                  : `Type your point in ${myLang.name}...`
              }
              disabled={isInputDisabled}
              className="flex-1 h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-800 dark:focus:border-zinc-600 outline-hidden transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isInputDisabled}
              className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
              title="Send text message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* INTERRUPT Partner Action Button */}
        <button
          onClick={onInterrupt}
          disabled={isInterrupting || !otherParticipant}
          type="button"
          title={!synthSupported ? 'Audio synthesis is not supported on this device' : undefined}
          className={`w-full h-11 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 border cursor-pointer ${
            isPlaying
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 interrupt-pulse shadow-md shadow-rose-600/20 active:scale-[0.99]'
              : isInterrupting
              ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40 cursor-wait'
              : !otherParticipant
              ? 'bg-slate-50 text-slate-300 border-slate-200 dark:bg-zinc-900/50 dark:text-zinc-600 dark:border-zinc-800/80 cursor-not-allowed'
              : 'bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200 hover:border-rose-200 dark:bg-zinc-900 dark:hover:bg-rose-950/20 dark:text-zinc-300 dark:hover:text-rose-300 dark:border-zinc-800 dark:hover:border-rose-900/40 shadow-xs'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-rose-500" />
          <span>
            {isPlaying
              ? '⚡ Interrupt Translation (Cut In Now)'
              : isInterrupting
              ? 'Interrupting Partner...'
              : 'Interrupt Partner'}
          </span>
        </button>
      </div>
    </div>
  );
}
