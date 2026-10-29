'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { LogIn, LogOut, Crown, ShieldCheck, User as UserIcon, LayoutDashboard, Activity, UserCheck } from 'lucide-react';
import { AuthModal } from '@/components/AuthModal';
import { getPersistentGuestUid } from '@/lib/guestUser';

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!isSupabaseConfigured) {
      return;
    }

    // Check active session safely with catch
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (isCancelled) return;
        if (session?.user && !session.user.is_anonymous) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setUser(null);
      });

    // Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isCancelled) return;
      if (session?.user && !session.user.is_anonymous) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setIsMenuOpen(false);
  };

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.identities?.[0]?.identity_data?.avatar_url ||
    user?.identities?.[0]?.identity_data?.picture;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.identities?.[0]?.identity_data?.full_name ||
    user?.email?.split('@')[0] ||
    'Debater';

  const isSuperAdmin =
    user?.email?.toLowerCase() === 'prakash.om.global@gmail.com' ||
    user?.user_metadata?.role === 'super_admin' ||
    user?.user_metadata?.role === 'superadmin' ||
    user?.user_metadata?.is_super_admin === true;

  const isAdmin =
    user?.email?.toLowerCase() === 'admin@roomchat.com' ||
    user?.user_metadata?.role === 'admin';

  const hasAdminAccess = isSuperAdmin || isAdmin;

  const username = user?.user_metadata?.username;
  const age = user?.user_metadata?.age;
  const gender = user?.user_metadata?.gender;

  return (
    <>
      {user ? (
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              isSuperAdmin
                ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-violet-500/15 text-white hover:border-amber-400 shadow-xs'
                : isAdmin
                ? 'border-rose-500/50 bg-gradient-to-r from-rose-500/15 to-amber-500/15 text-white hover:border-rose-400 shadow-xs'
                : 'border-zinc-700/80 bg-zinc-800/80 text-white hover:bg-zinc-750 hover:border-zinc-600'
            }`}
          >
            {avatarUrl && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={() => setImgError(true)}
                className={`h-6 w-6 rounded-full object-cover ring-1 ${
                  isSuperAdmin ? 'ring-amber-400' : isAdmin ? 'ring-rose-400' : 'ring-violet-500/40'
                }`}
              />
            ) : (
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full font-bold text-[11px] ${
                  isSuperAdmin
                    ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300'
                    : isAdmin
                    ? 'bg-rose-500 text-white ring-1 ring-rose-300'
                    : 'bg-violet-600/40 text-violet-300'
                }`}
              >
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>

            {isSuperAdmin ? (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                <Crown className="h-3 w-3 text-amber-400" />
                <span className="hidden md:inline">SUPER ADMIN</span>
              </span>
            ) : isAdmin ? (
              <span className="flex items-center gap-1 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                <ShieldCheck className="h-3 w-3 text-rose-400" />
                <span className="hidden md:inline">ADMIN</span>
              </span>
            ) : null}
          </button>

          {/* User dropdown menu */}
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 mt-2 z-50 w-64 rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2.5 border-b border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/40">
                        <Crown className="h-2.5 w-2.5" />
                        SUPER ADMIN
                      </span>
                    ) : isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-300 border border-rose-500/40">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        ADMIN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-medium text-violet-300">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        VERIFIED
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>

                  {username && (
                    <p className="text-[10px] text-violet-400 flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      <span>ID: @{username}</span>
                    </p>
                  )}

                  {(age || gender) && (
                    <p className="text-[10px] text-zinc-400">
                      {age ? `Age: ${age}` : ''} {age && gender ? '•' : ''} {gender ? `Gender: ${gender}` : ''}
                    </p>
                  )}
                </div>

                {hasAdminAccess && (
                  <div className="space-y-1 my-1">
                    <Link
                      href="/superadmin"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-rose-500/20"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 text-rose-400" />
                      <span>{isSuperAdmin ? 'Super Admin Management' : 'Admin Control Center'}</span>
                    </Link>

                    <Link
                      href="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer border border-amber-500/20"
                    >
                      <Activity className="h-3.5 w-3.5 text-amber-400" />
                      <span>All Users & Messages Feed</span>
                    </Link>
                  </div>
                )}

                <button
                  onClick={handleSignOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                getPersistentGuestUid();
                window.dispatchEvent(new CustomEvent('crosswire:open-create-room'));
              }
            }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 dark:border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-all shadow-2xs cursor-pointer"
            title="Use CROSSWIRE immediately without creating an account"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Guest</span>
          </button>

          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#B5282A]/30 bg-[#B5282A]/10 hover:bg-[#B5282A]/20 px-3 py-1.5 text-xs font-semibold text-[#B5282A] dark:text-[#ff6b6d] transition-all hover:border-[#B5282A]/50 shadow-xs cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => setIsAuthOpen(false)}
      />
    </>
  );
}
