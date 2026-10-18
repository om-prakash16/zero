'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { LogIn, LogOut, Loader2, Crown, ShieldCheck, User as UserIcon } from 'lucide-react';
import { AuthModal } from '@/components/AuthModal';

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only treat non-anonymous users as authenticated in the UI
      if (session?.user && !session.user.is_anonymous) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !session.user.is_anonymous) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/50">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    );
  }

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
    user?.user_metadata?.is_super_admin === true;

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
                  isSuperAdmin ? 'ring-amber-400' : 'ring-violet-500/40'
                }`}
              />
            ) : (
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full font-bold text-[11px] ${
                  isSuperAdmin
                    ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300'
                    : 'bg-violet-600/40 text-violet-300'
                }`}
              >
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>

            {isSuperAdmin && (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                <Crown className="h-3 w-3 text-amber-400" />
                <span className="hidden md:inline">SUPER ADMIN</span>
              </span>
            )}
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

                {isSuperAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer border border-amber-500/20"
                  >
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                    <span>Super Admin Console</span>
                  </Link>
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
        <button
          onClick={() => setIsAuthOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/10 hover:bg-violet-600/20 px-3.5 py-1.5 text-xs font-medium text-violet-300 hover:text-violet-200 transition-all hover:border-violet-500/60 shadow-sm cursor-pointer"
        >
          <LogIn className="h-3.5 w-3.5" />
          <span>Sign In</span>
        </button>
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
