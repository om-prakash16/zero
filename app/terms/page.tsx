import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ArrowLeft, FileText, CheckCircle2, Mic, AlertCircle } from 'lucide-react';

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            <span>Usage Guidelines & Community Protocol</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Last updated: October 2026. Terms governing participation in CROSSWIRE voice debate rooms.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          <section className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h2>1. Purpose of the Platform</h2>
            </div>
            <p>
              CROSSWIRE is designed to facilitate live, real-time vocal communication between two people
              speaking different languages. By entering or hosting a room, you agree to engage in authentic,
              safe, and lawful conversation.
            </p>
          </section>

          <section className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-white">
              <Mic className="w-5 h-5 text-amber-500" />
              <h2>2. Voice & Browser Compatibility</h2>
            </div>
            <p>
              Speech recognition and audio synthesis rely upon standard browser capabilities (the Web Speech
              API). Quality depends on your microphone setup, background noise, and browser support (such as
              Chromium-based browsers or WebKit). CROSSWIRE provides real-time translation on a best-effort basis.
            </p>
          </section>

          <section className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-base text-slate-900 dark:text-white">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <h2>3. Interruption and Respectful Disagreement</h2>
            </div>
            <p>
              CROSSWIRE features an intentional &quot;Interrupt&quot; button allowing speakers to pause ongoing
              translation playback to interject. While vigorous debate and passionate argument are encouraged,
              harassment, abusive audio spamming, and hate speech are strictly prohibited.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
