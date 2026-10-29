'use client';

import { useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Captions,
  MessageSquare,
  Settings,
  PhoneOff,
  Sparkles,
  X,
  ShieldCheck,
  UserCheck,
  Loader2,
} from 'lucide-react';
import type { DubbingMode } from '@/lib/types';

interface MeetingControlsProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  showCaptions: boolean;
  onToggleCaptions: () => void;
  dubbingMode: DubbingMode;
  onToggleDubbingMode: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  unreadChatCount?: number;
  onLeaveCall: () => void;
  isHost?: boolean;
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoDeviceId: string;
  selectedAudioDeviceId: string;
  onSelectVideoDevice: (deviceId: string) => void;
  onSelectAudioDevice: (deviceId: string) => void;
  sourceLanguageName: string;
  targetLanguageName?: string;
  onOpenNotes?: () => void;
  isNoiseCancellationOn?: boolean;
  onToggleNoiseCancellation?: () => void;
  noiseMetrics?: {
    rmsLevel: number;
    peakDb: number;
    isHighSoundDetected: boolean;
    isNoiseGateActive: boolean;
  };
  onEnrollVoice?: () => void;
  isEnrollingVoice?: boolean;
  enrolledVoiceCount?: number;
}

export function MeetingControls({
  isCameraOn,
  isMicOn,
  onToggleCamera,
  onToggleMic,
  showCaptions,
  onToggleCaptions,
  dubbingMode,
  onToggleDubbingMode,
  isChatOpen,
  onToggleChat,
  unreadChatCount = 0,
  onLeaveCall,
  isHost: _isHost = false,
  videoDevices,
  audioDevices,
  selectedVideoDeviceId,
  selectedAudioDeviceId,
  onSelectVideoDevice,
  onSelectAudioDevice,
  sourceLanguageName,
  targetLanguageName,
  onOpenNotes,
  isNoiseCancellationOn = true,
  onToggleNoiseCancellation,
  noiseMetrics,
  onEnrollVoice,
  isEnrollingVoice = false,
  enrolledVoiceCount = 0,
}: MeetingControlsProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      {/* ─── Bottom Floating Control Bar ─── */}
      <div className="flex-shrink-0 w-full bg-slate-900/95 dark:bg-zinc-950/95 border-t border-slate-800 backdrop-blur-md px-4 py-3 z-40 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Language Info & Translation Status */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>You: <strong>{sourceLanguageName}</strong></span>
              {targetLanguageName && (
                <>
                  <span className="text-slate-500">➔</span>
                  <span className="text-sky-400 font-semibold">{targetLanguageName}</span>
                </>
              )}
            </div>
          </div>

          {/* Center: Main Media Controls (Meet-Style) */}
          <div className="flex items-center gap-2 sm:gap-3 mx-auto sm:mx-0">
            {/* Microphone Toggle */}
            <button
              onClick={onToggleMic}
              type="button"
              title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
                isMicOn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  : 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400'
              }`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={onToggleCamera}
              type="button"
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
                isCameraOn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  : 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400'
              }`}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Captions / Subtitles (CC) Toggle */}
            <button
              onClick={onToggleCaptions}
              type="button"
              title={showCaptions ? 'Turn off live captions' : 'Turn on live captions'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
                showCaptions
                  ? 'bg-sky-600 hover:bg-sky-700 text-white ring-2 ring-sky-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Captions className="w-5 h-5" />
            </button>

            {/* Real-Time Voice Dubbing Toggle */}
            <button
              onClick={onToggleDubbingMode}
              type="button"
              title={`Voice Dubbing Mode: ${dubbingMode}`}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
                dubbingMode === 'dubbing'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </button>

            {/* AI Noise Cancellation & High-Sound Suppression Toggle */}
            {onToggleNoiseCancellation && (
              <button
                onClick={onToggleNoiseCancellation}
                type="button"
                title={
                  isNoiseCancellationOn
                    ? noiseMetrics?.isHighSoundDetected
                      ? 'AI Noise Filter: High Sound Clamped & Suppressed'
                      : 'AI Noise Filter: Active (Deep Suppression)'
                    : 'Turn on AI Noise Cancellation'
                }
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer relative ${
                  isNoiseCancellationOn
                    ? noiseMetrics?.isHighSoundDetected
                      ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                {isNoiseCancellationOn && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    {noiseMetrics?.isHighSoundDetected && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 border-2 border-slate-900 ${
                        noiseMetrics?.isHighSoundDetected ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                  </span>
                )}
              </button>
            )}

            {/* Voice ID Profiling & Speaker Identification */}
            {onEnrollVoice && (
              <button
                onClick={onEnrollVoice}
                disabled={isEnrollingVoice}
                type="button"
                title={
                  enrolledVoiceCount > 0
                    ? `Voice ID Calibrated (${enrolledVoiceCount} profile enrolled). Click to re-calibrate.`
                    : 'Calibrate Voice ID Profile for Real-Time Speaker Identification'
                }
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer relative ${
                  isEnrollingVoice
                    ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                    : enrolledVoiceCount > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white ring-2 ring-purple-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {isEnrollingVoice ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
                {enrolledVoiceCount > 0 && !isEnrollingVoice && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-400 border-2 border-slate-900" />
                )}
              </button>
            )}

            {/* Device Settings Dropdown Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              type="button"
              title="Camera and microphone settings"
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
                showSettings
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Leave / End Call Button */}
            <button
              onClick={onLeaveCall}
              type="button"
              title="Leave conversation"
              className="px-5 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all duration-200 active:scale-95 cursor-pointer ml-1 sm:ml-3"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>

          {/* Right: AI Notes & Chat Sidebar Toggle */}
          <div className="flex items-center gap-2">
            {onOpenNotes && (
              <button
                onClick={onOpenNotes}
                type="button"
                title="AI Meeting Notes & Intelligence (Python Engine)"
                className="px-3.5 h-11 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 hover:border-purple-500/60 hover:text-white transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="hidden sm:inline">AI Notes</span>
              </button>
            )}

            <button
              onClick={onToggleChat}
              type="button"
              title={isChatOpen ? 'Close chat panel' : 'Open chat panel'}
              className={`relative px-4 h-11 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all duration-200 border cursor-pointer ${
                isChatOpen
                  ? 'bg-white text-slate-900 border-white shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/80'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Device Settings Modal ─── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">Audio & Video Settings</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                type="button"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Camera Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Video className="w-4 h-4 text-sky-400" />
                <span>Web Camera</span>
              </label>
              <select
                value={selectedVideoDeviceId}
                onChange={(e) => onSelectVideoDevice(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-rose-500 transition-colors cursor-pointer"
              >
                {videoDevices.length > 0 ? (
                  videoDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default Web Camera</option>
                )}
              </select>
            </div>

            {/* Microphone Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Microphone</span>
              </label>
              <select
                value={selectedAudioDeviceId}
                onChange={(e) => onSelectAudioDevice(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-rose-500 transition-colors cursor-pointer"
              >
                {audioDevices.length > 0 ? (
                  audioDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Microphone ${idx + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default Microphone</option>
                )}
              </select>
            </div>

            {/* Dubbing & Audio Routing Mode */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Audio Dubbing Mode</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleDubbingMode}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    dubbingMode === 'dubbing'
                      ? 'bg-rose-950/40 border-rose-500 text-rose-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-bold text-white mb-0.5">AI Voice Dubbing</p>
                  <p className="text-[11px] leading-tight">Hear partner translated into your language</p>
                </button>

                <button
                  type="button"
                  onClick={onToggleDubbingMode}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    dubbingMode === 'subtitles_only'
                      ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-bold text-white mb-0.5">Subtitles Only</p>
                  <p className="text-[11px] leading-tight">Hear original audio, read live captions</p>
                </button>
              </div>
            </div>

            {/* Acoustic AI & Noise Suppression */}
            {onToggleNoiseCancellation && (
              <div className="space-y-2 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-white">AI Deep Noise Suppression</p>
                      <p className="text-[11px] text-slate-400">
                        Filters background hum, traffic, fans & clamps sudden loud sounds
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleNoiseCancellation}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isNoiseCancellationOn
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {isNoiseCancellationOn ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {isNoiseCancellationOn && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
                    <span>Acoustic Protection Status:</span>
                    <span className={noiseMetrics?.isHighSoundDetected ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                      {noiseMetrics?.isHighSoundDetected ? 'High Sound Clamped' : 'Optimal Voice Bandpass'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Voice Identification Profile Section */}
            {onEnrollVoice && (
              <div className="space-y-2 p-3 rounded-xl bg-purple-950/30 border border-purple-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Voice Identification (Speaker Diarization)</p>
                      <p className="text-[11px] text-slate-300">
                        {enrolledVoiceCount > 0
                          ? `Enrolled (${enrolledVoiceCount} active profile in room)`
                          : 'Not calibrated yet. Enroll your voice signature.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onEnrollVoice}
                    disabled={isEnrollingVoice}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isEnrollingVoice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isEnrollingVoice ? 'Recording 2.5s...' : 'Calibrate Voice'}</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSettings(false)}
              type="button"
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
