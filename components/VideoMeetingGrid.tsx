'use client';

import { useEffect, useRef, useState } from 'react';
import {
  VideoOff,
  MicOff,
  Mic,
  Maximize2,
  Minimize2,
  Sparkles,
  Volume2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import type { Participant, LiveSubtitle, DubbingMode } from '@/lib/types';
import { getLanguageByCode } from '@/lib/types';

interface VideoMeetingGridProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  currentParticipant: Participant;
  otherParticipant: Participant | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  remoteMediaState: {
    isCameraOn: boolean;
    isMicOn: boolean;
  };
  liveSubtitle: LiveSubtitle | null;
  showCaptions: boolean;
  dubbingMode: DubbingMode;
  onToggleDubbingMode: () => void;
  connectionState: RTCPeerConnectionState;
  isTranslating?: boolean;
  mediaError?: string | null;
  isInsecureOrigin?: boolean;
  onRetryMedia?: () => void;
  onToggleVirtualStream?: () => void;
  onOpenPhoneModal?: () => void;
  localTranscript?: string;
  isListening?: boolean;
}

export function VideoMeetingGrid({
  localStream,
  remoteStream,
  currentParticipant,
  otherParticipant,
  isCameraOn,
  isMicOn,
  remoteMediaState,
  liveSubtitle,
  showCaptions,
  dubbingMode,
  onToggleDubbingMode,
  connectionState: _connectionState,
  isTranslating: _isTranslating = false,
  mediaError,
  isInsecureOrigin = false,
  onRetryMedia,
  onToggleVirtualStream,
  onOpenPhoneModal,
  localTranscript,
  isListening = false,
}: VideoMeetingGridProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Control remote audio volume according to dubbing mode
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (dubbingMode === 'dubbing') {
        // When dubbing is active, duck or mute raw foreign audio so translated TTS is crystal clear
        remoteVideoRef.current.volume = 0;
      } else if (dubbingMode === 'both') {
        remoteVideoRef.current.volume = 0.2; // Ducked
      } else {
        remoteVideoRef.current.volume = 1.0;
      }
    }
  }, [dubbingMode]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  const myLang = getLanguageByCode(currentParticipant.language_code);
  const theirLang = otherParticipant ? getLanguageByCode(otherParticipant.language_code) : null;
  const hasVideoTrack = !!(localStream && localStream.getVideoTracks().length > 0 && isCameraOn);
  const localhostUrl =
    typeof window !== 'undefined'
      ? `http://localhost:${window.location.port || '3000'}${window.location.pathname}${window.location.search}`
      : '';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden select-none p-3 sm:p-4"
    >
      {/* ─── Remote Participant Main Stage ─── */}
      <div className="relative w-full h-full max-w-6xl max-h-[85vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl flex items-center justify-center">
        {otherParticipant ? (
          <>
            {/* Remote Video Element */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                remoteMediaState.isCameraOn && remoteStream ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />

            {/* Remote Camera OFF Fallback Card */}
            {(!remoteMediaState.isCameraOn || !remoteStream) && (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-rose-600 p-1 shadow-xl flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold tracking-wider">
                      {otherParticipant.display_name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  {!remoteMediaState.isMicOn && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg border-2 border-slate-900">
                      <MicOff className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                    {otherParticipant.display_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                    <span>Camera is turned off</span>
                  </p>
                </div>
              </div>
            )}

            {/* Remote Participant Status Badges (Top Left) */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-white text-xs font-semibold shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{otherParticipant.display_name}</span>
                {theirLang && (
                  <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-[10px] uppercase border border-sky-500/30">
                    {theirLang.name}
                  </span>
                )}
              </div>

              {!remoteMediaState.isMicOn && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-rose-500/80 backdrop-blur-md text-white text-[11px] font-medium shadow-md">
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Muted</span>
                </div>
              )}
            </div>

            {/* Audio Dubbing Mode Badge (Top Right) */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={onToggleDubbingMode}
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 text-white text-xs font-medium shadow-lg transition-colors cursor-pointer"
                title="Toggle between Translated Voice Dubbing and Original Audio"
              >
                {dubbingMode === 'dubbing' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-spin-slow" />
                    <span className="text-rose-300 font-semibold">AI Dubbed ({myLang.name})</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                    <span>Original Audio</span>
                  </>
                )}
              </button>

              <button
                onClick={toggleFullscreen}
                type="button"
                className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 text-white flex items-center justify-center transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* ─── LIVE FLOATING CAPTIONS / SUBTITLES OVERLAY ─── */}
            {showCaptions && liveSubtitle && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="rounded-2xl bg-slate-950/85 backdrop-blur-lg border border-slate-700/70 p-4 shadow-2xl text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>{liveSubtitle.speakerName} ({liveSubtitle.sourceLanguage.toUpperCase()})</span>
                    <span>➔</span>
                    <span className="text-sky-400 font-bold">{liveSubtitle.targetLanguage.toUpperCase()} Translated</span>
                  </div>

                  {/* Primary Translated Text */}
                  <p className="text-base sm:text-lg font-bold text-white tracking-wide leading-relaxed">
                    &ldquo;{liveSubtitle.translatedText}&rdquo;
                  </p>

                  {/* Original Speech Subtext */}
                  {liveSubtitle.originalText !== liveSubtitle.translatedText && (
                    <p className="text-xs text-slate-400 font-mono truncate max-w-lg mx-auto opacity-80">
                      Original: &ldquo;{liveSubtitle.originalText}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Waiting for Partner State */
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md">
            <div className="w-20 h-20 rounded-3xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-center text-rose-400 shadow-xl">
              <Sparkles className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Ready for Conversation</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Invite your partner, interviewer, or client. Once they join, live video and real-time voice translation will activate automatically.
              </p>
            </div>
          </div>
        )}

        {/* ─── Media Error / Insecure Context Diagnostics Banner ─── */}
        {(mediaError || isInsecureOrigin) && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-35 w-11/12 max-w-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="rounded-2xl bg-slate-900/95 border border-amber-500/50 p-4 shadow-2xl backdrop-blur-md text-amber-200 text-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Camera / Microphone Access Required</span>
                    {isInsecureOrigin && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] uppercase font-mono border border-rose-500/30">
                        Insecure Origin
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {isInsecureOrigin
                      ? 'Chrome & Edge block camera/mic on plain HTTP IP addresses (e.g. 10.178.253.51). If testing on your laptop, switch to localhost:3000 to enable instant video & mic!'
                      : mediaError}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isInsecureOrigin && (
                      <a
                        href={localhostUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] shadow-sm transition-all"
                      >
                        <span>Switch to localhost:3000</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {onRetryMedia && (
                      <button
                        type="button"
                        onClick={onRetryMedia}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] border border-slate-700 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Grant Permission</span>
                      </button>
                    )}
                    {onToggleVirtualStream && (
                      <button
                        type="button"
                        onClick={onToggleVirtualStream}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shadow-sm transition-all cursor-pointer"
                        title="Use virtual animated avatar and test tone for video meetings"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Use Virtual Cam/Mic</span>
                      </button>
                    )}
                    {onOpenPhoneModal && (
                      <button
                        type="button"
                        onClick={onOpenPhoneModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-all cursor-pointer"
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>Phone Wi-Fi Guide</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Local Live Voice Input Indicator ─── */}
        {isListening && localTranscript && (
          <div className="absolute bottom-28 right-4 z-30 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="rounded-xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 p-2.5 text-xs text-white shadow-xl flex items-start gap-2">
              <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                  Microphone Active (Speaking)
                </div>
                <p className="text-slate-200 font-medium italic mt-0.5 line-clamp-2">
                  &ldquo;{localTranscript}&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Local Self-View Picture-in-Picture (Bottom-Right) ─── */}
        <div className="absolute bottom-4 right-4 z-20 w-36 h-24 sm:w-56 sm:h-36 rounded-2xl overflow-hidden bg-slate-900/90 backdrop-blur-md border-2 border-slate-700/80 shadow-2xl transition-all duration-200 hover:scale-105">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
              hasVideoTrack ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />

          {!hasVideoTrack && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center bg-slate-900 text-white p-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-base sm:text-lg border border-slate-700">
                {currentParticipant.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {!localStream ? 'Camera Blocked' : !isCameraOn ? 'Camera Off' : 'No Video Track'}
              </span>
            </div>
          )}

          {/* Local Status Pill */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-lg bg-slate-950/70 backdrop-blur-xs text-[10px] text-white font-medium">
            <span className="truncate max-w-[70px]">You</span>
            <div className="flex items-center gap-1.5">
              {!isMicOn && <MicOff className="w-3 h-3 text-rose-400" />}
              {!isCameraOn && <VideoOff className="w-3 h-3 text-amber-400" />}
              <span className="px-1 py-0.2 rounded bg-slate-800 text-[9px] font-mono uppercase text-slate-300">
                {myLang.code}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
