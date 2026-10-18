'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Crown,
  MessageSquare,
  Radio,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole, UserStatus } from '@/lib/types';

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Confirmations
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pendingAction, setPendingAction] = useState<'update_role' | 'suspend' | 'reactivate' | 'ban' | 'delete' | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [actionReason, setActionReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setError(null);
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        role: roleFilter,
        status: statusFilter,
      });

      const res = await fetch(`/api/superadmin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users || []);
      setTotalUsers(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching users';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, search, roleFilter, statusFilter]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        fetchUsers();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [fetchUsers]);

  const executeUserAction = async () => {
    if (!selectedUser || !pendingAction) return;

    try {
      setIsSubmittingAction(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      if (pendingAction === 'delete') {
        const res = await fetch(`/api/superadmin/users?userId=${selectedUser.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to delete user');
        }
      } else {
        const res = await fetch('/api/superadmin/users', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            action: pendingAction,
            role: pendingAction === 'update_role' ? selectedRole : undefined,
            reason: actionReason,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to execute user action');
        }
      }

      // Close modal and refresh list
      setSelectedUser(null);
      setPendingAction(null);
      setActionReason('');
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'moderator':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'room_creator':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'suspended':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'banned':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-500" />
            <span>User Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium">
              {totalUsers} ACCOUNTS
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Role elevation controls, session actions, safety suspensions, and identity audits.
          </p>
        </div>

        <button
          onClick={fetchUsers}
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
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by email, name, username, or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-rose-500 transition-colors"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-zinc-300 focus:outline-hidden focus:border-rose-500 transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="room_creator">Room Creator</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-zinc-300 focus:outline-hidden focus:border-rose-500 transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-zinc-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User Identity</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Platform Activity</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No users match the search and filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                          {u.display_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{u.display_name || 'Anonymous User'}</span>
                            {u.role === 'superadmin' && (
                              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {u.email || u.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium ${getStatusBadge(u.status)}`}>
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1" title="Rooms Created">
                          <Radio className="w-3 h-3 text-rose-400" />
                          <span>{u.room_count ?? 0}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Messages Sent">
                          <MessageSquare className="w-3 h-3 text-blue-400" />
                          <span>{u.message_count ?? 0}</span>
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-zinc-400 text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setSelectedRole(u.role);
                            setPendingAction('update_role');
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Role
                        </button>

                        {u.status === 'active' ? (
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setPendingAction('suspend');
                            }}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setPendingAction('reactivate');
                            }}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setPendingAction('delete');
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
            Showing Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalUsers} total)
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

      {/* Confirmation Modal */}
      {selectedUser && pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white capitalize">
                  Confirm {pendingAction.replace('_', ' ')}
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  Target: {selectedUser.email || selectedUser.id}
                </p>
              </div>
            </div>

            {pendingAction === 'update_role' && (
              <div className="space-y-2 text-xs">
                <label className="text-zinc-300 font-medium">Select New Account Role:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-hidden focus:border-rose-500"
                >
                  <option value="user">User</option>
                  <option value="room_creator">Room Creator</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="text-zinc-300 font-medium">Administrative Reason (Audit Log):</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Required documentation for security review..."
                rows={3}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setPendingAction(null);
                  setActionReason('');
                }}
                disabled={isSubmittingAction}
                className="flex-1 h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeUserAction}
                disabled={isSubmittingAction}
                className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Execute Action</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
