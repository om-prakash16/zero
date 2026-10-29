'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      className={`inline-flex items-center justify-center gap-2 px-2.5 py-1.5 h-9 rounded-lg border text-xs font-medium transition-all duration-200
        border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs
        dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:shadow-none
        focus-visible:outline-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white cursor-pointer
        ${className}`}
    >
      {mounted && isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600 dark:text-zinc-300 transition-transform hover:-rotate-12" />
      )}
      {showLabel && mounted && (
        <span className="capitalize">{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
}
