'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
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

  return (
    <>
      {user ? (
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-zinc-750 hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            {avatarUrl && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={() => setImgError(true)}
                className="h-6 w-6 rounded-full object-cover ring-1 ring-violet-500/40"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/40 text-violet-300 font-bold text-[11px]">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
          </button>

          {/* User dropdown menu */}
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 z-50 w-56 rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-zinc-800">
                  <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
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
          className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/10 hover:bg-violet-600/20 px-3.5 py-1.5 text-xs font-medium text-violet-300 hover:text-violet-200 transition-all hover:border-violet-500/60 shadow-sm"
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
