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
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/types';

interface SuperadminLanguage extends Language {
  isEnabled: boolean;
  isCustom?: boolean;
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

  // Modal State for Add & Edit
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNativeName, setFormNativeName] = useState('');
  const [formScript, setFormScript] = useState('Latin');
  const [formSpeechCode, setFormSpeechCode] = useState('');
  const [formTextTranslation, setFormTextTranslation] = useState(true);
  const [formSTT, setFormSTT] = useState(false);
  const [formTTS, setFormTTS] = useState(false);
  const [formVerified, setFormVerified] = useState(false);
  const [isSavingLang, setIsSavingLang] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  const openAddModal = () => {
    setModalMode('add');
    setFormCode('');
    setFormName('');
    setFormNativeName('');
    setFormScript('Latin');
    setFormSpeechCode('');
    setFormTextTranslation(true);
    setFormSTT(false);
    setFormTTS(false);
    setFormVerified(false);
    setModalError(null);
  };

  const openEditModal = (lang: SuperadminLanguage) => {
    setModalMode('edit');
    setFormCode(lang.code);
    setFormName(lang.name);
    setFormNativeName(lang.nativeName);
    setFormScript(lang.script || 'Latin');
    setFormSpeechCode(lang.speechCode);
    setFormTextTranslation(Boolean(lang.capabilities?.textTranslation));
    setFormSTT(Boolean(lang.capabilities?.speechRecognition));
    setFormTTS(Boolean(lang.capabilities?.speechSynthesis));
    setFormVerified(Boolean(lang.capabilities?.verified));
    setModalError(null);
  };

  const handleSaveLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      setModalError('Language code and English name are required');
      return;
    }

    try {
      setIsSavingLang(true);
      setModalError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const payloadLanguage: Language = {
        code: formCode.trim().toLowerCase(),
        name: formName.trim(),
        nativeName: formNativeName.trim() || formName.trim(),
        script: formScript.trim() || 'Latin',
        speechCode: formSpeechCode.trim() || `${formCode.trim().toLowerCase()}-${formCode.trim().toUpperCase()}`,
        capabilities: {
          textTranslation: formTextTranslation,
          speechRecognition: formSTT,
          speechSynthesis: formTTS,
          verified: formVerified,
        },
      };

      const res = await fetch('/api/superadmin/languages', {
        method: modalMode === 'add' ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          modalMode === 'add'
            ? { language: payloadLanguage }
            : { action: 'edit', language: payloadLanguage }
        ),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save language');
      }

      setModalMode(null);
      await fetchLanguages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setModalError(msg);
    } finally {
      setIsSavingLang(false);
    }
  };

  const handleDeleteCustomLanguage = async (code: string) => {
    if (!confirm(`Are you sure you want to remove custom configuration for "${code}"?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/superadmin/languages?code=${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete language');
      }

      await fetchLanguages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
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

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={openAddModal}
            className="h-9 px-3.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Language</span>
          </button>

          <button
            onClick={fetchLanguages}
            disabled={isRefreshing}
            className="h-9 px-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(lang)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title={`Edit ${lang.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {lang.isCustom && (
                          <button
                            onClick={() => handleDeleteCustomLanguage(lang.code)}
                            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Delete custom language ${lang.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Language Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {modalMode === 'add' ? (
                  <>
                    <Plus className="w-4 h-4 text-rose-500" />
                    <span>Add New Language to Registry</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 text-blue-400" />
                    <span>Edit Language ({formCode})</span>
                  </>
                )}
              </h2>
              <button
                onClick={() => setModalMode(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveLanguage} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Language Code (e.g. sa, bho)</label>
                  <input
                    type="text"
                    disabled={modalMode === 'edit'}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. sa"
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-zinc-600 focus:outline-hidden focus:border-rose-500 disabled:opacity-50 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">English Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Sanskrit"
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-zinc-600 focus:outline-hidden focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Native Name (Endonym)</label>
                  <input
                    type="text"
                    value={formNativeName}
                    onChange={(e) => setFormNativeName(e.target.value)}
                    placeholder="e.g. संस्कृतम्"
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-zinc-600 focus:outline-hidden focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Script</label>
                  <input
                    type="text"
                    value={formScript}
                    onChange={(e) => setFormScript(e.target.value)}
                    placeholder="e.g. Devanagari, Latin"
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-zinc-600 focus:outline-hidden focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Speech Code (BCP 47)</label>
                <input
                  type="text"
                  value={formSpeechCode}
                  onChange={(e) => setFormSpeechCode(e.target.value)}
                  placeholder="e.g. sa-IN, hi-IN, fr-FR"
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-zinc-600 focus:outline-hidden focus:border-rose-500 font-mono"
                />
              </div>

              {/* Capabilities Checkboxes */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Engine & Voice Capabilities
                </div>
                <div className="grid grid-cols-2 gap-2 text-zinc-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTextTranslation}
                      onChange={(e) => setFormTextTranslation(e.target.checked)}
                      className="rounded border-zinc-700 bg-slate-900 text-rose-600 focus:ring-0"
                    />
                    <span>Text Translation</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSTT}
                      onChange={(e) => setFormSTT(e.target.checked)}
                      className="rounded border-zinc-700 bg-slate-900 text-rose-600 focus:ring-0"
                    />
                    <span>Speech-to-Text (STT)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTTS}
                      onChange={(e) => setFormTTS(e.target.checked)}
                      className="rounded border-zinc-700 bg-slate-900 text-rose-600 focus:ring-0"
                    />
                    <span>Speech Synthesis (TTS)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formVerified}
                      onChange={(e) => setFormVerified(e.target.checked)}
                      className="rounded border-zinc-700 bg-slate-900 text-rose-600 focus:ring-0"
                    />
                    <span>Verified Integration</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingLang}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingLang ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{modalMode === 'add' ? 'Add to Registry' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
