'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Volume2,
  Mic,
  Cpu,
  RefreshCw,
  X,
} from 'lucide-react';

interface MetricsData {
  status?: string;
  uptime_human?: string;
  uptime_seconds?: number;
  total_translations_served?: number;
  total_speech_recognitions?: number;
  total_voice_syntheses?: number;
  average_latency_ms?: number;
  p95_latency_ms?: number;
  python_version?: string;
  framework?: string;
  cache?: {
    entries_cached: number;
    hit_ratio_percent: number;
    cache_hits: number;
    cache_misses: number;
  };
  rooms?: {
    active_rooms_count: number;
    total_connected_peers: number;
  };
}

export function PythonEngineStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkHealth = async () => {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : 'http://127.0.0.1:8000');
    const start = performance.now();
    try {
      const res = await fetch(`${backendUrl}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      const end = performance.now();
      if (res.ok) {
        setIsOnline(true);
        setPingLatency(Math.round(end - start));
        // Also fetch rich metrics
        try {
          const mRes = await fetch(`${backendUrl}/api/metrics`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(2500),
          });
          if (mRes.ok) {
            const mData = await mRes.json();
            setMetrics(mData);
          }
        } catch {
          // ignore metrics error if health passed
        }
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const initialCheck = async () => {
      await Promise.resolve();
      if (!isCancelled) {
        await checkHealth();
      }
    };
    void initialCheck();

    const interval = setInterval(() => {
      if (!isCancelled) {
        void checkHealth();
      }
    }, 8000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsLoading(true);
    await checkHealth();
    setIsLoading(false);
  };

  return (
    <>
      {/* Visual Badge in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-xs ${
          isOnline
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            : 'bg-slate-100 dark:bg-zinc-850 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200'
        }`}
        title="Click to view Python FastAPI 3.13 Architecture & Telemetry"
      >
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          ></span>
        </span>
        <span className="font-semibold hidden sm:inline">Python 3.13</span>
        <span>
          {isOnline
            ? `FastAPI · ${pingLatency ?? 12}ms`
            : 'Python Backend: Standby'}
        </span>
      </button>

      {/* Architecture & Telemetry Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Python FastAPI 3.13 Engine
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                        <XCircle className="w-3 h-3" /> Standby
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    High-throughput asynchronous video, voice translation & signaling
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Telemetry Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Latency
                  </span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {metrics?.average_latency_ms
                      ? `${metrics.average_latency_ms}ms`
                      : pingLatency
                      ? `${pingLatency}ms`
                      : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    LRU Cache Hit
                  </span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {metrics?.cache?.hit_ratio_percent != null
                      ? `${metrics.cache.hit_ratio_percent}%`
                      : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Translations
                  </span>
                  <span className="text-base font-bold text-slate-800 dark:text-white">
                    {metrics?.total_translations_served ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 text-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Active Rooms
                  </span>
                  <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                    {metrics?.rooms?.active_rooms_count ?? 0}
                  </span>
                </div>
              </div>

              {/* Core Python Architecture Highlights */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  Python Core Subsystems
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850 flex items-start gap-2.5">
                    <Mic className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        Acoustic Speech Recognition & Denoising
                      </div>
                      <div className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                        Multimodal Gemini 2.5 foundation model cleans noisy audio, compensates for low volume, and deciphers code-mixed colloquial Hinglish.
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850 flex items-start gap-2.5">
                    <Volume2 className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        Python Neural Voice Dubbing (TTS)
                      </div>
                      <div className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                        Pure Python neural speech synthesis generating real-time MP3 voice streams across Hindi, English, French, Spanish, German, and 22+ languages.
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850 flex items-start gap-2.5">
                    <Layers className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        In-Memory LRU Sentence Hash Cache
                      </div>
                      <div className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                        SHA-256 hashed memory caching delivering sub-5ms responses for common conference utterances.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Swagger Link */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-emerald-500/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Interactive OpenAPI / Swagger UI
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Live endpoint testing at <code className="font-mono text-emerald-600 dark:text-emerald-400">/docs</code>
                  </div>
                </div>
                <a
                  href={typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000/docs` : 'http://127.0.0.1:8000/docs'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  <span>Open Docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Uptime: {metrics?.uptime_human || 'Active'}
              </span>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}
                />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
