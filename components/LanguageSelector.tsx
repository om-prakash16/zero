'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Globe, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import {
  LANGUAGE_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  searchLanguages,
  getLanguageEntry,
  getRecentLanguages,
  addRecentLanguage,
  type LanguageEntry,
  type LanguageCategory,
} from '@/lib/languages';

type Props = {
  selectedCode: string;
  onSelect: (code: string) => void;
  /** Trigger element style. */
  variant?: 'compact' | 'full';
  /** Exclude these codes from the list (e.g. the other participant's language). */
  excludeCodes?: string[];
  /** Disable interactivity. */
  disabled?: boolean;
  /** Label shown above the trigger. */
  label?: string;
  /** Custom trigger render function. */
  customTrigger?: (props: {
    onClick: () => void;
    isOpen: boolean;
    selectedLang: LanguageEntry;
    disabled: boolean;
  }) => React.ReactNode;
};

function CapabilityDot({ level }: { level: string }) {
  const color =
    level === 'supported'
      ? 'bg-emerald-500'
      : level === 'partial'
      ? 'bg-amber-400'
      : level === 'unsupported'
      ? 'bg-slate-300 dark:bg-zinc-600'
      : 'bg-slate-200 dark:bg-zinc-700';

  return <span className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />;
}

export function LanguageSelector({
  selectedCode,
  onSelect,
  variant = 'full',
  excludeCodes = [],
  disabled = false,
  label,
  customTrigger,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedLang = getLanguageEntry(selectedCode);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Recent languages
  const recentCodes = useMemo(() => (isOpen ? getRecentLanguages() : []), [isOpen]);
  const recentEntries = useMemo(
    () =>
      recentCodes
        .map((c) => LANGUAGE_REGISTRY.find((l) => l.code === c))
        .filter((l): l is LanguageEntry => !!l && !excludeCodes.includes(l.code)),
    [recentCodes, excludeCodes]
  );

  // Filter by search
  const excludeSet = useMemo(() => new Set(excludeCodes), [excludeCodes]);
  const filtered = useMemo(() => {
    const all = searchLanguages(query);
    return all.filter((l) => !excludeSet.has(l.code));
  }, [query, excludeSet]);

  // Group filtered by category
  const grouped = useMemo(() => {
    const map = new Map<LanguageCategory, LanguageEntry[]>();
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((l) => l.category === cat);
      if (items.length > 0) map.set(cat, items);
    }
    return map;
  }, [filtered]);

  const handleSelect = useCallback(
    (code: string) => {
      addRecentLanguage(code);
      onSelect(code);
      setIsOpen(false);
    },
    [onSelect]
  );

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const renderEntry = (lang: LanguageEntry) => {
    const isSelected = lang.code === selectedCode;
    const capT = lang.capabilities.translation;
    const capR = lang.capabilities.speechRecognition;
    const capS = lang.capabilities.speechSynthesis;

    return (
      <button
        key={lang.code}
        type="button"
        onClick={() => handleSelect(lang.code)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer group ${
          isSelected
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold'
            : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-800 dark:text-zinc-200'
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1 mr-2">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{lang.name}</span>
            {lang.region && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
                ({lang.region})
              </span>
            )}
            {lang.script && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-normal border border-slate-200/50 dark:border-zinc-700/50">
                {lang.script}
              </span>
            )}
          </div>
          <span
            className="text-[11px] text-slate-500 dark:text-zinc-400 truncate font-normal"
            dir={lang.dir}
          >
            {lang.nativeName}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Capability dots: Translation, Speech-Rec, Speech-Synth */}
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity" title={`Translation: ${capT} | Speech-Rec: ${capR} | Voice: ${capS}`}>
            <CapabilityDot level={capT} />
            <CapabilityDot level={capR} />
            <CapabilityDot level={capS} />
          </div>
          {isSelected && <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />}
        </div>
      </button>
    );
  };

  const dropdown = isOpen && typeof window !== 'undefined' && (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-24 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        className="w-full max-w-md max-h-[70vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Search */}
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-rose-500" />
              Select Language
            </h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, script, or code..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-hidden focus:border-rose-400 dark:focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Capability Legend */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-zinc-500">
            <span className="flex items-center gap-1">
              <CapabilityDot level="supported" /> Supported
            </span>
            <span className="flex items-center gap-1">
              <CapabilityDot level="partial" /> Partial
            </span>
            <span className="flex items-center gap-1">
              <CapabilityDot level="unsupported" /> Unavailable
            </span>
            <span className="ml-auto text-[9px] opacity-70">Translation · Speech · Voice</span>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {/* Recently Used */}
          {!query && recentEntries.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                <Clock className="w-3 h-3" />
                Recently Used
              </div>
              {recentEntries.map(renderEntry)}
              <div className="mx-2 mt-1.5 border-b border-slate-100 dark:border-zinc-800" />
            </div>
          )}

          {/* Categorized */}
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat);
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="mb-1">
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800">
                  {CATEGORY_LABELS[cat]}
                  <span className="ml-1.5 font-normal">({items.length})</span>
                </div>
                <div className="py-0.5">{items.map(renderEntry)}</div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center text-slate-500 dark:text-zinc-400">
              <AlertTriangle className="w-5 h-5 mb-2 text-slate-300 dark:text-zinc-600" />
              <p className="text-xs font-medium">No languages match &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] mt-1 text-slate-400 dark:text-zinc-500">
                Try searching in English, native script, or language code.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
      )}

      {customTrigger ? (
        <div ref={triggerRef as unknown as React.RefObject<HTMLDivElement>}>
          {customTrigger({
            onClick: () => !disabled && setIsOpen(!isOpen),
            isOpen,
            selectedLang,
            disabled,
          })}
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center justify-between gap-2 rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            variant === 'compact'
              ? 'px-2.5 py-1.5 text-xs font-medium border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
              : 'w-full px-3 py-2.5 text-xs font-medium border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-800 text-slate-900 dark:text-white focus:border-violet-500'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span className="truncate font-semibold">{selectedLang.name}</span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate font-normal" dir={selectedLang.dir}>
              {selectedLang.nativeName !== selectedLang.name ? selectedLang.nativeName : ''}
            </span>
            {selectedLang.region && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                ({selectedLang.region})
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
        </button>
      )}

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
