import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Server } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f8fafc] text-slate-900 dark:bg-[#09090b] dark:text-zinc-100">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to CROSSWIRE</span>
        </Link>

        <div className="space-y-4 mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy & Ephemeral Audio Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Last updated: October 2026. How CROSSWIRE processes voice, text, and room data.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          {/* Section 1 */}
          <section className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-white">
              <EyeOff className="w-5 h-5 text-rose-500" />
              <h2>1. Zero Permanent Audio Recording</h2>
            </div>
            <p>
              CROSSWIRE is voice-first, but we do not record or retain your raw audio. Voice input is
              converted to text locally inside your web browser via the standard Web Speech API. Only the
              resulting text transcript is streamed to the server to translate for your conversation partner.
            </p>
          </section>

          {/* Section 2 */}
          <section className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-white">
              <Server className="w-5 h-5 text-indigo-500" />
              <h2>2. Translation Processing</h2>
            </div>
            <p>
              When a speaker completes a sentence, the transcript text is processed through Google Gemini
              to perform context-aware conversational translation. Neither personal voice prints nor biometric
              identifiers are gathered or shared during translation.
            </p>
          </section>

          {/* Section 3 */}
          <section className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-white">
              <Lock className="w-5 h-5 text-emerald-500" />
              <h2>3. Room Lifecycles & Authentication</h2>
            </div>
            <p>
              Debate rooms exist for the duration of the 2-participant discussion. If you sign in via Google
              OAuth or Email OTP, we store only your email and display name to recognize your speaker profile.
              If you join anonymously, an ephemeral guest session ID is assigned that discards when you leave.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
