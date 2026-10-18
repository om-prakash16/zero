'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Radio,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { JoinRequest, Room } from '@/lib/types';

interface SuperadminJoinRequest extends JoinRequest {
  rooms?: Pick<Room, 'code' | 'max_capacity' | 'participant_count' | 'is_active' | 'admission_mode'>;
}

export default function SuperadminRequestsPage() {
  const [requests, setRequests] = useState<SuperadminJoinRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
        search,
      });

      const res = await fetch(`/api/superadmin/requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch join requests');
      }

      const data = await res.json();
      setRequests(data.requests || []);
      setTotalRequests(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching join requests';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, statusFilter, search]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchRequests();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchRequests]);

  const handleResolve = async (requestId: string, action: 'approve' | 'decline' | 'cancel') => {
    try {
      setIsSubmitting(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/superadmin/requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          action,
          reason: 'Manual resolution by Superadmin console',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to resolve request');
      }

      await fetchRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'declined':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'cancelled':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
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
            <span>Admission & Join Requests</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">
              {totalRequests} REQUESTS
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Monitor admission queues, resolve stuck requests, and investigate capacity rejections.
          </p>
        </div>

        <button
          onClick={fetchRequests}
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
            placeholder="Search by requester name or language..."
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-zinc-300 focus:outline-hidden focus:border-rose-500 transition-colors"
          >
            <option value="pending">Pending Only</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-zinc-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Requester</th>
                <th className="py-3 px-4">Target Room</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Requested At</th>
                <th className="py-3 px-4 text-right">Superadmin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading join requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No join requests found matching the current filter.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const room = r.rooms;
                  const isRoomFull = room && room.participant_count >= room.max_capacity;

                  return (
                    <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white">{r.display_name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{r.user_id.slice(0, 8)}...</div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-rose-400 flex items-center gap-1.5">
                            <Radio className="w-3 h-3" />
                            <span>{room?.code || r.room_id.slice(0, 8)}</span>
                          </div>
                          {room && (
                            <div className="text-[10px] text-zinc-500">
                              {room.participant_count} / {room.max_capacity} Occupants {isRoomFull ? '(FULL)' : ''}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-zinc-200 font-medium">{r.language_name}</span>
                        <span className="text-zinc-500 text-[10px] ml-1 font-mono">({r.language_code})</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-zinc-400 text-[11px]">
                        {new Date(r.created_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleResolve(r.id, 'approve')}
                              disabled={isSubmitting || Boolean(isRoomFull)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                              title={isRoomFull ? 'Room is full' : 'Approve admission'}
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => handleResolve(r.id, 'decline')}
                              disabled={isSubmitting}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Decline</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalRequests} requests)
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
    </div>
  );
}
