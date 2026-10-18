'use client';

import { Volume2, VolumeX, Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import type { Message, Participant } from '@/lib/types';
import { getLanguageByCode } from '@/lib/types';

type Props = {
  messages: Message[];
  userId: string;
  currentParticipant: Participant;
  otherParticipant: Participant | null;
  currentlyPlayingId: string | null;
  onPlay: (msg: Message) => void;
  onRetry?: (msg: Message) => void;
  canPlay: boolean;
};

export function MessageList({
  messages,
  userId,
  currentParticipant,
  otherParticipant,
  currentlyPlayingId,
  onPlay,
  onRetry,
  canPlay,
}: Props) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">
      {messages.map((msg) => {
        const isMe = msg.sender_id === userId;
        const isPlaying = currentlyPlayingId === msg.id;

        // Multi-participant translation resolution:
        // If msg.translations exists, resolve the translation specifically intended for my language!
        const myTranslation = msg.translations?.[currentParticipant.language_code];
        const effectiveTranslatedText = myTranslation?.translated_text ?? msg.translated_text;
        const effectiveTargetLangCode = myTranslation
          ? currentParticipant.language_code
          : (msg.target_language || currentParticipant.language_code);
        const effectiveStatus = myTranslation?.translation_status ?? msg.translation_status;

        // Resolve languages reliably from message metadata
        const sourceLang = getLanguageByCode(
          msg.source_language ||
            (isMe
              ? currentParticipant.language_code
              : otherParticipant?.language_code || 'en')
        );
        const targetLang = getLanguageByCode(effectiveTargetLangCode);

        return (
          <div
            key={msg.id}
            id={`message-${msg.id}`}
            className={`flex ${isMe ? 'justify-end' : 'justify-start'} fade-in`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[78%] rounded-2xl overflow-hidden transition-all shadow-xs border ${
                isMe
                  ? 'bg-rose-50/90 border-rose-200 text-slate-900 dark:bg-rose-950/25 dark:border-rose-900/50 dark:text-zinc-100'
                  : 'bg-sky-50/90 border-sky-200 text-slate-900 dark:bg-sky-950/25 dark:border-sky-900/50 dark:text-zinc-100'
              }`}
            >
              {/* Header row: Sender name & timestamp */}
              <div
                className={`px-4 pt-3 pb-1.5 flex items-center justify-between gap-3 text-xs font-semibold ${
                  isMe ? 'text-rose-700 dark:text-rose-400' : 'text-sky-700 dark:text-sky-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{msg.sender_name}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-zinc-900/70 border border-black/5 dark:border-white/10 text-slate-600 dark:text-zinc-300">
                    {isMe ? 'You' : 'Partner'}
                  </span>
                </div>
                <span className="text-[11px] font-normal text-slate-400 dark:text-zinc-500 flex-shrink-0">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* 1. ORIGINAL SECTION (Always Visible & Labeled Clearly) */}
              <div className="px-4 py-2">
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Original · {sourceLang.name}</span>
                </div>
                <p className="text-sm text-slate-900 dark:text-white leading-relaxed font-normal whitespace-pre-wrap select-text">
                  {msg.original_text}
                </p>
              </div>

              {/* Section Divider */}
              <div
                className={`mx-4 border-t ${
                  isMe
                    ? 'border-rose-200/80 dark:border-rose-900/40'
                    : 'border-sky-200/80 dark:border-sky-900/40'
                }`}
              />

              {/* 2. TRANSLATION SECTION (Labeled Clearly: Translation · [Language]) */}
              <div className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span>Translation · {targetLang.name}</span>
                  </div>

                  {effectiveStatus === 'translated' && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 normal-case font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Synced</span>
                    </div>
                  )}
                </div>

                {/* Status: Pending */}
                {effectiveStatus === 'pending' && (
                  <div className="flex items-center gap-2 py-1 text-slate-500 dark:text-zinc-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>Translating live into {targetLang.name}...</span>
                  </div>
                )}

                {/* Status: Translated */}
                {effectiveStatus === 'translated' && effectiveTranslatedText && (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-200 leading-relaxed font-medium flex-1 whitespace-pre-wrap select-text">
                        &ldquo;{effectiveTranslatedText}&rdquo;
                      </p>

                      {/* Manual Audio Playback Button */}
                      {canPlay && (
                        <button
                          onClick={() => onPlay(msg)}
                          type="button"
                          aria-label={isPlaying ? 'Stop audio playback' : `Play translated audio in ${targetLang.name}`}
                          title={isPlaying ? 'Stop audio playback' : `Play translated audio in ${targetLang.name}`}
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-all border cursor-pointer ${
                            isPlaying
                              ? 'bg-sky-500 text-white border-sky-500 ring-2 ring-sky-300 dark:ring-sky-700'
                              : 'bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border-slate-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:hover:text-white dark:border-zinc-700 hover:shadow-xs'
                          }`}
                        >
                          {isPlaying ? (
                            <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Waveform playback indicator when streaming audio */}
                    {isPlaying && (
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                        <div className="flex items-center gap-1">
                          {[12, 16, 8, 18, 14, 10].map((h, i) => (
                            <div
                              key={i}
                              className="wave-bar w-0.5 rounded-full bg-sky-600 dark:bg-sky-400"
                              style={{ height: `${h}px` }}
                            />
                          ))}
                        </div>
                        <span>Playing Voice ({targetLang.name})</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status: Failed */}
                {msg.translation_status === 'failed' && (
                  <div className="flex items-center justify-between gap-2 py-1">
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Translation into {targetLang.name} failed</span>
                    </div>

                    {onRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(msg)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 transition-colors cursor-pointer"
                        title="Retry translation"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
