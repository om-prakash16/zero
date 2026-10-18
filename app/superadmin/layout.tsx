'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  LayoutDashboard,
  Users,
  Radio,
  FileCheck2,
  AlertTriangle,
  Globe,
  Activity,
  Sliders,
  FileText,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', href: '/superadmin', icon: LayoutDashboard },
  { name: 'User Accounts', href: '/superadmin/users', icon: Users },
  { name: 'Room Management', href: '/superadmin/rooms', icon: Radio },
  { name: 'Join Requests', href: '/superadmin/requests', icon: FileCheck2 },
  { name: 'Moderation Queue', href: '/superadmin/moderation', icon: AlertTriangle },
  { name: 'Multilingual Registry', href: '/superadmin/languages', icon: Globe },
  { name: 'Translation Diagnostics', href: '/superadmin/translations', icon: Activity },
  { name: 'Platform Settings', href: '/superadmin/settings', icon: Sliders },
  { name: 'Administrative Audit', href: '/superadmin/audit-logs', icon: FileText },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'>('loading');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminRole, setAdminRole] = useState<'superadmin' | 'admin'>('superadmin');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const checkAdminAuth = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setAuthState('unauthenticated');
        return;
      }

      const email = session.user?.email || '';
      setAdminEmail(email);

      // Verify on backend to prevent client-side spoofing
      const res = await fetch('/api/superadmin/overview', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.status === 401) {
        setAuthState('unauthenticated');
      } else if (res.status === 403) {
        setAuthState('unauthorized');
      } else if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.role) {
          setAdminRole(data.role as 'superadmin' | 'admin');
        }
        setAuthState('authorized');
      } else {
        setAuthState('unauthorized');
      }
    } catch {
      setAuthState('unauthorized');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      await Promise.resolve();
      if (!ignore) {
        checkAdminAuth();
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [checkAdminAuth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // 1. Loading State
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">
          Verifying Superadmin Credentials...
        </h2>
        <p className="text-xs text-zinc-500 mt-1">Cross-referencing cryptographic session & role authorizations</p>
      </div>
    );
  }

  // 2. Unauthenticated State (Prompt to sign in)
  if (authState === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Superadmin Authentication Required</h1>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Access to the CROSSWIRE administrative console requires authentication with an authorized superadmin account.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/')}
              className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Return to Login & Sign In</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unauthorized State (Authenticated user lacks superadmin role)
  if (authState === 'unauthorized') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-rose-500/20 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied: Insufficient Privileges</h1>
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            You are signed in as <strong className="text-zinc-200">{adminEmail || 'current user'}</strong>, but this account does not possess the <code className="text-rose-400 font-mono text-xs">superadmin</code> role.
          </p>
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-400 mb-6 text-left">
            <div className="font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Role-Based Access Control Notice</span>
            </div>
            Administrative operations are cryptographically verified server-side. User-metadata modifications and client-side overrides are strictly rejected.
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 h-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Back to App
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized Superadmin View
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-rose-500/30">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Toggle Navigation"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/superadmin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-xs font-bold text-sm tracking-wider">
              CW
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-widest text-slate-200 uppercase flex items-center gap-1.5">
                CROSSWIRE
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                  adminRole === 'superadmin'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {adminRole === 'superadmin' ? 'SUPERADMIN' : 'ADMIN (TESTER)'}
                </span>
              </span>
              <span className="text-[10px] text-zinc-400 hidden sm:inline">
                {adminRole === 'superadmin' ? 'Centralized Platform Control Console' : 'Inspection & Testing Mode (API Keys Guarded)'}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Live & Guarded</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <ShieldCheck className={`w-3.5 h-3.5 ${adminRole === 'superadmin' ? 'text-rose-400' : 'text-blue-400'}`} />
            <span className="max-w-[150px] truncate">{adminEmail}</span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">({adminRole})</span>
          </div>

          <ThemeToggle />

          <button
            onClick={handleSignOut}
            className="h-8 px-2.5 sm:px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`
            fixed md:static inset-y-16 md:inset-y-auto left-0 z-30
            w-64 bg-slate-950 md:bg-slate-950/50 border-r border-slate-800 flex flex-col justify-between
            transition-transform duration-200 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-3 space-y-1 overflow-y-auto">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Management Modules
            </div>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`
                    flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all
                    ${
                      isActive
                        ? 'bg-rose-600 text-white font-semibold shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500/20 text-rose-300 font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-950/80">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public App</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-900/60 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
