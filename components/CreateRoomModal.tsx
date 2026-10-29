'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X,
  Mic,
  User,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Minus,
  Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLanguageByCode, type AdmissionMode } from '@/lib/types';
import { LanguageSelector } from '@/components/LanguageSelector';
import { generateRoomCode, formatRoomCode, getRoomInviteUrl } from '@/lib/roomCode';
import { getPersistentGuestUid } from '@/lib/guestUser';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDisplayName?: string;
  defaultLanguageCode?: string;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  defaultDisplayName = '',
  defaultLanguageCode = 'en',
}: CreateRoomModalProps) {
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [languageCode, setLanguageCode] = useState(defaultLanguageCode);
  const [maxCapacity, setMaxCapacity] = useState<number>(2);
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>('approval_required');
  const [previewCode, setPreviewCode] = useState('brave-wolf-42');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate dynamic code in macrotask when modal opens (avoids SSR Math.random prerender error)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setPreviewCode(generateRoomCode());
        setCopied(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [isSignedIn, setIsSignedIn] = useState(false);

  // Sync user display name from auth or set friendly guest name
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !user.is_anonymous) {
        setIsSignedIn(true);
        if (!defaultDisplayName) {
          const name =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            '';
          if (name) setDisplayName(name);
        }
      } else {
        setIsSignedIn(false);
        if (!defaultDisplayName && !displayName) {
          setDisplayName(`Guest Speaker ${Math.floor(100 + Math.random() * 900)}`);
        }
      }
    });
  }, [defaultDisplayName, displayName]);

  // Regenerate preview code
  const handleRegenerateCode = () => {
    setPreviewCode(generateRoomCode());
    setCopied(false);
  };

  const inviteUrl = isClient ? getRoomInviteUrl(previewCode) : '';

  const handleCopyInviteUrl = async () => {
    try {
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
    } catch {
      // ignore
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // 1. Ensure user ID (authenticated or instant guest - avoiding auth blockage)
      let uid = '';
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) {
          uid = sessionData.session.user.id;
        } else {
          const { data: anonData } = await supabase.auth.signInAnonymously();
          if (anonData.session?.user?.id) {
            uid = anonData.session.user.id;
          }
        }
      } catch {
        // ignore
      }

      if (!uid) {
        uid = getPersistentGuestUid();
      }

      // 2. Register room with high-performance Python FastAPI engine
      const lang = getLanguageByCode(languageCode);
      let roomCode = previewCode;

      try {
        const pyRes = await fetch('/api/rooms/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: roomCode,
            creator_id: uid,
            creator_name: displayName.trim(),
            language_code: lang.code,
            language_name: lang.name,
            max_capacity: Math.max(2, Math.min(16, maxCapacity)),
            admission_mode: admissionMode,
          }),
        });
        if (pyRes.ok) {
          const pyData = await pyRes.json();
          if (pyData?.room?.code) {
            roomCode = pyData.room.code;
          }
        }
      } catch {
        // Python backend may be starting or offline
      }

      // 3. Register in Supabase as well
      try {
        let code = roomCode;
        let attempts = 0;
        while (attempts < 5) {
          const { data: existing } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', code)
            .maybeSingle();

          if (!existing) break;
          code = generateRoomCode();
          attempts++;
        }

        const { data: room } = await supabase
          .from('rooms')
          .insert({
            code,
            is_active: true,
            participant_count: 1,
            creator_id: uid,
            max_capacity: Math.max(2, Math.min(16, maxCapacity)),
            admission_mode: admissionMode,
          })
          .select()
          .maybeSingle();

        if (room) {
          roomCode = room.code;
          await supabase.from('participants').insert({
            room_id: room.id,
            user_id: uid,
            display_name: displayName.trim(),
            language_code: lang.code,
            language_name: lang.name,
            is_connected: true,
          });
        }
      } catch (err) {
        console.warn('Supabase dual-sync warning:', err);
      }

      // 4. Route to Room
      onClose();
      router.push(`/room/${roomCode}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to allocate room';
      setError(msg);
      setIsCreating(false);
    }
  };

  if (!isOpen || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Center Container */}
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-left shadow-2xl backdrop-blur-xl transition-all my-8">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-rose-600/15 dark:bg-rose-600/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-indigo-600/15 dark:bg-indigo-600/25 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 text-white shadow-lg shadow-rose-500/25">
              <Mic className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create a Debate Room
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Set up your speaker profile and invite a partner to argue in any language
            </p>
            {!isSignedIn && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2.5 shadow-2xs">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Instant Guest Mode · No Account or Sign-in Required</span>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCreateRoom} className="space-y-4">
            {/* Display Name */}
            <div>
              <label
                htmlFor="creator-name"
                className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1"
              >
                Your Display Name
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="creator-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Om Prakash, Elena, Kenji..."
                  maxLength={35}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-3 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-rose-500 focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Native Language */}
            <LanguageSelector
              selectedCode={languageCode}
              onSelect={setLanguageCode}
              label="Your Preferred Language"
              variant="full"
            />

            {/* Room Capacity Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Room Capacity
                </label>
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  {maxCapacity} {maxCapacity === 1 ? 'participant' : 'participants'} total
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMaxCapacity((c) => Math.max(2, c - 1))}
                  disabled={maxCapacity <= 2}
                  className="h-9 w-9 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Decrease capacity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex gap-1 justify-between overflow-x-auto py-0.5">
                  {[2, 3, 4, 6, 8, 12, 16].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxCapacity(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        maxCapacity === num
                          ? 'bg-rose-600 text-white shadow-xs font-bold'
                          : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {num === 2 ? '2 (1-on-1)' : num}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setMaxCapacity((c) => Math.min(16, c + 1))}
                  disabled={maxCapacity >= 16}
                  className="h-9 w-9 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Increase capacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                Default is 2 (you + 1 partner). Configurable up to 16 for group multilingual discussions.
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
                  onClick={() => setAdmissionMode('approval_required')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    admissionMode === 'approval_required'
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/30'
                      : 'border-slate-200 dark:border-zinc-700/80 bg-slate-50/50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs">
                    <ShieldCheck className={`w-3.5 h-3.5 ${admissionMode === 'approval_required' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                    <span>Host Approval</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                    Guests wait for you to approve before entering.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAdmissionMode('auto_approve')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    admissionMode === 'auto_approve'
                      ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/30'
                      : 'border-slate-200 dark:border-zinc-700/80 bg-slate-50/50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 font-semibold text-xs">
                    <UserCheck className={`w-3.5 h-3.5 ${admissionMode === 'auto_approve' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                    <span>Auto-Approve</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                    Guests enter immediately until room capacity is reached.
                  </p>
                </button>
              </div>
            </div>

            {/* Room Code & Invite Link Preview */}
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Allocated Room Code
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Change Code</span>
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 px-3 py-2">
                <span className="font-mono text-sm font-bold tracking-widest text-slate-900 dark:text-white">
                  {formatRoomCode(previewCode)}
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  {maxCapacity} Max · {admissionMode === 'approval_required' ? 'Manual' : 'Auto'}
                </span>
              </div>

              {/* Shareable Invite URL */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400 truncate outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyInviteUrl}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 text-white px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCreating || !displayName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition-all hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 cursor-pointer pt-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating & Entering Room...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Create & Enter Room</span>
                  <ArrowRight className="h-4 w-4 ml-0.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
