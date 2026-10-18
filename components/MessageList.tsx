'use client';

import { Volume2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Message, Participant } from '@/lib/types';
import { getLanguageByCode } from '@/lib/types';

type Props = {
  messages: Message[];
  userId: string;
  currentParticipant: Participant;
  otherParticipant: Participant | null;
  currentlyPlayingId: string | null;
  onPlay: (msg: Message) => void;
  canPlay: boolean;
};

export function MessageList({
  messages,
  userId,
  currentParticipant,
  otherParticipant,
  currentlyPlayingId,
  onPlay,
  canPlay,
}: Props) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full">
      {messages.map((msg) => {
        const isMe = msg.sender_id === userId;
        const isPlaying = currentlyPlayingId === msg.id;
        const displayLang = isMe
          ? getLanguageByCode(currentParticipant.language_code)
          : otherParticipant
          ? getLanguageByCode(otherParticipant.language_code)
          : null;

        return (
          <div
            key={msg.id}
            className={`flex ${isMe ? 'justify-end' : 'justify-start'} fade-in`}
          >
            <div
              className={`max-w-[88%] sm:max-w-[75%] rounded-2xl overflow-hidden transition-all shadow-xs ${
                isMe
                  ? 'bg-rose-50/80 border border-rose-200 text-slate-900 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-zinc-100'
                  : 'bg-sky-50/80 border border-sky-200 text-slate-900 dark:bg-sky-950/20 dark:border-sky-900/40 dark:text-zinc-100'
              }`}
            >
              {/* Header row: Sender name, language tag, and time */}
              <div
                className={`px-4 pt-3 pb-1.5 flex items-center justify-between gap-3 text-xs font-semibold ${
                  isMe ? 'text-rose-700 dark:text-rose-400' : 'text-sky-700 dark:text-sky-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{msg.sender_name}</span>
                  {displayLang && (
                    <span className="text-[11px] font-normal px-1.5 py-0.5 rounded bg-white/60 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 border border-black/5 dark:border-white/5">
                      {displayLang.name}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-normal text-slate-400 dark:text-zinc-500 flex-shrink-0">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Original spoken / typed text */}
              <div className="px-4 py-2">
                <p className="text-sm text-slate-900 dark:text-white leading-relaxed font-normal">
                  {msg.original_text}
                </p>
              </div>

              {/* Translation section divider */}
              {(msg.translation_status === 'translated' ||
                msg.translation_status === 'pending' ||
                msg.translation_status === 'failed') && (
                <div
                  className={`mx-4 border-t ${
                    isMe
                      ? 'border-rose-200/80 dark:border-rose-900/30'
                      : 'border-sky-200/80 dark:border-sky-900/30'
                  }`}
                />
              )}

              {/* Translation content */}
              <div className="px-4 py-2.5">
                {msg.translation_status === 'pending' && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    <span>Translating live...</span>
                  </div>
                )}

                {msg.translation_status === 'translated' && msg.translated_text && (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed italic flex-1">
                        &ldquo;{msg.translated_text}&rdquo;
                      </p>

                      {/* Manual play button */}
                      {canPlay && (
                        <button
                          onClick={() => onPlay(msg)}
                          type="button"
                          title={isPlaying ? 'Replaying translation audio...' : 'Play translated audio'}
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-colors border ${
                            isPlaying
                              ? 'bg-sky-500 text-white border-sky-500'
                              : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-700'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Target language indicator */}
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>
                        Translated to{' '}
                        <strong className="font-semibold text-slate-700 dark:text-zinc-300">
                          {isMe
                            ? otherParticipant
                              ? getLanguageByCode(otherParticipant.language_code).name
                              : msg.target_language
                            : getLanguageByCode(currentParticipant.language_code).name}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                {msg.translation_status === 'failed' && (
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Translation failed</span>
                  </div>
                )}
              </div>

              {/* Waveform playback indicator */}
              {isPlaying && (
                <div className="px-4 pb-3 flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="wave-bar w-0.5 rounded-full bg-sky-600 dark:bg-sky-400"
                        style={{ height: '14px' }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 ml-1">
                    Streaming Audio
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
