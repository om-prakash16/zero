'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SuperadminSettingsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [defaultCapacity, setDefaultCapacity] = useState(2);
  const [maxCapacity, setMaxCapacity] = useState(16);
  const [defaultAdmissionMode, setDefaultAdmissionMode] = useState('approval_required');
  const [translationModel, setTranslationModel] = useState('gemini-2.5-flash');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [auditReason, setAuditReason] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch settings');
      }

      const json = await res.json();
      const s = json.settings || {};

      if (s.default_room_capacity !== undefined) setDefaultCapacity(Number(s.default_room_capacity));
      if (s.max_permitted_capacity !== undefined) setMaxCapacity(Number(s.max_permitted_capacity));
      if (s.default_admission_mode !== undefined) setDefaultAdmissionMode(String(s.default_admission_mode));
      if (s.translation_model !== undefined) setTranslationModel(String(s.translation_model));
      if (s.maintenance_mode !== undefined) setMaintenanceMode(Boolean(s.maintenance_mode));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching settings';
      setError(msg);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchSettings();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchSettings]);

  const handleSaveSetting = async (key: string, value: unknown) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMsg(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          value,
          reason: auditReason || 'Platform settings update via superadmin dashboard',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save setting');
      }

      setSuccessMsg(`Setting "${key}" updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Global Platform Settings</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono font-medium">
              AUTHORITATIVE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Configure system-wide room capacity boundaries, admission policies, and AI inference targets.
          </p>
        </div>

        <button
          onClick={fetchSettings}
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

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Audit Reason Input */}
      <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-1.5 text-xs">
        <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-rose-400" />
          <span>Administrative Justification (Required for Audit Logging):</span>
        </label>
        <input
          type="text"
          value={auditReason}
          onChange={(e) => setAuditReason(e.target.value)}
          placeholder="State reason for settings adjustment (e.g., Scheduled infrastructure capacity expansion)..."
          className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-rose-500"
        />
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Default Room Capacity */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Default Room Capacity</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Initial participant limit applied to newly created rooms.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="2"
                max={maxCapacity}
                value={defaultCapacity}
                onChange={(e) => setDefaultCapacity(parseInt(e.target.value, 10))}
                className="w-24 h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-bold text-white focus:outline-hidden focus:border-rose-500 font-mono text-center"
              />
              <span className="text-xs text-zinc-400">participants</span>
            </div>
            <button
              onClick={() => handleSaveSetting('default_room_capacity', defaultCapacity)}
              disabled={isSaving}
              className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Default Capacity</span>
            </button>
          </div>
        </div>

        {/* Card 2: Maximum Permitted Capacity */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Maximum Permitted Room Capacity</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Hard platform-wide limit room creators cannot exceed (Default: 16).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="2"
                max="32"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(parseInt(e.target.value, 10))}
                className="w-24 h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-bold text-white focus:outline-hidden focus:border-rose-500 font-mono text-center"
              />
              <span className="text-xs text-zinc-400">participants max</span>
            </div>
            <button
              onClick={() => handleSaveSetting('max_permitted_capacity', maxCapacity)}
              disabled={isSaving}
              className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Hard Limit</span>
            </button>
          </div>
        </div>

        {/* Card 3: Default Admission Mode */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Default Admission Policy</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Default admission rule for new rooms (approval_required vs auto_approve).
            </p>
          </div>

          <div className="space-y-2">
            <select
              value={defaultAdmissionMode}
              onChange={(e) => setDefaultAdmissionMode(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-hidden focus:border-rose-500"
            >
              <option value="approval_required">Require Host Approval (Default)</option>
              <option value="auto_approve">Auto-Approve (Admit until full)</option>
            </select>
            <button
              onClick={() => handleSaveSetting('default_admission_mode', defaultAdmissionMode)}
              disabled={isSaving}
              className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Admission Policy</span>
            </button>
          </div>
        </div>

        {/* Card 4: Translation Model */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Primary AI Translation Model</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select primary Google Gemini model used for live translation.
            </p>
          </div>

          <div className="space-y-2">
            <select
              value={translationModel}
              onChange={(e) => setTranslationModel(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-hidden focus:border-rose-500 font-mono"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            </select>
            <button
              onClick={() => handleSaveSetting('translation_model', translationModel)}
              disabled={isSaving}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Model Configuration</span>
            </button>
          </div>
        </div>

        {/* Card 5: Maintenance Mode */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Maintenance Mode</span>
                {maintenanceMode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono font-medium">
                    ACTIVE
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                When enabled, non-superadmin users will see a maintenance notice upon attempting to create or join rooms.
              </p>
            </div>

            <button
              onClick={() => {
                const next = !maintenanceMode;
                setMaintenanceMode(next);
                handleSaveSetting('maintenance_mode', next);
              }}
              disabled={isSaving}
              className={`h-9 px-4 text-xs font-medium rounded-xl transition-colors cursor-pointer border ${
                maintenanceMode
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
