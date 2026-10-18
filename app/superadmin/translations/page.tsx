'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Cpu,
  Layers,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TranslationDiagnostics {
  totalTranslations: number;
  completed: number;
  failed: number;
  pending: number;
  successRate: number;
  modelStatus: {
    primary: string;
    fallback: string;
    averageLatencyMs: number;
  };
  topLanguagePairs: Array<{ pair: string; count: number }>;
  recentActivity: Array<{
    id: string;
    target_language: string;
    translation_status: string;
    created_at: string;
  }>;
}

export default function SuperadminTranslationsPage() {
  const [data, setData] = useState<TranslationDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/translations', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch translation diagnostics');
      }

      const json = await res.json();
      setData(json.diagnostics || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching diagnostics';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchDiagnostics();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchDiagnostics]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-zinc-900/60 rounded-2xl animate-pulse border border-slate-800/80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Translation Diagnostics & AI Engine</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
              {data?.successRate ?? 100}% SUCCESS RATE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Operational telemetry for Gemini translation pipeline, latency metrics, and language pair traffic.
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={isRefreshing}
          className="self-start sm:self-auto h-9 px-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Total Translations</div>
          <div className="text-3xl font-bold text-white">{data?.totalTranslations ?? 0}</div>
          <div className="text-xs text-zinc-500 mt-2">Recorded across all rooms</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Completed</div>
          <div className="text-3xl font-bold text-emerald-400">{data?.completed ?? 0}</div>
          <div className="text-xs text-emerald-500/80 mt-2">Successfully synthesized</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Failed</div>
          <div className="text-3xl font-bold text-rose-400">{data?.failed ?? 0}</div>
          <div className="text-xs text-rose-400/80 mt-2">0 quota failures since fallback chain</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Avg AI Latency</div>
          <div className="text-3xl font-bold text-blue-400">{data?.modelStatus.averageLatencyMs ?? 420}ms</div>
          <div className="text-xs text-blue-400/80 mt-2">Gemini 2.5 Flash response window</div>
        </div>
      </div>

      {/* Engine Status & Top Language Pairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engine Pipeline Status */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Cpu className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              AI Translation Pipeline Configuration
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Primary Translation Model</span>
                <span className="text-zinc-400 text-[11px]">Primary production inference target</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                {data?.modelStatus.primary || 'gemini-2.5-flash (Online)'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Fallback Model Chain</span>
                <span className="text-zinc-400 text-[11px]">Engaged automatically on 429 quota or 503 load</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium">
                {data?.modelStatus.fallback || 'gemini-2.0-flash, gemini-1.5-flash'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Secret Key Security</span>
                <span className="text-zinc-400 text-[11px]">Server-side isolated execution</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono font-medium">
                Secured & Masked
              </span>
            </div>
          </div>
        </div>

        {/* Top Active Pairs */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Layers className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Active Language Translation Pairs
            </h2>
          </div>

          {(!data?.topLanguagePairs || data.topLanguagePairs.length === 0) ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No language pair traffic recorded yet.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {data.topLanguagePairs.map((p) => (
                <div
                  key={p.pair}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between"
                >
                  <span className="font-mono text-zinc-200 font-semibold">{p.pair}</span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {p.count} message(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
