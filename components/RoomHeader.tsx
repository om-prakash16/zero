'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Copy,
  Check,
  X,
  Wifi,
  WifiOff,
  Users,
  Globe,
  Volume2,
  VolumeX,
  ChevronDown,
  Settings,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Clock,
  AlertTriangle,
  Minus,
  Plus,
  Loader2,
} from 'lucide-react';
import type { Room, Participant, ConversationStatus, JoinRequest, AdmissionMode } from '@/lib/types';
import { formatRoomCode } from '@/lib/roomCode';
import { getLanguageByCode } from '@/lib/types';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';

type Props = {
  room: Room;
  currentParticipant: Participant;
  participants: Participant[];
  pendingRequests?: JoinRequest[];
  onApproveRequest?: (requestId: string) => Promise<void>;
  onDeclineRequest?: (requestId: string) => Promise<void>;
  onUpdateSettings?: (maxCapacity: number, admissionMode: AdmissionMode) => Promise<void>;
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
  participants,
  pendingRequests = [],
  onApproveRequest,
  onDeclineRequest,
  onUpdateSettings,
  connectionError,
  status,
  autoPlayVoice,
  onToggleAutoPlay,
  isMuted,
  onToggleMute,
  onLanguageChange,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [isSwitchingLang, setIsSwitchingLang] = useState(false);

  // Creator Modals State
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isParticipantsDropdownOpen, setIsParticipantsDropdownOpen] = useState(false);

  // Settings form state
  const [capacityInput, setCapacityInput] = useState(room.max_capacity ?? 2);
  const [admissionModeInput, setAdmissionModeInput] = useState<AdmissionMode>(
    room.admission_mode ?? 'approval_required'
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);



  const isHost = room.creator_id === currentParticipant.user_id;
  const otherParticipants = participants.filter((p) => p.user_id !== currentParticipant.user_id);
  const myLang = getLanguageByCode(currentParticipant.language_code);
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.idle;

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
    if (code === currentParticipant.language_code) return;
    try {
      setIsSwitchingLang(true);
      await onLanguageChange(code);
    } finally {
      setIsSwitchingLang(false);
    }
  };

  // Creator Settings Submit
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);

    const admittedCount = participants.length;
    if (capacityInput < admittedCount) {
      setSettingsError(
        `Capacity cannot be reduced below current participant count (${admittedCount} currently in room).`
      );
      return;
    }

    if (capacityInput < 2 || capacityInput > 16) {
      setSettingsError('Room capacity must be between 2 and 16 participants.');
      return;
    }

    try {
      setIsSavingSettings(true);
      if (onUpdateSettings) {
        await onUpdateSettings(capacityInput, admissionModeInput);
      }
      setIsSettingsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update room settings';
      setSettingsError(msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Creator Request Resolution
  const handleApprove = async (id: string) => {
    if (!onApproveRequest) return;
    try {
      setResolvingRequestId(id);
      await onApproveRequest(id);
    } finally {
      setResolvingRequestId(null);
    }
  };

  const handleDecline = async (id: string) => {
    if (!onDeclineRequest) return;
    try {
      setResolvingRequestId(id);
      await onDeclineRequest(id);
    } finally {
      setResolvingRequestId(null);
    }
  };

  return (
    <header className="flex-shrink-0 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="flex items-center justify-between px-3 sm:px-6 h-15 gap-2 sm:gap-4 max-w-7xl mx-auto w-full">
        {/* Left: Brand & Capacity indicator */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white hidden sm:inline">
            CROSSWIRE
          </span>

          {/* Occupancy Badge */}
          <div
            title={`Room Capacity: ${participants.length} admitted / ${room.max_capacity} max slots`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-slate-100/80 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
          >
            <Users className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span className="font-mono font-semibold">
              {participants.length} / {room.max_capacity}
            </span>
          </div>
        </div>

        {/* Center: Live Language Controls & Participants */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center min-w-0">
          {/* Current Participant Language Selector */}
          <LanguageSelector
            selectedCode={currentParticipant.language_code}
            onSelect={handleSelectLanguage}
            disabled={isSwitchingLang}
            customTrigger={({ onClick, disabled }) => (
              <button
                type="button"
                onClick={onClick}
                disabled={disabled}
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
            )}
          />

          <span className="text-slate-300 dark:text-zinc-700 text-xs font-bold">↔</span>

          {/* Other Participants List / Dropdown */}
          <div className="relative">
            {otherParticipants.length === 0 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-zinc-500 border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 flex-shrink-0">
                <Users className="w-3 h-3 text-slate-400" />
                <span className="hidden sm:inline">Waiting for partners...</span>
                <span className="sm:hidden">Waiting...</span>
              </div>
            ) : otherParticipants.length === 1 ? (
              <div
                title={`Partner is speaking ${getLanguageByCode(otherParticipants[0].language_code).name}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:border-sky-900/50 dark:text-sky-300 flex-shrink-0 shadow-2xs"
              >
                <span className="truncate max-w-[85px] sm:max-w-[120px] font-semibold">
                  {otherParticipants[0].display_name}
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-sky-200/60 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200">
                  {otherParticipants[0].language_code}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsParticipantsDropdownOpen(!isParticipantsDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 dark:border-sky-900/50 dark:text-sky-300 transition-colors cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{otherParticipants.length} Partners</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
            )}

            {/* Multi-participant popover */}
            {isParticipantsDropdownOpen && otherParticipants.length > 1 && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 p-2 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-2 py-1 border-b border-slate-100 dark:border-zinc-800">
                  Room Partners ({otherParticipants.length})
                </div>
                {otherParticipants.map((p) => {
                  const pLang = getLanguageByCode(p.language_code);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-zinc-850"
                    >
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                        {p.display_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 font-mono">
                        {pLang.name} ({p.language_code})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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

        {/* Right: Creator Controls, Audio, Code, Toggle, UserNav */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Creator: Join Requests Button with Badge */}
          {isHost && (
            <button
              type="button"
              onClick={() => setIsRequestsModalOpen(true)}
              title={
                pendingRequests.length > 0
                  ? `${pendingRequests.length} join request(s) waiting for your review`
                  : 'Join Requests (none pending)'
              }
              className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                pendingRequests.length > 0
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse'
                  : 'bg-slate-100 dark:bg-zinc-850 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Requests</span>
              {pendingRequests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white text-amber-700 text-[10px] font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          {/* Creator: Room Settings Button */}
          {isHost && (
            <button
              type="button"
              onClick={() => {
                setCapacityInput(room.max_capacity ?? 2);
                setAdmissionModeInput(room.admission_mode ?? 'approval_required');
                setSettingsError(null);
                setIsSettingsModalOpen(true);
              }}
              title="Configure capacity and admission settings"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold bg-slate-100 dark:bg-zinc-850 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Settings</span>
            </button>
          )}

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
            <span className="hidden xl:inline font-mono text-[11px]">
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

      {/* ─── CREATOR MODAL 1: JOIN REQUESTS ─── */}
      {isRequestsModalOpen && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setIsRequestsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Join Requests ({pendingRequests.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-zinc-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No pending requests</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    When guests request to join, they will appear here in real time.
                  </p>
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-850 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {req.display_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-semibold uppercase">
                          {req.language_name} ({req.language_code})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Requested {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDecline(req.id)}
                        disabled={resolvingRequestId === req.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(req.id)}
                        disabled={resolvingRequestId === req.id || participants.length >= room.max_capacity}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {resolvingRequestId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400 dark:text-zinc-500 flex items-center justify-between">
              <span>Room Occupancy: {participants.length} / {room.max_capacity}</span>
              <span>Mode: {room.admission_mode === 'approval_required' ? 'Host Approval' : 'Auto'}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CREATOR MODAL 2: ROOM SETTINGS ─── */}
      {isSettingsModalOpen && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Room Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="py-4 space-y-4">
              {/* Capacity Stepper */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Maximum Capacity
                  </label>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {capacityInput} participants
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCapacityInput((c) => Math.max(participants.length, Math.max(2, c - 1)))}
                    disabled={capacityInput <= Math.max(2, participants.length)}
                    className="h-9 w-9 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex gap-1 justify-between overflow-x-auto py-0.5">
                    {[2, 3, 4, 6, 8, 12, 16].map((num) => {
                      const isBelowCurrent = num < participants.length;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={isBelowCurrent}
                          onClick={() => setCapacityInput(num)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            capacityInput === num
                              ? 'bg-rose-600 text-white shadow-xs font-bold'
                              : isBelowCurrent
                              ? 'bg-slate-100 dark:bg-zinc-850 text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-50'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCapacityInput((c) => Math.min(16, c + 1))}
                    disabled={capacityInput >= 16}
                    className="h-9 w-9 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Currently {participants.length} admitted. Capacity cannot be reduced below current occupancy.
                </p>
              </div>

              {/* Admission Mode Setting */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Admission Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdmissionModeInput('approval_required')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      admissionModeInput === 'approval_required'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/30'
                        : 'border-slate-200 dark:border-zinc-700/80 bg-slate-50/50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs">
                      <ShieldCheck className={`w-3.5 h-3.5 ${admissionModeInput === 'approval_required' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                      <span>Host Approval</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                      Guests wait for you to approve before entering.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdmissionModeInput('auto_approve')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      admissionModeInput === 'auto_approve'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/30'
                        : 'border-slate-200 dark:border-zinc-700/80 bg-slate-50/50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs">
                      <UserCheck className={`w-3.5 h-3.5 ${admissionModeInput === 'auto_approve' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                      <span>Auto-Approve</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                      Guests enter immediately while capacity allows.
                    </p>
                  </button>
                </div>
              </div>

              {/* Error message */}
              {settingsError && (
                <div className="p-2.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
