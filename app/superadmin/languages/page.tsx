'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  Mic,
  Volume2,
  Languages,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/types';

interface SuperadminLanguage extends Language {
  isEnabled: boolean;
}

export default function SuperadminLanguagesPage() {
  const [languages, setLanguages] = useState<SuperadminLanguage[]>([]);
  const [totalLanguages, setTotalLanguages] = useState(0);
  const [enabledCount, setEnabledCount] = useState(0);
  const [disabledCount, setDisabledCount] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'indian' | 'world'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  const fetchLanguages = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/languages', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load languages');
      }

      const data = await res.json();
      setLanguages(data.languages || []);
      setTotalLanguages(data.totalLanguages);
      setEnabledCount(data.enabledCount);
      setDisabledCount(data.disabledCount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching languages';
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
        fetchLanguages();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchLanguages]);

  const handleToggle = async (languageCode: string, currentStatus: boolean) => {
    try {
      setTogglingCode(languageCode);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/languages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          languageCode,
          isEnabled: !currentStatus,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to toggle language');
      }

      // Update state locally for instant UI responsiveness
      setLanguages((prev) =>
        prev.map((l) =>
          l.code === languageCode ? { ...l, isEnabled: !currentStatus } : l
        )
      );
      setEnabledCount((c) => (!currentStatus ? c + 1 : c - 1));
      setDisabledCount((c) => (!currentStatus ? c - 1 : c + 1));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Toggle failed';
      setError(msg);
    } finally {
      setTogglingCode(null);
    }
  };

  const filtered = languages.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase());

    const isIndian = l.speechCode.endsWith('-IN') || l.code === 'hi' || l.code === 'ta' || l.code === 'te' || l.code === 'bn' || l.code === 'mr' || l.code === 'gu' || l.code === 'kn' || l.code === 'ml' || l.code === 'pa' || l.code === 'ur';

    if (typeFilter === 'indian') return matchesSearch && isIndian;
    if (typeFilter === 'world') return matchesSearch && !isIndian;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Multilingual Registry & Capabilities</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
              {enabledCount} ENABLED · {disabledCount} DISABLED / {totalLanguages} TOTAL
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Manage language support across all 22 scheduled Indian languages, regional dialects, and world languages.
          </p>
        </div>

        <button
          onClick={fetchLanguages}
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

      {/* Search and Category Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by English name, native script, or code (e.g. Hindi, हिन्दी, hi)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-rose-500 transition-colors"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'indian' | 'world')}
            className="w-full h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-zinc-300 focus:outline-hidden focus:border-rose-500 transition-colors"
          >
            <option value="all">All Languages ({totalLanguages})</option>
            <option value="indian">Indian Languages (Scheduled & Regional)</option>
            <option value="world">World Languages</option>
          </select>
        </div>
      </div>

      {/* Languages Capability Matrix */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-zinc-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Native Script</th>
                <th className="py-3 px-4">BCP-47 Speech Code</th>
                <th className="py-3 px-4">Capabilities</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">App Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading multilingual registry...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No languages found matching search.
                  </td>
                </tr>
              ) : (
                filtered.map((lang) => (
                  <tr key={lang.code} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{lang.name}</span>
                          <span className="font-mono text-[10px] text-zinc-500">({lang.code})</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-zinc-200 text-sm">{lang.nativeName}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {lang.speechCode}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400" title="Text Translation Supported">
                          <Languages className="w-3 h-3" />
                          <span>Text</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-blue-400" title="Speech Recognition Supported">
                          <Mic className="w-3 h-3" />
                          <span>STT</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-purple-400" title="Speech Synthesis Supported">
                          <Volume2 className="w-3 h-3" />
                          <span>TTS</span>
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggle(lang.code, lang.isEnabled)}
                        disabled={togglingCode === lang.code || (lang.code === 'en' && lang.isEnabled)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                          lang.isEnabled
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
                        }`}
                        title={lang.code === 'en' ? 'Default fallback cannot be disabled' : undefined}
                      >
                        {togglingCode === lang.code ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : lang.isEnabled ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Enabled</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            <span>Disabled</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
