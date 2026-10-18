'use client';

import { useState } from 'react';
import { Zap, Globe, Shield, ArrowRight, User } from 'lucide-react';
import type { Room } from '@/lib/types';
import { SUPPORTED_LANGUAGES } from '@/lib/types';
import { formatRoomCode } from '@/lib/roomCode';
import { ThemeToggle } from '@/components/ThemeToggle';

type Props = {
  room: Room;
  onJoin: (displayName: string, languageCode: string, languageName: string) => Promise<void>;
  error?: string;
};

export function JoinRoomModal({ room, onJoin, error }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [languageCode, setLanguageCode] = useState('en');
  const [isJoining, setIsJoining] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || isJoining) return;

    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === languageCode)!;
    setIsJoining(true);
    await onJoin(displayName.trim(), languageCode, lang.name);
    setIsJoining(false);
  }

  return (
    <div className="min-h-screen hero-gradient grid-pattern flex flex-col justify-between p-4 sm:p-6 transition-colors">
      {/* Top bar with logo and theme toggle */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Zap className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            CROSSWIRE
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Center card */}
      <div className="w-full max-w-md mx-auto my-auto">
        {/* Room badge */}
        <div className="text-center mb-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-1">
            Private Argument Session
          </span>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            <span className="text-xs text-slate-500 dark:text-zinc-400">Code:</span>
            <span className="font-mono text-sm font-bold tracking-widest text-slate-900 dark:text-white">
              {formatRoomCode(room.code)}
            </span>
          </div>
        </div>

        {/* Minimal card */}
        <div className="minimal-card rounded-2xl p-6 sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5">
            Join the Argument
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            Enter your name and pick your native language. You will speak and type in your tongue; your partner hears and reads in theirs.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name */}
            <div>
              <label htmlFor="name-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                Your Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <input
                  id="name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Elena, Rahul, Kenji..."
                  maxLength={30}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-800 dark:focus:border-zinc-600 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label htmlFor="language-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1.5">
                Your Native Language
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                <select
                  id="language-select"
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  className="w-full h-11 pl-10 pr-8 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white text-sm focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-800 dark:focus:border-zinc-600 outline-none transition-colors cursor-pointer appearance-none"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                      {lang.name} — {lang.nativeName}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Enter Button */}
            <button
              type="submit"
              disabled={!displayName.trim() || isJoining}
              className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl font-medium text-sm text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs active:scale-[0.99]"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Entering Session...</span>
                </>
              ) : (
                <>
                  <span>Enter the Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 mt-4 text-center">
          <Shield className="w-3.5 h-3.5" />
          <span>Peer-to-peer room strictly limited to 2 participants.</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-400 dark:text-zinc-600 py-2">
        CROSSWIRE Multilingual Architecture
      </footer>
    </div>
  );
}
