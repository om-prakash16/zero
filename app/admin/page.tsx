'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Crown,
  Users,
  Radio,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Download,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Globe,
  Lock,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatRoomCode } from '@/lib/roomCode';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  username: string;
  age: number | null;
  gender: string | null;
  role: string;
  is_anonymous: boolean;
  provider: string;
  created_at: string;
  last_sign_in_at?: string;
}

interface AdminRoom {
  id: string;
  code: string;
  is_active: boolean;
  participant_count: number;
  created_at: string;
  updated_at: string;
}

interface AdminParticipant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  language_code: string;
  language_name: string;
  is_connected: boolean;
  joined_at: string;
}

interface AdminMessage {
  id: string;
  room_id: string;
  sender_name: string;
  original_text: string;
  translated_text: string | null;
  source_language: string;
  target_language: string;
  translation_status: string;
  created_at: string;
}

interface AdminStats {
  totalUsers: number;
  totalRooms: number;
  activeRooms: number;
  totalMessages: number;
  languageCounts: Record<string, number>;
  systemHealth: {
    database: string;
    geminiAi: string;
    smtp: string;
  };
}

export default function AdminDashboardPage() {
  // Auth & Permissions State
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Dashboard Data State
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rooms' | 'messages' | 'reports'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Admin Data from Protected API
  const fetchAdminData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setActionError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setIsAuthorized(false);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const email = session.user?.email?.toLowerCase() || '';
      setCurrentUserEmail(email);

      const isSuperAdmin = email === 'prakash.om.global@gmail.com' || session.user?.user_metadata?.role === 'super_admin';
      const isAdmin = email === 'admin@roomchat.com' || session.user?.user_metadata?.role === 'admin';
      if (!isSuperAdmin && !isAdmin) {
        setIsAuthorized(false);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setIsAuthorized(true);

      const res = await fetch('/api/admin', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load admin stats: ${res.statusText}`);
      }

      const data = await res.json();
      setStats(data.stats);
      setUsers(data.users);
      setRooms(data.rooms);
      setParticipants(data.participants);
      setMessages(data.messages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching admin data';
      setActionError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (ignore) return;
      const session = sessionData.session;
      if (!session) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }
      const email = session.user?.email?.toLowerCase() || '';
      setCurrentUserEmail(email);
      const isSuperAdmin = email === 'prakash.om.global@gmail.com' || session.user?.user_metadata?.role === 'super_admin';
      if (!isSuperAdmin) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }
      setIsAuthorized(true);
      fetch('/api/admin', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load admin stats: ${res.statusText}`);
          return res.json();
        })
        .then((data) => {
          if (ignore) return;
          setStats(data.stats);
          setUsers(data.users);
          setRooms(data.rooms);
          setParticipants(data.participants);
          setMessages(data.messages);
        })
        .catch((err: unknown) => {
          if (ignore) return;
          const msg = err instanceof Error ? err.message : 'Error fetching admin data';
          setActionError(msg);
        })
        .finally(() => {
          if (ignore) return;
          setIsLoading(false);
        });
    });
    return () => {
      ignore = true;
    };
  }, []);

  // Toggle Room Active Status
  const handleToggleRoom = async (roomId: string, currentStatus: boolean) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'toggle_room',
          roomId,
          isActive: !currentStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update room');
      // Update local state
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, is_active: !currentStatus } : r))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setActionError(msg);
    }
  };

  // Export CSV Report
  const handleExportCsv = () => {
    if (!users.length) return;

    const headers = ['Email', 'Full Name', 'Username', 'Age', 'Gender', 'Role', 'Provider', 'Registered At'];
    const rows = users.map((u) => [
      `"${u.email}"`,
      `"${u.full_name}"`,
      `"${u.username}"`,
      u.age || '',
      `"${u.gender || ''}"`,
      `"${u.role}"`,
      `"${u.provider}"`,
      `"${new Date(u.created_at).toLocaleString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `crosswire-users-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unauthorized Screen
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-white/95 dark:bg-zinc-900/95 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Restricted Admin Area
          </h1>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            This dashboard is exclusively accessible to authorized <strong>Administrators</strong> and <strong>Super Administrators</strong>.
          </p>
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 animate-pulse">
            <Crown className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Verifying Super Admin Authorization...
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0e] text-slate-900 dark:text-zinc-100 flex flex-col transition-colors">
      {/* Super Admin Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to App</span>
          </Link>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-xs">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                  CROSSWIRE Console
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    currentUserEmail === 'prakash.om.global@gmail.com'
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-500 dark:text-amber-400'
                      : 'bg-rose-500/20 border-rose-500/30 text-rose-500 dark:text-rose-400'
                  }`}
                >
                  {currentUserEmail === 'prakash.om.global@gmail.com' ? 'SUPER ADMIN' : 'ADMIN'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 hidden sm:block">
                Master Control & Real-time Metrics • {currentUserEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAdminData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-xs hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Alerts */}
        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Users */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Users</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats?.totalUsers || 0}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Full Auth & OTP Verified</span>
            </p>
          </div>

          {/* Card 2: Rooms */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Rooms</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <Radio className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats?.totalRooms || 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              {stats?.activeRooms || 0} currently active
            </p>
          </div>

          {/* Card 3: Messages */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Translations</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats?.totalMessages || 0}
            </div>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Gemini 2.0 Flash Live</span>
            </p>
          </div>

          {/* Card 4: System Health */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">System Health</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>100% Operational</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
              PostgreSQL • Gemini • Gmail SMTP
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-1 overflow-x-auto pb-px">
          {[
            { id: 'overview', label: '📊 Overview & Health' },
            { id: 'users', label: `👥 Users (${users.length})` },
            { id: 'rooms', label: `🎙️ Debate Rooms (${rooms.length})` },
            { id: 'messages', label: `💬 Message Logs (${messages.length})` },
            { id: 'reports', label: '📑 Reports & Export' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Language Distribution Breakdown */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-500" />
                <span>Language Usage Distribution</span>
              </h2>

              <div className="space-y-3">
                {Object.entries(stats?.languageCounts || {}).length > 0 ? (
                  Object.entries(stats?.languageCounts || {}).map(([code, count]) => {
                    const percentage = Math.round((count / (participants.length || 1)) * 100);
                    return (
                      <div key={code}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                            {code}
                          </span>
                          <span className="text-slate-500 dark:text-zinc-400">
                            {count} speakers ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 dark:text-zinc-400">No language data recorded yet.</p>
                )}
              </div>
            </div>

            {/* Infrastructure & Security Checklist */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Infrastructure & Security Audits</span>
              </h2>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Database Row Level Security (RLS)</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Strict 2-participant limit trigger active</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    ENFORCED
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Gemini 2.0 Realtime Translation</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Server-side API protected from client leaks</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    SECURE
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Custom Gmail SMTP</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Routes through prakash.om.global@gmail.com</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    VERIFIED
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Super Admin Authority</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">prakash.om.global@gmail.com assigned master rights</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                    SUPER ADMIN
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: USERS */}
        {/* ================================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, user ID, role..."
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/60 text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Contact & ID</th>
                      <th className="py-3 px-4">Demographics</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Registered Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {filteredUsers.map((u) => {
                      const isSuper = u.role === 'super_admin' || u.email.toLowerCase() === 'prakash.om.global@gmail.com';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-[11px] ${
                                  isSuper
                                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                                    : 'bg-violet-600/30 text-violet-300'
                                }`}
                              >
                                {u.full_name ? u.full_name.slice(0, 1).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">
                                  {u.full_name}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                  {u.id.slice(0, 8)}...
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-800 dark:text-zinc-200">{u.email}</p>
                            {u.username && (
                              <p className="text-[10px] text-violet-600 dark:text-violet-400">@{u.username}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                            {u.age ? `${u.age} yrs` : '—'} • {u.gender || '—'}
                          </td>
                          <td className="py-3 px-4">
                            {isSuper ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-500 dark:text-amber-300 border border-amber-500/30">
                                <Crown className="h-2.5 w-2.5" />
                                SUPER ADMIN
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                                User
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize text-[11px] text-slate-600 dark:text-zinc-400">
                              {u.provider}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-zinc-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: DEBATE ROOMS */}
        {/* ================================================================= */}
        {activeTab === 'rooms' && (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/60 text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">Room Code</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Participants</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {rooms.map((r) => {
                    const roomParticipants = participants.filter((p) => p.room_id === r.id);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            href={`/room/${r.code}`}
                            target="_blank"
                            className="font-mono font-bold text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            {formatRoomCode(r.code)}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          {r.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
                              Concluded
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {roomParticipants.length > 0 ? (
                              roomParticipants.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[11px]"
                                >
                                  <strong>{p.display_name}</strong>
                                  <span className="text-[9px] uppercase font-bold text-slate-400">
                                    ({p.language_code})
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[11px]">No participants</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleRoom(r.id, r.is_active)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            {r.is_active ? 'Close Room' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: MESSAGE & TRANSLATION LOGS */}
        {/* ================================================================= */}
        {activeTab === 'messages' && (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/60 text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">Sender</th>
                    <th className="py-3 px-4">Original Message</th>
                    <th className="py-3 px-4">Live Translation</th>
                    <th className="py-3 px-4">Pair</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {messages.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {m.sender_name}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-800 dark:text-zinc-200">
                        {m.original_text}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-zinc-300 italic">
                        {m.translated_text || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono uppercase font-bold text-[10px] text-violet-600 dark:text-violet-400">
                        {m.source_language} ↔ {m.target_language}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase">
                          {m.translation_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[10px] text-slate-400 dark:text-zinc-500">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: REPORTS & EXPORT */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Executive System & User Audit Report
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Download complete comma-separated value (.csv) records including all user registrations, demographics (Age, Gender), permanent User IDs, authentication methods, and security statuses.
            </p>

            <div className="pt-2">
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-md hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Executive CSV Report</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
