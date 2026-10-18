'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Mic,
  MessageSquare,
  ArrowRight,
  Hash,
  AlertTriangle,
  Flame,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { generateRoomCode, normalizeRoomCode } from '@/lib/roomCode';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SUPPORTED_LANGUAGES } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateRoom() {
    setIsCreating(true);
    setError('');

    try {
      // Sign in anonymously if not already signed in
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
      }

      // Generate unique room code
      let code = generateRoomCode();
      let attempts = 0;
      while (attempts < 5) {
        const { data: existing } = await supabase
          .from('rooms')
          .select('id')
          .eq('code', code)
          .single();

        if (!existing) break;
        code = generateRoomCode();
        attempts++;
      }

      // Create the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ code })
        .select()
        .single();

      if (roomError) throw roomError;

      router.push(`/room/${room.code}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      setError(message);
      setIsCreating(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeRoomCode(joinCode);
    if (!code) return;

    setIsJoining(true);
    setError('');

    try {
      // Sign in anonymously if not already signed in
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
      }

      // Check room exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (roomError || !room) {
        setError('Room not found. Check the code and try again.');
        setIsJoining(false);
        return;
      }

      // Check room is not full
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      if (count !== null && count >= 2) {
        setError('Room is full. Maximum 2 participants allowed.');
        setIsJoining(false);
        return;
      }

      router.push(`/room/${room.code}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      setError(message);
      setIsJoining(false);
    }
  }

  const scrollToJoin = () => {
    const input = document.getElementById('join-room-input');
    input?.focus();
    input?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen hero-gradient grid-pattern relative flex flex-col justify-between">
      {/* Professional Responsive Navbar */}
      <Navbar onStartArgument={handleCreateRoom} onJoinRoom={scrollToJoin} />

      {/* Hero Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center text-center">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-400 shadow-2xs mb-8">
          <Radio className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span>Multilingual Live Argument Protocol</span>
          <span className="text-slate-300 dark:text-zinc-700">•</span>
          <span className="text-slate-500 dark:text-zinc-500">12 Languages</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white max-w-4xl leading-[1.12]">
          You don&apos;t need the{' '}
          <span className="gradient-text-a">same language</span>
          <br />
          to have the{' '}
          <span className="gradient-text-b">same argument.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
          CROSSWIRE pairs two people across languages in real-time. Speak in your native tongue;
          your partner hears it instantly in theirs. Disagree, interrupt, and converse naturally.
        </p>

        {/* Configuration notice if Supabase is unconfigured */}
        {!isSupabaseConfigured && (
          <div className="mt-6 w-full max-w-xl text-left p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 text-xs sm:text-sm flex items-start gap-3 shadow-2xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold mb-1">Configuration Needed for Real-Time Rooms</p>
              <p className="text-amber-700 dark:text-amber-400/90 leading-relaxed text-xs">
                To create and sync live rooms, provide <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> in <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {/* Interactive Action Hub */}
        <div className="mt-10 w-full max-w-lg minimal-card rounded-2xl p-6 sm:p-7 text-left shadow-md">
          <div className="space-y-5">
            {/* Action 1: Create room */}
            <div id="create">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Option 1 · Start New Session
                </span>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Instant Host
                </span>
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                type="button"
                className="w-full h-12 flex items-center justify-center gap-2.5 px-6 rounded-xl font-medium text-sm text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-xs active:scale-[0.99] cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Allocating Room...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start an Argument</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
              <span className="absolute px-3 bg-white dark:bg-[#121215] text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-medium">
                or
              </span>
            </div>

            {/* Action 2: Join with code */}
            <div id="join">
              <label
                htmlFor="join-room-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2"
              >
                Option 2 · Join Existing Room
              </label>
              <form onSubmit={handleJoinRoom} className="flex gap-2.5">
                <div className="relative flex-1">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    id="join-room-input"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Enter room code (e.g. fire-lion-61)"
                    maxLength={30}
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm font-mono focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-800 dark:focus:border-zinc-600 outline-hidden transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isJoining || !joinCode.trim()}
                  className="h-11 px-5 rounded-xl font-medium text-sm bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-xs cursor-pointer"
                >
                  {isJoining ? 'Connecting...' : 'Join Room'}
                </button>
              </form>
              {error && (
                <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section: How It Works */}
        <section
          id="how-it-works"
          aria-label="How it works"
          className="mt-20 max-w-4xl w-full text-left scroll-mt-24"
        >
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Voice-First Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              How CROSSWIRE Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              Natural real-time debate in three friction-free steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl minimal-card border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm mb-4">
                01
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Instant 2-Person Room
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Click Start an Argument to generate a private 2-person session. Share the invite link with your debate partner.
              </p>
            </div>

            <div className="p-6 rounded-2xl minimal-card border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm mb-4">
                02
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Pick Your Tongues
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Choose any of 12 supported languages. Speak in your language; your partner hears it in theirs without hesitation.
              </p>
            </div>

            <div className="p-6 rounded-2xl minimal-card border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm mb-4">
                03
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Speak & Interrupt
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Natural debates have interruptions. Hit &quot;Interrupt&quot; at any moment to cut ongoing audio playback and interject immediately.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Trio: Standards-based minimal design */}
        <section
          id="features"
          aria-label="Key features"
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full text-left scroll-mt-24"
        >
          <div className="p-5 rounded-xl minimal-card hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3.5">
              <Globe className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
              Speak In Your Language
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Hindi, Spanish, French, Japanese, Mandarin, and more. Both people talk naturally in their native tongues.
            </p>
          </div>

          <div className="p-5 rounded-xl minimal-card hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3.5">
              <Mic className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
              Instant Interruption
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Disagreements don&apos;t wait for turns. Hit Interrupt to cut off active translation playback and immediately counter.
            </p>
          </div>

          <div className="p-5 rounded-xl minimal-card hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3.5">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
              Dual-Language Audio & Text
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Synchronized transcripts with original words, translated text, and neural voice playback side-by-side.
            </p>
          </div>
        </section>

        {/* Supported Languages Minimal Strip */}
        <section
          id="languages"
          aria-label="Supported languages"
          className="mt-16 max-w-4xl w-full pt-8 border-t border-slate-200/80 dark:border-zinc-800/80 text-center scroll-mt-24"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">
            Supported Languages & Dialects
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <span
                key={lang.code}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60 shadow-2xs"
              >
                <CheckCircle2 className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                {lang.name}
              </span>
            ))}
          </div>
        </section>
      </main>

      {/* Professional Responsive Footer */}
      <Footer />
    </div>
  );
}
