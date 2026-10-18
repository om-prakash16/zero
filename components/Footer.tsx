import React from 'react';
import Link from 'next/link';
import { Zap, Shield, Sparkles } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer
      aria-label="Site Footer"
      className="w-full border-t border-slate-200/90 dark:border-zinc-800/90 bg-slate-50/70 dark:bg-zinc-950/70 backdrop-blur-md transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Column 1: Brand & Mission (Spans 2 cols on desktop) */}
          <div className="md:col-span-2 space-y-4">
            <Link
              href="/"
              aria-label="CROSSWIRE Home"
              className="inline-flex items-center gap-2.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-sm shadow-rose-600/30">
                <Zap className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white font-mono">
                CROSSWIRE
              </span>
            </Link>

            <p className="text-sm font-medium text-slate-900 dark:text-zinc-200">
              Different languages. One real conversation.
            </p>

            <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm leading-relaxed">
              CROSSWIRE pairs two people across language barriers in real time. Speak in your native
              tongue; your debate partner hears it translated instantaneously in theirs. Converse,
              disagree, and interrupt naturally.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200/60 dark:bg-zinc-900 border border-slate-300/60 dark:border-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Neural Speech Engine</span>
              <span className="text-slate-400 dark:text-zinc-600">•</span>
              <span className="text-slate-500 dark:text-zinc-400">Multilingual conversations</span>
            </div>
          </div>

          {/* Column 2: Explore Navigation */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
              Explore
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-zinc-400">
              <li>
                <Link
                  href="/#how-it-works"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Core Features
                </Link>
              </li>
              <li>
                <Link
                  href="/#languages"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Supported Languages
                </Link>
              </li>
              <li>
                <Link
                  href="/#create"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-rose-600 dark:text-rose-400"
                >
                  Start an Argument
                </Link>
              </li>
              <li>
                <Link
                  href="/#join"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Join with Code
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources & Privacy */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
              Resources & Privacy
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-zinc-400">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Audio Interruption Protocol
                </Link>
              </li>
              <li>
                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-500">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Ephemeral Session Storage</span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Security Note */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-zinc-500">
          <p>
            © {CURRENT_YEAR} CROSSWIRE. Built for conversations without language barriers.
          </p>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Zero Audio Retention</span>
            <span>•</span>
            <span>2-Person Live Peer Rooms</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Gemini Powered
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
