'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Users,
  Globe,
  Volume2,
  VolumeX,
  ChevronDown,
} from 'lucide-react';
import type { Room, Participant, ConversationStatus } from '@/lib/types';
import { formatRoomCode } from '@/lib/roomCode';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/lib/types';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';

type Props = {
  room: Room;
  currentParticipant: Participant;
  otherParticipant: Participant | null;
  connectionError: string;
  status: ConversationStatus;
  autoPlayVoice: boolean;
  onToggleAutoPlay: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onLanguageChange: (newLanguageCode: string) => Promise<void>;
};

const STATUS_LABELS: Record<
  ConversationStatus,
  { label: string; lightColor: string; darkColor: string; dot: string }
> = {
  idle: {
    label: 'Ready',
    lightColor: 'text-slate-500',
    darkColor: 'dark:text-zinc-400',
    dot: 'bg-slate-400',
  },
  listening: {
    label: 'Listening...',
    lightColor: 'text-emerald-600',
    darkColor: 'dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  speaking: {
    label: 'Processing speech...',
    lightColor: 'text-amber-600',
    darkColor: 'dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  translating: {
    label: 'Translating...',
    lightColor: 'text-indigo-600',
    darkColor: 'dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  playing: {
    label: 'Playing audio...',
    lightColor: 'text-sky-600',
    darkColor: 'dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  interrupted: {
    label: 'Interrupted!',
    lightColor: 'text-rose-600',
    darkColor: 'dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  waiting: {
    label: 'Waiting for partner...',
    lightColor: 'text-slate-400',
    darkColor: 'dark:text-zinc-500',
    dot: 'bg-slate-300',
  },
  error: {
    label: 'Audio Error',
    lightColor: 'text-rose-600',
    darkColor: 'dark:text-rose-400',
    dot: 'bg-rose-500',
  },
};

export function RoomHeader({
  room,
  currentParticipant,
  otherParticipant,
  connectionError,
  status,
  autoPlayVoice,
  onToggleAutoPlay,
  isMuted,
  onToggleMute,
  onLanguageChange,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isSwitchingLang, setIsSwitchingLang] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close language menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  const handleSelectLanguage = async (code: string) => {
    if (code === currentParticipant.language_code) {
      setIsLangMenuOpen(false);
      return;
    }
    try {
      setIsSwitchingLang(true);
      await onLanguageChange(code);
      setIsLangMenuOpen(false);
    } finally {
      setIsSwitchingLang(false);
    }
  };

  const myLang = getLanguageByCode(currentParticipant.language_code);
  const otherLang = otherParticipant
    ? getLanguageByCode(otherParticipant.language_code)
    : null;

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.idle;

  return (
    <header className="flex-shrink-0 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="flex items-center justify-between px-3 sm:px-6 h-15 gap-2 sm:gap-4 max-w-7xl mx-auto w-full">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white hidden sm:inline">
            CROSSWIRE
          </span>
        </div>

        {/* Center: Participants & Live Interactive Language Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center min-w-0">
          {/* Current Participant & Language Selector Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              disabled={isSwitchingLang}
              title="Click to switch your language at any time"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 dark:border-rose-900/50 dark:text-rose-300 transition-colors cursor-pointer shadow-2xs"
            >
              <span className="truncate max-w-[85px] sm:max-w-[120px] font-semibold">
                {currentParticipant.display_name} (You)
              </span>
              <div className="flex items-center gap-1 pl-1 border-l border-rose-300 dark:border-rose-800 text-[11px] font-bold uppercase">
                <Globe className="w-3 h-3 text-rose-500" />
                <span>{myLang.code}</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </div>
            </button>

            {/* Language Selector Dropdown Menu */}
            {isLangMenuOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800">
                  Select Your Language
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = lang.code === currentParticipant.language_code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{lang.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {lang.nativeName}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="text-slate-300 dark:text-zinc-700 text-xs font-bold">↔</span>

          {/* Other Participant Badge (Live Synced via Realtime) */}
          {otherParticipant ? (
            <div
              title={`Partner is speaking ${otherLang?.name || otherParticipant.language_code}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:border-sky-900/50 dark:text-sky-300 flex-shrink-0 shadow-2xs"
            >
              <span className="truncate max-w-[85px] sm:max-w-[120px] font-semibold">
                {otherParticipant.display_name}
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-sky-200/60 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200">
                {otherLang ? otherLang.name : otherParticipant.language_code}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-zinc-500 border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 flex-shrink-0">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Waiting for partner...</span>
              <span className="sm:hidden">Waiting...</span>
            </div>
          )}

          {/* Realtime Status Indicator */}
          <div
            className={`hidden lg:flex items-center gap-1.5 text-xs font-medium ml-2 ${statusInfo.lightColor} ${statusInfo.darkColor}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${
                status === 'listening' || status === 'playing' ? 'animate-pulse' : ''
              }`}
            />
            <span>{statusInfo.label}</span>
          </div>
        </div>

        {/* Right: Independent Audio Controls, Room Code, Theme Toggle, UserNav */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Per-User Auto-play Voice Toggle */}
          <button
            type="button"
            onClick={onToggleAutoPlay}
            title={
              autoPlayVoice
                ? 'Auto-play Voice is ON: incoming translations will speak automatically'
                : 'Auto-play Voice is OFF: incoming translations will not speak automatically'
            }
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              autoPlayVoice
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300'
                : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-zinc-850 dark:border-zinc-700 dark:text-zinc-400'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-mono text-[11px]">
              {autoPlayVoice ? 'Voice: Auto' : 'Voice: Manual'}
            </span>
          </button>

          {/* Per-User Mute Button */}
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Audio is MUTED (click to unmute)' : 'Mute all audio playback'}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 opacity-80" />}
          </button>

          {/* Connection Status Icon */}
          <div
            className="flex items-center p-1"
            title={connectionError ? connectionError : 'Realtime connection active'}
          >
            {connectionError ? (
              <WifiOff className="w-4 h-4 text-rose-500" />
            ) : (
              <Wifi className="w-4 h-4 text-emerald-500 opacity-80" />
            )}
          </div>

          {/* Room Code Copy Button */}
          <button
            onClick={copyRoomCode}
            type="button"
            title="Copy invite link to share"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
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
