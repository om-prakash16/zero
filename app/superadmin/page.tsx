'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Radio,
  FileCheck2,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdminAuditLog } from '@/lib/types';

interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalRooms: number;
  activeRooms: number;
  roomsAtCapacity: number;
  pendingRequests: number;
  totalMessages: number;
  translationVolume: number;
  translationSuccess: number;
  translationFailed: number;
}

export default function SuperadminOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminAuditLog[]>([]);
  const [systemHealth, setSystemHealth] = useState<{ database: string; auth: string; gemini: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('Session token not found');

      const res = await fetch('/api/superadmin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load metrics: ${res.statusText}`);
      }

      const data = await res.json();
      setStats(data.stats);
      setRecentLogs(data.recentLogs || []);
      setSystemHealth(data.systemHealth || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching overview data';
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
        fetchOverview();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchOverview]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-zinc-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const successRate = stats && stats.translationVolume > 0
    ? Math.round((stats.translationSuccess / stats.translationVolume) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Platform Overview</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
              LIVE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Real-time telemetry, capacity states, admission queues, and system integrity.
          </p>
        </div>

        <button
          onClick={fetchOverview}
          disabled={isRefreshing}
          className="self-start sm:self-auto h-9 px-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Users */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Registered Users</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {stats?.totalUsers ?? 0}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
            <span className="text-emerald-400 font-medium">{stats?.activeUsers ?? 0} Active</span>
            <span>•</span>
            <span className="text-rose-400">{stats?.suspendedUsers ?? 0} Suspended</span>
          </div>
        </div>

        {/* Metric 2: Active Rooms */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Active Rooms</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {stats?.activeRooms ?? 0}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
            <span className="text-zinc-300">{stats?.totalRooms ?? 0} Total Rooms</span>
            <span>•</span>
            <span className="text-amber-400 font-medium">{stats?.roomsAtCapacity ?? 0} At Capacity</span>
          </div>
        </div>

        {/* Metric 3: Join Requests */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Admission</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {stats?.pendingRequests ?? 0}
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
            {stats?.pendingRequests && stats.pendingRequests > 0 ? (
              <span className="text-amber-400 font-medium">Host approval required</span>
            ) : (
              <span className="text-emerald-400">Queue is clear</span>
            )}
          </div>
        </div>

        {/* Metric 4: Translation Volume & Success */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Translation Success</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {successRate}%
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2">
            <span>{stats?.translationVolume ?? 0} Total Translations</span>
            <span>•</span>
            <span className="text-emerald-400">{stats?.translationSuccess ?? 0} OK</span>
          </div>
        </div>
      </div>

      {/* Sub-grid: Recent Audit Logs & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Admin Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Recent Administrative Actions
              </h2>
            </div>
            <Link
              href="/superadmin/audit-logs"
              className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
            >
              <span>Full Audit History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No recent administrative actions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-zinc-400">
                        on <strong className="text-zinc-200">{log.target_entity}</strong> ({log.target_id.slice(0, 8)}...)
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      By <span className="text-zinc-400">{log.admin_email}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-500 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Health & Status (1 Col) */}
        <div className="space-y-6">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Service Integrity
              </h2>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300 font-medium">Supabase PostgreSQL</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {systemHealth?.database || 'Operational'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300 font-medium">Real-Time AI Pipeline</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {systemHealth?.gemini || 'Active'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300 font-medium">Authentication & RBAC</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {systemHealth?.auth || 'Protected'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Quick Navigation
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <Link
                href="/superadmin/users"
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-center border border-zinc-800"
              >
                Users List
              </Link>
              <Link
                href="/superadmin/rooms"
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-center border border-zinc-800"
              >
                Manage Rooms
              </Link>
              <Link
                href="/superadmin/moderation"
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-center border border-zinc-800"
              >
                Moderation
              </Link>
              <Link
                href="/superadmin/settings"
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-center border border-zinc-800"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
