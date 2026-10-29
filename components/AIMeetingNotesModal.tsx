'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  FileText,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Cpu,
} from 'lucide-react';

interface AIMeetingSummaryData {
  title?: string;
  executive_summary?: string;
  key_discussion_points?: string[];
  decisions_reached?: string[];
  action_items?: string[];
  sentiment_overview?: string;
}

interface AIMeetingNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export function AIMeetingNotesModal({ isOpen, onClose, roomCode }: AIMeetingNotesModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AIMeetingSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/rooms/${roomCode}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error('Failed to generate AI meeting summary');
      }

      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error reaching Python AI engine';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    let isCancelled = false;
    if (isOpen && !data && !loading) {
      const load = async () => {
        await Promise.resolve();
        if (!isCancelled) {
          await fetchSummary();
        }
      };
      void load();
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, data, loading]);

  const handleCopy = () => {
    if (!data) return;
    const text = `# ${data.title || 'Meeting Summary'}\n\n## Executive Summary\n${data.executive_summary || ''}\n\n## Key Points\n${(data.key_discussion_points || []).map((p) => `- ${p}`).join('\n')}\n\n## Decisions Reached\n${(data.decisions_reached || []).map((d) => `- ${d}`).join('\n')}\n\n## Action Items\n${(data.action_items || []).map((a) => `- ${a}`).join('\n')}\n\n## Sentiment\n${data.sentiment_overview || 'Neutral'}`;

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
        <div className="relative w-full max-w-2xl transform overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-left shadow-2xl backdrop-blur-xl transition-all my-8">
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  AI Meeting Intelligence & Notes
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Cpu className="w-3 h-3" /> Python Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Generated from multi-lingual conference transcript using Gemini 2.5 Flash
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                Synthesizing multi-lingual meeting notes in Python...
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Analyzing speech transcripts, argument dynamics, and decisions
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs mb-4">
              <p className="font-semibold mb-1">Failed to generate summary</p>
              <p>{error}</p>
              <button
                onClick={fetchSummary}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-medium text-xs hover:bg-rose-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Retry Analysis
              </button>
            </div>
          )}

          {/* Content State */}
          {data && !loading && (
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {/* Title & Sentiment badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {data.title || `Conference Room ${roomCode}`}
                </div>
                {data.sentiment_overview && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Tone: {data.sentiment_overview}
                  </span>
                )}
              </div>

              {/* Executive Summary */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Executive Summary
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed p-3.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/50">
                  {data.executive_summary || 'No summary available.'}
                </p>
              </div>

              {/* Key Discussion Points */}
              {data.key_discussion_points && data.key_discussion_points.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Key Discussion Points
                  </h3>
                  <div className="space-y-2">
                    {data.key_discussion_points.map((pt, i) => (
                      <div
                        key={i}
                        className="text-xs text-slate-700 dark:text-zinc-300 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-700/40 flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions Reached */}
              {data.decisions_reached && data.decisions_reached.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Decisions Reached
                  </h3>
                  <div className="space-y-2">
                    {data.decisions_reached.map((d, i) => (
                      <div
                        key={i}
                        className="text-xs text-slate-700 dark:text-zinc-300 p-2.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              {data.action_items && data.action_items.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-sky-500" /> Action Items
                  </h3>
                  <div className="space-y-2">
                    {data.action_items.map((item, i) => (
                      <div
                        key={i}
                        className="text-xs text-slate-700 dark:text-zinc-300 p-2.5 rounded-lg bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 flex items-start gap-2"
                      >
                        <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={fetchSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-md hover:opacity-90 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Meeting Notes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
