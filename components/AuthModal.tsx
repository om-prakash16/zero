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
  Lock,
  User as UserIcon,
  Sparkles,
  Eye,
  EyeOff,
  Crown,
  HelpCircle,
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

  // Mode: 'signin' | 'signup' | 'forgot_password' | 'update_password'
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password' | 'update_password'>('signin');
  const [signInMethod, setSignInMethod] = useState<'password' | 'otp'>('password');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 8-Digit OTP State for alternative sign-in
  const [otp, setOtp] = useState<string[]>(() => Array(8).fill(''));
  const [countdown, setCountdown] = useState(0);

  // Status & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  // Listen for Supabase PASSWORD_RECOVERY event
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update_password');
        setError(null);
        setSuccessMsg('You are verified! Please enter your new password.');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Safe close handler
  const handleClose = useCallback(() => {
    setMode('signin');
    setSignInMethod('password');
    setOtp(Array(8).fill(''));
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
    onCloseRef.current();
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Email format validation helper
  const isValidEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  // Google OAuth
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

  // 1. SIGN IN WITH PASSWORD
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email or user ID and password');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const rawInput = email.trim().toLowerCase();
      const resolvedEmail =
        rawInput === 'prakash' || rawInput === 'admin'
          ? 'prakash.om.global@gmail.com'
          : rawInput;

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (signInErr) {
        if (
          signInErr.message.includes('Invalid login credentials') ||
          signInErr.message.includes('invalid_credentials')
        ) {
          throw new Error('Invalid email or password. Please verify your credentials and try again.');
        } else if (signInErr.message.includes('Email not confirmed')) {
          throw new Error('Email not yet confirmed. Please check your inbox for the confirmation link.');
        } else {
          throw signInErr;
        }
      }

      if (data.session) {
        setSuccessMsg('Welcome back! Successfully signed in.');
        setTimeout(() => {
          handleClose();
          onSuccessRef.current?.();
        }, 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. SIGN UP WITH EMAIL & PASSWORD
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address (e.g., name@example.com)');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password confirmation.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const trimmedEmail = email.trim().toLowerCase();
      const isSuperAdmin = trimmedEmail === 'prakash.om.global@gmail.com';

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            role: isSuperAdmin ? 'superadmin' : 'user',
          },
        },
      });

      if (signUpErr) {
        if (
          signUpErr.message.includes('User already registered') ||
          signUpErr.message.includes('already exists')
        ) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        } else {
          throw signUpErr;
        }
      }

      // Check if user already exists (Supabase returns empty identities array when email enumeration protection is on)
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }

      if (data.session) {
        setSuccessMsg('Account created successfully! Welcome to CROSSWIRE.');
        setTimeout(() => {
          handleClose();
          onSuccessRef.current?.();
        }, 800);
      } else {
        setSuccessMsg('Account registered! A confirmation link has been sent to your email.');
        setTimeout(() => {
          setMode('signin');
        }, 2000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. PASSWORD RESET REQUEST
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address to receive password reset instructions');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const redirectUrl = `${window.location.origin}/auth/callback?next=/`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (resetErr) throw resetErr;

      setSuccessMsg(`Password reset instructions sent to ${trimmedEmail}. Please check your inbox.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. UPDATE PASSWORD (When authenticated via recovery link)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });

      if (updateErr) throw updateErr;

      setSuccessMsg('Password updated successfully! Welcome back.');
      setTimeout(() => {
        handleClose();
        onSuccessRef.current?.();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. SIGN IN WITH 8-DIGIT OTP
  const handleSendSignInOtp = async (e: React.FormEvent) => {
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
          shouldCreateUser: false,
        },
      });

      if (otpError) throw otpError;

      setSignInMethod('otp');
      setCountdown(45);
      setSuccessMsg(`We sent an 8-digit verification code to ${email}`);
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

  // Handle 8-Digit OTP Input
  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 8);
      if (cleaned.length > 0) {
        const newOtp = Array(8).fill('');
        for (let i = 0; i < 8; i++) {
          newOtp[i] = cleaned[i] || '';
        }
        setOtp(newOtp);
        const nextIndex = Math.min(cleaned.length, 7);
        otpInputsRef.current[nextIndex]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 7) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // VERIFY OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join('').trim();
    if (token.length !== 8) {
      setError('Please enter all 8 digits of your verification code');
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
          onSuccessRef.current?.();
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

  const isSuperAdminUser =
    email.trim().toLowerCase() === 'prakash.om.global@gmail.com' ||
    email.trim().toLowerCase() === 'prakash';

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
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Super Admin Tag if matching email */}
          {isSuperAdminUser && (
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Crown className="h-3.5 w-3.5" />
              <span>Super Admin Account</span>
            </div>
          )}

          {/* Header */}
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#B5282A] to-[#FFAA00] text-white shadow-lg shadow-[#B5282A]/25">
              {mode === 'signup' ? (
                <Sparkles className="h-6 w-6" />
              ) : mode === 'forgot_password' || mode === 'update_password' ? (
                <HelpCircle className="h-6 w-6" />
              ) : (
                <KeyRound className="h-6 w-6" />
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {mode === 'signin'
                ? 'Sign In to CROSSWIRE'
                : mode === 'signup'
                ? 'Create Your Account'
                : mode === 'forgot_password'
                ? 'Reset Your Password'
                : 'Set New Password'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {mode === 'signin'
                ? 'Access your speaker profile and multilingual debate rooms'
                : mode === 'signup'
                ? 'Sign up with email and password to start debating'
                : mode === 'forgot_password'
                ? 'Enter your email address to receive reset instructions'
                : 'Choose a strong password with at least 6 characters'}
            </p>
          </div>

          {/* Mode Switch Tabs (Sign In vs Create Account) */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="mb-5 flex rounded-xl bg-slate-100 dark:bg-zinc-800/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: SIGN IN MODE */}
          {/* ================================================================= */}
          {mode === 'signin' && (
            <div className="space-y-4">
              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-100 shadow-xs hover:bg-slate-50 dark:hover:bg-zinc-750 hover:border-slate-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-zinc-400" />
                ) : (
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
              <div className="relative flex items-center justify-center py-1">
                <div className="grow border-t border-slate-200 dark:border-zinc-800" />
                <span className="mx-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                  or sign in with password
                </span>
                <div className="grow border-t border-slate-200 dark:border-zinc-800" />
              </div>

              {signInMethod === 'password' ? (
                <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Email Address or User ID
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="prakash or you@example.com"
                        required
                        className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot_password');
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] text-[#B5282A] dark:text-[#ff6b6d] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !email || !password}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B5282A] hover:bg-[#9E1B1D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#B5282A]/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Sign In</span>}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setSignInMethod('otp')}
                      className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:underline cursor-pointer"
                    >
                      Sign in with OTP code instead
                    </button>
                  </div>
                </form>
              ) : (
                /* Sign in with 8-digit OTP */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-center">
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                      8-digit verification code sent to <strong className="text-slate-900 dark:text-white">{email}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-2 text-center">
                      8-Digit Code
                    </label>
                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      {otp.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputsRef.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          className="h-11 w-8 sm:w-9 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-center text-lg font-bold text-slate-900 dark:text-white shadow-inner focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otp.join('').length !== 8}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B5282A] hover:bg-[#9E1B1D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#B5282A]/25 transition-all disabled:opacity-50 cursor-pointer"
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

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
                    <button
                      type="button"
                      onClick={() => setSignInMethod('password')}
                      className="hover:underline cursor-pointer"
                    >
                      Use Password instead
                    </button>
                    {countdown > 0 ? (
                      <span>Resend in {countdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendSignInOtp}
                        className="text-[#B5282A] dark:text-[#ff6b6d] hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: SIGN UP / REGISTRATION MODE (Direct Email & Password) */}
          {/* ================================================================= */}
          {mode === 'signup' && (
            <form onSubmit={handleEmailSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Smith"
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Create Password (minimum 6 characters)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !fullName || !email || !password || !confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B5282A] hover:bg-[#9E1B1D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#B5282A]/25 transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Create Free Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 3: FORGOT PASSWORD / RESET PASSWORD MODE */}
          {/* ================================================================= */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Your Account Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B5282A] hover:bg-[#9E1B1D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#B5282A]/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Send Password Reset Instructions</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:underline cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 4: UPDATE PASSWORD (Via Recovery Token) */}
          {/* ================================================================= */}
          {mode === 'update_password' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-zinc-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:border-[#B5282A] focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B5282A] hover:bg-[#9E1B1D] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#B5282A]/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Save New Password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
