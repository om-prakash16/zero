'use client';

import { useState } from 'react';
import { Zap, Copy, Check, Wifi, WifiOff, Users } from 'lucide-react';
import type { Room, Participant, ConversationStatus } from '@/lib/types';
import { formatRoomCode } from '@/lib/roomCode';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';

type Props = {
  room: Room;
  currentParticipant: Participant;
  otherParticipant: Participant | null;
  connectionError: string;
  status: ConversationStatus;
};

const STATUS_LABELS: Record<ConversationStatus, { label: string; lightColor: string; darkColor: string; dot: string }> = {
  idle: { label: 'Ready', lightColor: 'text-slate-500', darkColor: 'dark:text-zinc-400', dot: 'bg-slate-400' },
  listening: { label: 'Listening...', lightColor: 'text-emerald-600', darkColor: 'dark:text-emerald-400', dot: 'bg-emerald-500' },
  speaking: { label: 'Processing speech...', lightColor: 'text-amber-600', darkColor: 'dark:text-amber-400', dot: 'bg-amber-500' },
  translating: { label: 'Translating...', lightColor: 'text-indigo-600', darkColor: 'dark:text-indigo-400', dot: 'bg-indigo-500' },
  playing: { label: 'Playing audio...', lightColor: 'text-sky-600', darkColor: 'dark:text-sky-400', dot: 'bg-sky-500' },
  interrupted: { label: 'Interrupted!', lightColor: 'text-rose-600', darkColor: 'dark:text-rose-400', dot: 'bg-rose-500' },
  waiting: { label: 'Waiting for partner...', lightColor: 'text-slate-400', darkColor: 'dark:text-zinc-500', dot: 'bg-slate-300' },
  error: { label: 'Audio Error', lightColor: 'text-rose-600', darkColor: 'dark:text-rose-400', dot: 'bg-rose-500' },
};

export function RoomHeader({
  room,
  currentParticipant,
  otherParticipant,
  connectionError,
  status,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = async () => {
    try {
      const inviteUrl = `${window.location.origin}/room/${room.code}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = inviteUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy room URL:', err);
    }
  };

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.idle;

  return (
    <header className="flex-shrink-0 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="flex items-center justify-between px-4 sm:px-6 h-15 gap-3 max-w-7xl mx-auto w-full">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white hidden sm:inline">
            CROSSWIRE
          </span>
        </div>

        {/* Center: Participants & live status */}
        <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
          {/* Current Participant */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 flex-shrink-0">
            <span className="truncate max-w-[100px]">{currentParticipant.display_name}</span>
            <span className="text-[10px] uppercase font-semibold px-1 py-0.2 rounded bg-rose-200/50 dark:bg-rose-900/50">
              {currentParticipant.language_code}
            </span>
          </div>

          <span className="text-slate-300 dark:text-zinc-700 text-xs font-bold">↔</span>

          {/* Other Participant */}
          {otherParticipant ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/30 dark:border-sky-900/40 dark:text-sky-300 flex-shrink-0">
              <span className="truncate max-w-[100px]">{otherParticipant.display_name}</span>
              <span className="text-[10px] uppercase font-semibold px-1 py-0.2 rounded bg-sky-200/50 dark:bg-sky-900/50">
                {otherParticipant.language_code}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-zinc-500 border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Waiting for partner...</span>
              <span className="sm:hidden">Waiting...</span>
            </div>
          )}

          {/* Status badge */}
          <div className={`hidden md:flex items-center gap-1.5 text-xs font-medium ml-2 ${statusInfo.lightColor} ${statusInfo.darkColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${status === 'listening' || status === 'playing' ? 'animate-pulse' : ''}`} />
            <span>{statusInfo.label}</span>
          </div>
        </div>

        {/* Right: Room code copy & Theme Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center" title={connectionError ? connectionError : 'Realtime connection active'}>
            {connectionError ? (
              <WifiOff className="w-4 h-4 text-rose-500" />
            ) : (
              <Wifi className="w-4 h-4 text-emerald-500 opacity-80" />
            )}
          </div>

          <button
            onClick={copyRoomCode}
            type="button"
            title="Copy invite link to share"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300"
          >
            <span>{formatRoomCode(room.code)}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            )}
          </button>

          <ThemeToggle />
          <UserNav />
        </div>
      </div>

      {/* Connection error banner */}
      {connectionError && (
        <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 text-center font-medium">
          {connectionError}
        </div>
      )}
    </header>
  );
}
