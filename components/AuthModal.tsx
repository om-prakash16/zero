'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import {
  X,
  Mail,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const emptySubscribe = () => () => {};

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  // Safe close handler that resets state without cascading render effect
  const handleClose = useCallback(() => {
    setStep('email');
    setOtp(['', '', '', '', '', '']);
    setError(null);
    setSuccessMsg(null);
    onCloseRef.current();
  }, []);

  // Auto-complete login if user clicks the magic link in their email
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !session.user.is_anonymous) {
        setSuccessMsg('Successfully signed in via email!');
        setTimeout(() => {
          handleClose();
          onSuccessRef.current?.();
        }, 500);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleClose]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setError(null);

      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (authError) throw authError;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setError(msg);
      setIsGoogleLoading(false);
    }
  };

  // Step 1: Send OTP to Email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) throw otpError;

      setStep('otp');
      setCountdown(45);
      setSuccessMsg(`We sent a 6-digit verification code to ${email}`);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP box input changes
  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      // Pasting full 6-digit code
      const cleaned = val.replace(/\D/g, '').slice(0, 6);
      if (cleaned.length > 0) {
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
          newOtp[i] = cleaned[i] || '';
        }
        setOtp(newOtp);
        const nextIndex = Math.min(cleaned.length, 5);
        otpInputsRef.current[nextIndex]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto-advance to next box
    if (val && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation in OTP boxes
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Step 3: Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join('').trim();
    if (token.length !== 6) {
      setError('Please enter all 6 digits of your verification code');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      if (data.session) {
        setSuccessMsg('Successfully signed in!');
        setTimeout(() => {
          handleClose();
          onSuccess?.();
        }, 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Scrollable Center Container */}
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
        {/* Modal Card */}
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-left shadow-2xl backdrop-blur-xl transition-all my-8">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-violet-600/15 dark:bg-violet-600/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-indigo-600/15 dark:bg-indigo-600/25 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {step === 'email' ? 'Sign in to CROSSWIRE' : 'Enter Verification Code'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {step === 'email'
                ? 'Join multilingual voice debates with your speaker profile'
                : `6-digit code sent to ${email}`}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && !error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'email' ? (
            <div className="space-y-4">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-zinc-100 shadow-xs hover:bg-slate-50 dark:hover:bg-zinc-750 hover:border-slate-400 dark:hover:border-zinc-600 hover:shadow-sm focus:outline-hidden focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-zinc-400" />
                ) : (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center py-2">
                <div className="grow border-t border-slate-200 dark:border-zinc-800" />
                <span className="mx-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                  or continue with email
                </span>
                <div className="grow border-t border-slate-200 dark:border-zinc-800" />
              </div>

              {/* Email OTP Form */}
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-zinc-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      disabled={isLoading}
                      className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-violet-500 dark:focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-600/30 focus:outline-hidden focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="p-3.5 rounded-xl border border-violet-500/25 bg-violet-500/5 dark:bg-violet-500/10 text-center">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">
                  ✉️ Verification Code Sent
                </p>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                  Enter the 6-digit code sent to <strong className="text-slate-900 dark:text-white">{email}</strong> to sign in:
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-2 text-center">
                  6-Digit Verification Code
                </label>
                <div className="flex justify-center gap-2 sm:gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="h-12 w-11 sm:w-12 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/90 text-center text-xl font-bold text-slate-900 dark:text-white shadow-inner focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden focus:ring-2 focus:ring-violet-500/30 transition-all"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-600/30 focus:outline-hidden focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Verify & Sign In</span>
                  </>
                )}
              </button>

              {/* Resend and back navigation */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors underline underline-offset-2 cursor-pointer"
                >
                  Change email
                </button>

                {countdown > 0 ? (
                  <span className="text-slate-400 dark:text-zinc-500">Resend code in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors cursor-pointer"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
