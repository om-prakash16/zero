'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Zap,
  Menu,
  X,
  Mic,
  Hash,
  ChevronRight,
  Globe,
  UserCheck,
  Smartphone,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserNav } from '@/components/UserNav';
import { PhoneConnectModal } from '@/components/PhoneConnectModal';
import { getPersistentGuestUid } from '@/lib/guestUser';

interface NavbarProps {
  onStartArgument?: () => void;
  onJoinRoom?: () => void;
}

export function Navbar({ onStartArgument, onJoinRoom }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Detect scroll for border and elevation
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (pathname !== '/') {
      router.push(`/#${id}`);
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? 'border-b border-slate-200/90 dark:border-zinc-800/90 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md shadow-xs'
          : 'border-b border-slate-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Brand Wordmark */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            aria-label="CROSSWIRE Home"
            className="group flex items-center gap-2.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg p-1"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-sm shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white font-mono">
                CROSSWIRE
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Live
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('languages')}
              className="px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              Languages
            </button>
          </nav>
        </div>

        {/* Right Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Quick Join trigger */}
          <button
            onClick={() => {
              if (onJoinRoom) {
                onJoinRoom();
              } else {
                scrollToSection('join');
              }
            }}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 transition-all cursor-pointer"
          >
            <Hash className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            <span>Join Room</span>
          </button>

          {/* Guest Access Pill */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                getPersistentGuestUid();
                window.dispatchEvent(new CustomEvent('crosswire:open-create-room'));
              }
            }}
            type="button"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/30 dark:border-emerald-500/25 transition-all cursor-pointer shadow-2xs"
            title="Use CROSSWIRE immediately without creating an account"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Guest Room</span>
          </button>

          {/* Connect Phone on Same Wi-Fi */}
          <button
            onClick={() => setPhoneModalOpen(true)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/30 dark:border-emerald-500/25 transition-all cursor-pointer shadow-2xs"
            title="Scan QR to open CROSSWIRE on Phone (Same Wi-Fi Network)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Phone</span>
          </button>

          {/* Primary CTA */}
          <button
            onClick={() => {
              if (onStartArgument) {
                onStartArgument();
              } else {
                scrollToSection('create');
              }
            }}
            type="button"
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl shadow-xs shadow-rose-600/20 hover:shadow-md hover:shadow-rose-600/30 transition-all cursor-pointer active:scale-98"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Start an Argument</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1" />

          {/* Theme Toggle */}
          <ThemeToggle showLabel={false} />

          {/* User Sign In / Profile */}
          <UserNav />
        </div>

        {/* Mobile Hamburger & Controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle showLabel={false} />
          <UserNav />

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            className="p-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="md:hidden border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-150"
        >
          <div className="px-4 pt-3 pb-6 space-y-3">
            {/* Nav links */}
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition-colors cursor-pointer"
              >
                <span>How It Works</span>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition-colors cursor-pointer"
              >
                <span>Features</span>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              </button>
              <button
                onClick={() => scrollToSection('languages')}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition-colors cursor-pointer"
              >
                <span>Supported Languages</span>
                <Globe className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 space-y-2">
              <button
                onClick={() => {
                  if (onStartArgument) {
                    onStartArgument();
                  } else {
                    scrollToSection('create');
                  }
                  setMobileMenuOpen(false);
                }}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-600/25 transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Start an Argument</span>
              </button>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    getPersistentGuestUid();
                    window.dispatchEvent(new CustomEvent('crosswire:open-create-room'));
                  }
                  setMobileMenuOpen(false);
                }}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 dark:border-emerald-500/25 shadow-2xs transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Instant Guest Mode (No Sign-in)</span>
              </button>

              <button
                onClick={() => {
                  if (onJoinRoom) {
                    onJoinRoom();
                  } else {
                    scrollToSection('join');
                  }
                  setMobileMenuOpen(false);
                }}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-sm text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-850 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Hash className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <span>Join with Room Code</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPhoneModalOpen(true);
                }}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 dark:border-emerald-500/25 shadow-2xs transition-all cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Connect Phone (Same Wi-Fi)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Device Phone QR Connect Modal */}
      <PhoneConnectModal isOpen={phoneModalOpen} onClose={() => setPhoneModalOpen(false)} />
    </header>
  );
}
