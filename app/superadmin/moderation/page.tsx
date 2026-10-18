'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ModerationReport } from '@/lib/types';

export default function SuperadminModerationPage() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolution Modal State
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'investigating' | 'resolved' | 'dismissed'>('resolved');
  const [actionOnTarget, setActionOnTarget] = useState<'none' | 'suspend_user' | 'terminate_room'>('none');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
      });

      const res = await fetch(`/api/superadmin/moderation?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch moderation reports');
      }

      const data = await res.json();
      setReports(data.reports || []);
      setTotalReports(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching reports';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchReports();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchReports]);

  const handleResolveReport = async () => {
    if (!selectedReport) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/moderation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportId: selectedReport.id,
          status: resolutionStatus,
          resolutionNotes,
          actionOnTarget: actionOnTarget !== 'none' ? actionOnTarget : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update report');
      }

      setSelectedReport(null);
      setResolutionNotes('');
      setActionOnTarget('none');
      await fetchReports();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'dismissed':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      case 'investigating':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Moderation Queue</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
              {totalReports} REPORTS
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Review user-submitted abuse reports, investigate rooms/users, and enact punitive or dismissive actions.
          </p>
        </div>

        <button
          onClick={fetchReports}
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

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-48">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-zinc-300 focus:outline-hidden focus:border-rose-500 transition-colors"
          >
            <option value="all">All Report Statuses</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-zinc-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Report Reason</th>
                <th className="py-3 px-4">Reporter</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading moderation queue...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No moderation reports found in the current queue.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-white uppercase text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700">
                          {rep.target_type}
                        </span>
                        <div className="font-mono text-zinc-400 text-[11px] truncate max-w-[150px]">
                          {rep.target_id}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="text-zinc-200 line-clamp-2 leading-relaxed">
                        {rep.reason}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-zinc-300">{rep.reporter_name || 'Anonymous User'}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {rep.reporter_id ? `${rep.reporter_id.slice(0, 8)}...` : 'No UID'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium ${getStatusBadge(rep.status)}`}>
                        {rep.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-zinc-400 text-[11px]">
                      {new Date(rep.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedReport(rep);
                          setResolutionStatus(rep.status === 'pending' ? 'resolved' : rep.status);
                          setResolutionNotes(rep.resolution_notes || '');
                        }}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Inspect
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
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalReports} reports)
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

      {/* Resolution Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Review Report: {selectedReport.id.slice(0, 8)}...</span>
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-2">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Target Entity</span>
                <span className="font-mono text-zinc-200">
                  {selectedReport.target_type}: {selectedReport.target_id}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Reported Reason</span>
                <p className="text-zinc-200 mt-0.5 leading-relaxed">{selectedReport.reason}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 font-medium block mb-1">Set Resolution Status:</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as 'investigating' | 'resolved' | 'dismissed')}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-hidden focus:border-rose-500"
                >
                  <option value="investigating">Under Investigation</option>
                  <option value="resolved">Resolved (Violation Confirmed)</option>
                  <option value="dismissed">Dismissed (No Violation)</option>
                </select>
              </div>

              {selectedReport.target_type === 'user' && (
                <div>
                  <label className="text-zinc-300 font-medium block mb-1">Punitive Action:</label>
                  <select
                    value={actionOnTarget}
                    onChange={(e) => setActionOnTarget(e.target.value as 'none' | 'suspend_user')}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-hidden focus:border-rose-500"
                  >
                    <option value="none">No automated action on user</option>
                    <option value="suspend_user">Immediately Suspend User Account</option>
                  </select>
                </div>
              )}

              {selectedReport.target_type === 'room' && (
                <div>
                  <label className="text-zinc-300 font-medium block mb-1">Punitive Action:</label>
                  <select
                    value={actionOnTarget}
                    onChange={(e) => setActionOnTarget(e.target.value as 'none' | 'terminate_room')}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-hidden focus:border-rose-500"
                  >
                    <option value="none">No automated action on room</option>
                    <option value="terminate_room">Immediately Terminate Room</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-zinc-300 font-medium block mb-1">Resolution Findings / Notes:</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Document findings for the audit log..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedReport(null)}
                disabled={isSubmitting}
                className="flex-1 h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveReport}
                disabled={isSubmitting}
                className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Submit Resolution</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
