'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, X, Copy, Check, Wifi, ExternalLink, ShieldAlert } from 'lucide-react';

interface PhoneConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode?: string;
}

export function PhoneConnectModal({ isOpen, onClose, roomCode }: PhoneConnectModalProps) {
  const [networkIp, setNetworkIp] = useState<string>('10.178.253.51');
  const [copied, setCopied] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ip) setNetworkIp(data.ip);
      })
      .catch(() => {
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          setNetworkIp(window.location.hostname);
        }
      });
  }, []);

  if (!isOpen || !mounted) return null;

  const targetUrl = roomCode
    ? `http://${networkIp}:3000/room/${roomCode}`
    : `http://${networkIp}:3000`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    targetUrl
  )}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Header */}
          <div className="w-13 h-13 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Smartphone className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold mb-2">
            <Wifi className="w-3 h-3" />
            <span>Same Wi-Fi / Local Network</span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {roomCode ? 'Join Room from Phone' : 'Open CROSSWIRE on Phone'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 mb-4 leading-relaxed">
            Scan this QR code with your phone camera to test live translation side-by-side with your laptop.
          </p>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-inner inline-block mx-auto mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl}
              alt="Scan QR code to open on mobile"
              className="w-48 h-48 rounded-xl object-contain"
              loading="eager"
            />
          </div>

          {/* Direct Link & One-Click Copy */}
          <div className="space-y-2 text-left mb-4">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center justify-between">
              <span>Direct Mobile Link</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                IP: {networkIp}
              </span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
              <span className="font-mono text-xs text-slate-800 dark:text-zinc-200 truncate flex-1 select-all font-medium">
                {targetUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-white dark:bg-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-650 text-slate-700 dark:text-zinc-200 text-xs font-semibold cursor-pointer shadow-2xs shrink-0 flex items-center gap-1 transition-all"
                title="Copy mobile link"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Step Guide */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 text-[11px] text-slate-600 dark:text-zinc-400 text-left space-y-1.5 border border-slate-200/80 dark:border-zinc-800 mb-3">
            <div className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>⚡ 3-Step Phone + Laptop Test:</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-zinc-300">1.</span> Connect phone to the <strong>same Wi-Fi</strong>.
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-zinc-300">2.</span> Point phone camera at QR or open the link above.
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-zinc-300">3.</span> Pick English on laptop and another language on phone — speak to experience instant AI voice dubbing!
            </div>
          </div>

          {/* Chrome Mobile HTTP Mic Flag Note */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left text-[10px] text-amber-800 dark:text-amber-300/90 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Mobile Chrome Camera/Mic Tip:</span> Chrome on Android requires plain HTTP LAN IPs to be trusted for mic/camera access via{' '}
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.2 rounded font-mono text-[9px]">
                chrome://flags/#unsafely-treat-insecure-origin-as-secure
              </code>{' '}
              (add <code className="font-mono text-[9px]">{`http://${networkIp}:3000`}</code>). Live text chat & AI audio playback work immediately without any flags!
            </div>
          </div>

          {/* External open button */}
          <div className="mt-4">
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
            >
              <span>Open in new tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
