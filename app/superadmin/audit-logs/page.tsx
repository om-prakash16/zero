'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdminAuditLog } from '@/lib/types';

export default function SuperadminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspector modal
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        action: actionFilter,
      });

      const res = await fetch(`/api/superadmin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch audit logs');
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalLogs(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching audit logs';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, search, actionFilter]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchLogs();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Administrative Audit Log</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
              IMMUTABLE
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Tamper-evident trail of all privileged operations, role changes, room terminations, and configuration adjustments.
          </p>
        </div>

        <button
          onClick={fetchLogs}
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

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by action, administrator email, target entity, or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-rose-500 transition-colors"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-zinc-300 focus:outline-hidden focus:border-rose-500 transition-colors"
          >
            <option value="all">All Actions</option>
            <option value="user_">User Actions</option>
            <option value="room_">Room Actions</option>
            <option value="superadmin_">Admission Overrides</option>
            <option value="moderation_">Moderation Actions</option>
            <option value="platform_">Settings Changes</option>
            <option value="language_">Language Changes</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-zinc-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Administrator</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 text-[11px]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-white uppercase text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800">
                          {log.target_entity}
                        </span>
                        <div className="text-[11px] font-mono text-zinc-400 truncate max-w-[140px]">
                          {log.target_id}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-zinc-200 font-medium">{log.admin_email}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{log.admin_id.slice(0, 8)}...</div>
                    </td>

                    <td className="py-3 px-4 text-zinc-400 text-[11px]">
                      {new Date(log.created_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3 text-zinc-400" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalLogs} log events)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Audit Event: {selectedLog.action}</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Administrator</span>
                <span className="font-semibold text-white">{selectedLog.admin_email}</span>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{selectedLog.admin_id}</div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Recorded Timestamp</span>
                <span className="font-semibold text-white">
                  {new Date(selectedLog.created_at).toLocaleString()}
                </span>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">IP: {selectedLog.ip_address || 'Internal/Proxy'}</div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="text-zinc-400 font-semibold block">Contextual Action Payload (JSON):</span>
              <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
