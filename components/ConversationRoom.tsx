'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  stopSpeech,
  queueSpeech,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '@/lib/speech';
import type {
  Room,
  Participant,
  Message,
  ConversationStatus,
  JoinRequest,
  AdmissionMode,
  MessageTranslation,
  LiveSubtitle,
  DubbingMode,
  RoomViewMode,
} from '@/lib/types';
import { getLanguageByCode } from '@/lib/types';
import { MessageList } from '@/components/MessageList';
import { SpeakingPanel } from '@/components/SpeakingPanel';
import { RoomHeader } from '@/components/RoomHeader';
import { VideoMeetingGrid } from '@/components/VideoMeetingGrid';
import { MeetingControls } from '@/components/MeetingControls';
import { AIMeetingNotesModal } from '@/components/AIMeetingNotesModal';
import { PhoneConnectModal } from '@/components/PhoneConnectModal';
import { useWebRTC } from '@/lib/hooks/useWebRTC';
import { v4 as uuidv4 } from 'uuid';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Globe, PhoneOff, MessageSquare, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Props = {
  room: Room;
  currentParticipant: Participant;
  initialOtherParticipant: Participant | null;
  initialMessages: Message[];
  userId: string;
};

export function ConversationRoom({
  room: initialRoom,
  currentParticipant: initialCurrentParticipant,
  initialOtherParticipant,
  initialMessages,
  userId,
}: Props) {
  const router = useRouter();

  // Room State
  const [room, setRoom] = useState<Room>(initialRoom);
  const [isRoomEndedByHost, setIsRoomEndedByHost] = useState(false);

  // Participant State
  const [currentParticipant, setCurrentParticipant] = useState<Participant>(
    initialCurrentParticipant
  );
  const [participants, setParticipants] = useState<Participant[]>([
    initialCurrentParticipant,
    ...(initialOtherParticipant ? [initialOtherParticipant] : []),
  ]);
  const otherParticipant = participants.find((p) => p.user_id !== userId) ?? null;

  // Host Join Requests State
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);

  // Message & Status State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [translationError, setTranslationError] = useState('');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [systemNotification, setSystemNotification] = useState<string | null>(null);
  const [isInsecureOrigin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isLocal =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      return !isHttps && !isLocal;
    }
    return false;
  });
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState<boolean>(false);

  // Audio Preferences (Per-user, local-storage backed)
  const [autoPlayVoice, setAutoPlayVoice] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('crosswire_autoplay_voice');
      if (stored !== null) return stored === 'true';
    }
    return true;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('crosswire_muted');
      if (stored !== null) return stored === 'true';
    }
    return true; // By default voice playback is muted
  });

  // Video Meeting, Real-Time Dubbing & Live Captions State
  const [viewMode, setViewMode] = useState<RoomViewMode>('video');
  const [showCaptions, setShowCaptions] = useState(true);
  const [dubbingMode, setDubbingMode] = useState<DubbingMode>('dubbing');
  const [liveSubtitle, setLiveSubtitle] = useState<LiveSubtitle | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<RealtimeChannel | null>(null);
  const liveSubtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dubbingModeRef = useRef<DubbingMode>(dubbingMode);

  useEffect(() => {
    dubbingModeRef.current = dubbingMode;
  }, [dubbingMode]);

  // Refs for stable callbacks & listeners
  const channelRef = useRef<RealtimeChannel | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const playedMessageIdsRef = useRef<Set<string>>(
    new Set(initialMessages.filter((m) => m.translation_status === 'translated').map((m) => m.id))
  );
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notifTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentParticipantRef = useRef(currentParticipant);
  const participantsRef = useRef(participants);
  const autoPlayVoiceRef = useRef(autoPlayVoice);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    currentParticipantRef.current = currentParticipant;
  }, [currentParticipant]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    autoPlayVoiceRef.current = autoPlayVoice;
  }, [autoPlayVoice]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const handleToggleAutoPlay = useCallback(() => {
    setAutoPlayVoice((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('crosswire_autoplay_voice', String(next));
      }
      if (!next) {
        stopSpeech();
        setCurrentlyPlayingId(null);
        setStatus('idle');
      }
      return next;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('crosswire_muted', String(next));
      }
      if (next) {
        stopSpeech();
        setCurrentlyPlayingId(null);
        setStatus('idle');
      }
      return next;
    });
  }, []);

  // Show a temporary system notification
  const showNotification = useCallback((msg: string) => {
    setSystemNotification(msg);
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    notifTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) setSystemNotification(null);
    }, 4000);
  }, []);

  // WebRTC Video & Audio Calling Engine
  const {
    localStream,
    remoteStream,
    isCameraOn,
    isMicOn,
    isNoiseCancellationOn,
    noiseMetrics,
    enrolledVoiceProfiles,
    isEnrollingVoice,
    remoteMediaState,
    connectionState: webrtcConnectionState,
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    selectedAudioDeviceId,
    toggleCamera,
    toggleMic,
    toggleNoiseCancellation,
    enrollVoiceProfile,
    switchCamera,
    switchMicrophone,
    mediaError,
    initLocalStream,
    activateVirtualStream,
  } = useWebRTC({
    roomId: room.id,
    userId,
    remoteUserId: otherParticipant?.user_id || null,
    channel: activeChannel,
    enabled: true,
  });

  const handleEnrollVoice = useCallback(async () => {
    try {
      showNotification('Recording 2.5s voice sample for Speaker Identification...');
      const prof = await enrollVoiceProfile(currentParticipant.display_name);
      showNotification(`Voice ID Calibrated! Profile enrolled (${prof.pitch_category}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Voice calibration failed';
      showNotification(msg);
    }
  }, [enrollVoiceProfile, currentParticipant.display_name, showNotification]);

  const isMicOnRef = useRef(isMicOn);
  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  // ─── Lifecycle & Cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial Load: Fetch full participant list, existing translations & pending join requests
  useEffect(() => {
    async function loadRoomDetails() {
      // 1. Fetch participants
      const { data: pList } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id);

      if (pList && isMountedRef.current) {
        setParticipants(pList);
      }

      // 2. Fetch join requests if creator
      if (room.creator_id === userId) {
        const { data: reqList } = await supabase
          .from('join_requests')
          .select('*')
          .eq('room_id', room.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (reqList && isMountedRef.current) {
          setPendingRequests(reqList);
        }
      }

      // 3. Fetch translations map
      const { data: transList } = await supabase
        .from('message_translations')
        .select('*')
        .eq('room_id', room.id);

      if (transList && transList.length > 0 && isMountedRef.current) {
        const transMap: Record<
          string,
          Record<
            string,
            {
              translated_text: string;
              target_language_name: string;
              translation_status: 'pending' | 'translated' | 'failed';
            }
          >
        > = {};

        for (const t of transList) {
          if (!transMap[t.message_id]) transMap[t.message_id] = {};
          transMap[t.message_id][t.target_language] = {
            translated_text: t.translated_text || '',
            target_language_name: t.target_language_name,
            translation_status: t.translation_status,
          };
        }

        setMessages((prev) =>
          prev.map((m) => (transMap[m.id] ? { ...m, translations: transMap[m.id] } : m))
        );
      }
    }

    loadRoomDetails();
  }, [room.id, room.creator_id, userId]);

  // ─── Audio Playback Handler (Python Neural Voice Dubbing with Browser Fallback) ──
  const playMessageAudio = useCallback(
    (msg: Message, forceManual = false) => {
      const myLangCode = currentParticipantRef.current.language_code;
      const myTranslation = msg.translations?.[myLangCode];
      const textToSpeak = myTranslation?.translated_text || msg.translated_text;
      const targetLang = myTranslation ? myLangCode : (msg.target_language || myLangCode);

      if (!textToSpeak) return;

      // In auto mode, skip if muted or auto-play disabled or if it's own message
      if (!forceManual) {
        if (!autoPlayVoiceRef.current || isMutedRef.current) return;
        if (msg.sender_id === userId) return;
      }

      // Stop any existing utterance first to avoid queuing collision
      stopSpeech();

      if (isMountedRef.current) {
        setCurrentlyPlayingId(msg.id);
        setStatus('playing');
      }

      // 1. Try Python Neural Voice Synthesis (gTTS stream via FastAPI proxy)
      const pyAudioUrl = `/api/voice/speak?text=${encodeURIComponent(textToSpeak)}&lang=${encodeURIComponent(targetLang)}`;
      const audio = new Audio(pyAudioUrl);

      let pySucceeded = false;
      audio.onplay = () => {
        pySucceeded = true;
        if (isMountedRef.current) {
          setCurrentlyPlayingId(msg.id);
          setStatus('playing');
        }
      };
      audio.onended = () => {
        if (isMountedRef.current) {
          setCurrentlyPlayingId((prev) => (prev === msg.id ? null : prev));
          setStatus('idle');
        }
      };
      audio.onerror = () => {
        if (!pySucceeded && isSpeechSynthesisSupported()) {
          // Fallback to browser Web Speech API if Python backend is offline
          queueSpeech(
            textToSpeak,
            targetLang,
            () => {
              if (isMountedRef.current) {
                setCurrentlyPlayingId(msg.id);
                setStatus('playing');
              }
            },
            () => {
              if (isMountedRef.current) {
                setCurrentlyPlayingId((prev) => (prev === msg.id ? null : prev));
                setStatus('idle');
              }
            }
          );
        } else if (isMountedRef.current) {
          setCurrentlyPlayingId(null);
          setStatus('idle');
        }
      };

      audio.play().catch(() => {
        if (isSpeechSynthesisSupported()) {
          queueSpeech(
            textToSpeak,
            targetLang,
            () => {
              if (isMountedRef.current) {
                setCurrentlyPlayingId(msg.id);
                setStatus('playing');
              }
            },
            () => {
              if (isMountedRef.current) {
                setCurrentlyPlayingId((prev) => (prev === msg.id ? null : prev));
                setStatus('idle');
              }
            }
          );
        }
      });
    },
    [userId]
  );

  // Manual Play Toggle
  const handleManualPlay = useCallback(
    (msg: Message) => {
      if (currentlyPlayingId === msg.id) {
        stopSpeech();
        setCurrentlyPlayingId(null);
        setStatus('idle');
        return;
      }
      playMessageAudio(msg, true);
    },
    [currentlyPlayingId, playMessageAudio]
  );

  // ─── Supabase Realtime Subscription ───────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      // Room settings updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updatedRoom = payload.new as Room;
          setRoom((prev) => ({
            ...prev,
            ...updatedRoom,
          }));
        }
      )
      // Messages table
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === newMsg.id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...newMsg };
              return updated;
            }
            return [...prev, newMsg];
          });

          if (
            newMsg.sender_id !== userId &&
            newMsg.translation_status === 'translated' &&
            !playedMessageIdsRef.current.has(newMsg.id)
          ) {
            playedMessageIdsRef.current.add(newMsg.id);
            playMessageAudio(newMsg);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );

          if (
            updatedMsg.sender_id !== userId &&
            updatedMsg.translation_status === 'translated' &&
            !playedMessageIdsRef.current.has(updatedMsg.id)
          ) {
            playedMessageIdsRef.current.add(updatedMsg.id);
            playMessageAudio(updatedMsg);
          }
        }
      )
      // Multi-translations table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_translations',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const trans = payload.new as MessageTranslation;
          if (!trans) return;

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === trans.message_id) {
                const currentMap = m.translations || {};
                return {
                  ...m,
                  translations: {
                    ...currentMap,
                    [trans.target_language]: {
                      translated_text: trans.translated_text || '',
                      target_language_name: trans.target_language_name,
                      translation_status: trans.translation_status,
                    },
                  },
                };
              }
              return m;
            })
          );
        }
      )
      // Participants table
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const p = payload.new as Participant;
          setParticipants((prev) => {
            if (prev.some((x) => x.id === p.id)) return prev;
            return [...prev, p];
          });

          if (p.user_id !== userId) {
            const pLang = getLanguageByCode(p.language_code);
            showNotification(`${p.display_name} joined the room (${pLang.name})`);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const p = payload.new as Participant;
          setParticipants((prev) => prev.map((x) => (x.id === p.id ? p : x)));

          if (p.user_id === userId) {
            setCurrentParticipant(p);
          } else {
            const oldP = participantsRef.current.find((x) => x.id === p.id);
            if (oldP && oldP.language_code !== p.language_code) {
              const newLang = getLanguageByCode(p.language_code);
              showNotification(`${p.display_name} switched their language to ${newLang.name}`);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'participants',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const oldP = payload.old as Participant;
          setParticipants((prev) => prev.filter((x) => x.id !== oldP.id));
        }
      )
      // Join Requests (Host real-time notification & panel)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          if (room.creator_id !== userId) return;

          const req = payload.new as JoinRequest;
          if (!req) return;

          if (payload.eventType === 'INSERT') {
            if (req.status === 'pending') {
              setPendingRequests((prev) => {
                if (prev.some((r) => r.id === req.id)) return prev;
                return [...prev, req];
              });
              showNotification(`${req.display_name} requested to join the room`);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (req.status === 'pending') {
              setPendingRequests((prev) => prev.map((r) => (r.id === req.id ? req : r)));
            } else {
              setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
            }
          } else if (payload.eventType === 'DELETE') {
            const oldReq = payload.old as JoinRequest;
            setPendingRequests((prev) => prev.filter((r) => r.id !== oldReq.id));
          }
        }
      )
      // Rooms table: Host ended room or room closed
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as Room;
          if (updated && !updated.is_active) {
            setIsRoomEndedByHost(true);
          }
        }
      )
      // Live Subtitle broadcast for real-time video captions & instant dubbing
      .on(
        'broadcast',
        { event: 'live_subtitle' },
        (payload) => {
          const sub = payload.payload as LiveSubtitle;
          if (!sub) return;
          if (isMountedRef.current) {
            setLiveSubtitle(sub);
          }

          // If dubbing mode is active and we are the receiver, play speech in our language
          if (sub.speakerId !== userId && (dubbingModeRef.current === 'dubbing' || dubbingModeRef.current === 'both')) {
            if (sub.audioDubbingBase64 && autoPlayVoiceRef.current && !isMutedRef.current) {
              const audio = new Audio(`data:audio/mp3;base64,${sub.audioDubbingBase64}`);
              audio.play().catch(() => {});
            } else {
              playMessageAudio(
                {
                  id: sub.id,
                  room_id: room.id,
                  sender_id: sub.speakerId,
                  sender_name: sub.speakerName,
                  original_text: sub.originalText,
                  translated_text: sub.translatedText,
                  source_language: sub.sourceLanguage,
                  target_language: sub.targetLanguage,
                  translation_status: 'translated',
                  created_at: new Date().toISOString(),
                },
                false
              );
            }
          }

          if (liveSubtitleTimeoutRef.current) clearTimeout(liveSubtitleTimeoutRef.current);
          liveSubtitleTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) setLiveSubtitle(null);
          }, 6000);
        }
      )
      .subscribe((subStatus) => {
        if (!isMountedRef.current) return;
        if (subStatus === 'SUBSCRIBED') {
          setConnectionError('');
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
          setConnectionError('Connection interrupted. Trying to reconnect...');
        }
      });

    channelRef.current = channel;
    setActiveChannel(channel);

    return () => {
      setActiveChannel(null);
      supabase.removeChannel(channel);
    };
  }, [room.id, room.creator_id, userId, playMessageAudio, showNotification]);

  // ─── Runtime Language Change ──────────────────────────────────────────────
  const handleLanguageChange = useCallback(
    async (newLangCode: string) => {
      const newLang = getLanguageByCode(newLangCode);
      try {
        const { error } = await supabase
          .from('participants')
          .update({
            language_code: newLangCode,
            language_name: newLang.name,
          })
          .eq('id', currentParticipant.id);

        if (error) throw error;

        setCurrentParticipant((prev) => ({
          ...prev,
          language_code: newLangCode,
          language_name: newLang.name,
        }));

        showNotification(`You switched your language to ${newLang.name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to switch language';
        setTranslationError(msg);
      }
    },
    [currentParticipant.id, showNotification]
  );

  // ─── Host Actions: Approve & Decline Join Requests ────────────────────────
  const handleApproveRequest = useCallback(
    async (requestId: string) => {
      try {
        const { data, error } = await supabase.rpc('resolve_join_request', {
          p_request_id: requestId,
          p_action: 'approve',
        });

        if (error) throw error;

        const res = data as { success: boolean; error?: string };
        if (!res.success) {
          throw new Error(res.error || 'Failed to approve request');
        }

        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        showNotification('Join request approved');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not approve request';
        showNotification(msg);
      }
    },
    [showNotification]
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        const { error } = await supabase.rpc('resolve_join_request', {
          p_request_id: requestId,
          p_action: 'decline',
        });

        if (error) throw error;

        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        showNotification('Join request declined');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not decline request';
        showNotification(msg);
      }
    },
    [showNotification]
  );

  // ─── Host Actions: Update Room Settings ───────────────────────────────────
  const handleUpdateSettings = useCallback(
    async (maxCapacity: number, admissionMode: AdmissionMode) => {
      const { data, error } = await supabase.rpc('update_room_settings', {
        p_room_id: room.id,
        p_max_capacity: maxCapacity,
        p_admission_mode: admissionMode,
      });

      if (error) throw error;

      const res = data as { success: boolean; error?: string };
      if (!res.success) {
        throw new Error(res.error || 'Failed to update settings');
      }

      setRoom((prev) => ({
        ...prev,
        max_capacity: maxCapacity,
        admission_mode: admissionMode,
      }));

      showNotification('Room capacity & admission settings updated');
    },
    [room.id, showNotification]
  );

  // ─── Exit & End Room Handlers ─────────────────────────────────────────────
  const handleLeaveRoom = useCallback(async () => {
    try {
      await supabase.from('participants').delete().eq('id', currentParticipant.id);
    } catch (err) {
      console.error('Error leaving room:', err);
    } finally {
      router.push('/');
    }
  }, [currentParticipant.id, router]);

  const handleEndRoom = useCallback(async () => {
    try {
      await supabase.from('rooms').update({ is_active: false }).eq('id', room.id);
      await supabase.from('participants').delete().eq('id', currentParticipant.id);
    } catch (err) {
      console.error('Error ending room:', err);
    } finally {
      router.push('/');
    }
  }, [room.id, currentParticipant.id, router]);

  // ─── Send Message (Multi-Participant Multilingual Translation) ────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const sourceLangCode = currentParticipantRef.current.language_code;
      const otherAdmitted = participantsRef.current.filter((p) => p.user_id !== userId);

      // Collect unique target languages needed by other admitted participants
      const uniqueTargets = Array.from(
        new Set(
          otherAdmitted
            .map((p) => p.language_code)
            .filter((code) => code && code !== sourceLangCode)
        )
      );

      const primaryTargetLang = uniqueTargets[0] || sourceLangCode;
      const messageId = uuidv4();

      const optimisticMsg: Message = {
        id: messageId,
        room_id: room.id,
        sender_id: userId,
        sender_name: currentParticipantRef.current.display_name,
        original_text: text.trim(),
        translated_text: null,
        source_language: sourceLangCode,
        target_language: primaryTargetLang,
        translation_status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Optimistic append
      setMessages((prev) => [...prev, optimisticMsg]);
      setStatus('translating');
      setTranslationError('');

      try {
        // 1. Insert message into Supabase (if available for authenticated users)
        try {
          await supabase.from('messages').insert({
            id: messageId,
            room_id: room.id,
            sender_id: userId,
            sender_name: currentParticipantRef.current.display_name,
            original_text: text.trim(),
            source_language: sourceLangCode,
            target_language: primaryTargetLang,
            translation_status: 'pending',
          });
        } catch {
          // Gracefully continue with server-side translation
        }

        // 2. Call server-side Gemini Translation API with multi-target support
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.trim(),
            sourceLanguage: sourceLangCode,
            targetLanguage: primaryTargetLang,
            targetLanguages: uniqueTargets.length > 0 ? uniqueTargets : [sourceLangCode],
            roomId: room.id,
            messageId,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Translation service returned an error');
        }

        const translationsMap: Record<
          string,
          {
            translated_text: string;
            target_language_name: string;
            translation_status: 'pending' | 'translated' | 'failed';
          }
        > = {};

        // 3. Persist multi-target translations into message_translations
        if (data.translations && Object.keys(data.translations).length > 0) {
          for (const [targetCode, translatedText] of Object.entries(
            data.translations as Record<string, string>
          )) {
            const targetLang = getLanguageByCode(targetCode);
            translationsMap[targetCode] = {
              translated_text: translatedText,
              target_language_name: targetLang.name,
              translation_status: 'translated',
            };

            await supabase.from('message_translations').upsert(
              {
                message_id: messageId,
                room_id: room.id,
                target_language: targetCode,
                target_language_name: targetLang.name,
                translated_text: translatedText,
                translation_status: 'translated',
              },
              { onConflict: 'message_id,target_language' }
            );
          }
        }

        // 4. Update message record in database with primary translation
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            translated_text: data.translatedText,
            translation_status: 'translated',
          })
          .eq('id', messageId);

        if (updateError) throw updateError;

        // 5. Broadcast live subtitle for instantaneous floating captions on video tiles
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'live_subtitle',
            payload: {
              id: messageId,
              speakerId: userId,
              speakerName: currentParticipantRef.current.display_name,
              sourceLanguage: sourceLangCode,
              targetLanguage: primaryTargetLang,
              originalText: text.trim(),
              translatedText: data.translatedText,
              timestamp: Date.now(),
            },
          });
        }

        if (isMountedRef.current) {
          setLiveSubtitle({
            id: messageId,
            speakerId: userId,
            speakerName: currentParticipantRef.current.display_name,
            sourceLanguage: sourceLangCode,
            targetLanguage: primaryTargetLang,
            originalText: text.trim(),
            translatedText: data.translatedText,
            timestamp: Date.now(),
          });
          if (liveSubtitleTimeoutRef.current) clearTimeout(liveSubtitleTimeoutRef.current);
          liveSubtitleTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) setLiveSubtitle(null);
          }, 6000);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    translated_text: data.translatedText,
                    translation_status: 'translated',
                    translations: translationsMap,
                  }
                : m
            )
          );
          setStatus('idle');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Message transmission failed';

        try {
          await supabase
            .from('messages')
            .update({ translation_status: 'failed' })
            .eq('id', messageId);
        } catch {
          // ignore
        }

        if (isMountedRef.current) {
          setTranslationError(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, translation_status: 'failed' } : m
            )
          );
          setStatus('error');
          if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) setStatus('idle');
          }, 3500);
        }
      }
    },
    [room.id, userId]
  );

  // ─── Retry Translation ───────────────────────────────────────────────────
  const handleRetryTranslation = useCallback(
    async (msg: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, translation_status: 'pending' } : m))
      );
      setStatus('translating');

      try {
        const otherAdmitted = participantsRef.current.filter((p) => p.user_id !== userId);
        const uniqueTargets = Array.from(
          new Set(
            otherAdmitted
              .map((p) => p.language_code)
              .filter((code) => code && code !== msg.source_language)
          )
        );

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: msg.original_text,
            sourceLanguage: msg.source_language,
            targetLanguage: msg.target_language,
            targetLanguages: uniqueTargets.length > 0 ? uniqueTargets : [msg.target_language],
            roomId: room.id,
            messageId: msg.id,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Retry translation failed');
        }

        await supabase
          .from('messages')
          .update({
            translated_text: data.translatedText,
            translation_status: 'translated',
          })
          .eq('id', msg.id);

        if (isMountedRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? { ...m, translated_text: data.translatedText, translation_status: 'translated' }
                : m
            )
          );
          setStatus('idle');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Translation retry failed';
        if (isMountedRef.current) {
          setTranslationError(errMsg);
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, translation_status: 'failed' } : m))
          );
          setStatus('error');
        }
      }
    },
    [room.id, userId]
  );

  // ─── Speech Recognition Handler ───────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setSpeechError('Speech recognition is not supported in this browser.');
      return;
    }

    stopSpeech();
    setCurrentlyPlayingId(null);

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    const myLang = getLanguageByCode(currentParticipantRef.current.language_code);
    recognition.lang = myLang.speechCode;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    transcriptRef.current = '';
    setTranscript('');
    setIsMicActive(true);
    setStatus('listening');
    setSpeechError('');

    recognition.onstart = () => {
      if (isMountedRef.current) {
        setIsMicActive(true);
        setStatus('listening');
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const current = finalTranscript || interimTranscript;
      transcriptRef.current = current;
      if (isMountedRef.current) {
        setTranscript(current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event.error);
      if (isMountedRef.current) {
        setIsMicActive(false);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          let msg = `Microphone error: ${event.error}`;
          if (event.error === 'not-allowed') {
            msg = isInsecureOrigin
              ? 'Microphone blocked on raw HTTP IP. Please switch to localhost:3000.'
              : 'Microphone permission denied. Allow microphone in your browser settings.';
          } else if (event.error === 'service-not-allowed') {
            msg = 'Speech recognition service is unavailable in this network environment.';
          }
          setSpeechError(msg);
          showNotification(msg);
          setStatus('error');
          if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) setStatus('idle');
          }, 4500);
        } else {
          setStatus('idle');
        }
      }
    };

    recognition.onend = () => {
      if (!isMountedRef.current) return;
      setIsMicActive(false);

      const captured = transcriptRef.current.trim();
      transcriptRef.current = '';
      setTranscript('');

      if (captured) {
        sendMessage(captured);
      } else {
        setStatus('idle');
      }

      // If mic is still unmuted, automatically resume listening for continuous hands-free conversation
      if (isMicOnRef.current) {
        setTimeout(() => {
          if (isMountedRef.current && isMicOnRef.current) {
            try {
              recognition.start();
              setIsMicActive(true);
            } catch {
              // ignore
            }
          }
        }, 150);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsMicActive(false);
      setStatus('idle');
    }
  }, [sendMessage, isInsecureOrigin, showNotification]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  // ─── Interrupt Partner ───────────────────────────────────────────────────
  const handleInterrupt = useCallback(() => {
    stopSpeech();
    setCurrentlyPlayingId(null);
    setIsInterrupting(true);
    setStatus('interrupted');

    setTimeout(() => {
      if (isMountedRef.current) {
        setIsInterrupting(false);
        startListening();
      }
    }, 150);
  }, [startListening]);

  // ─── Text Send Form Submission ───────────────────────────────────────────
  const handleTextSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      const text = textInput;
      setTextInput('');
      await sendMessage(text);
    },
    [textInput, sendMessage]
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors">
      {/* Header with Runtime Language Switching, Occupancy, Host Settings & Requests */}
      <RoomHeader
        room={room}
        currentParticipant={currentParticipant}
        participants={participants}
        pendingRequests={pendingRequests}
        onApproveRequest={handleApproveRequest}
        onDeclineRequest={handleDeclineRequest}
        onUpdateSettings={handleUpdateSettings}
        connectionError={connectionError}
        status={status}
        autoPlayVoice={autoPlayVoice}
        onToggleAutoPlay={handleToggleAutoPlay}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onLanguageChange={handleLanguageChange}
        onLeaveRoom={handleLeaveRoom}
        onEndRoom={handleEndRoom}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
      />

      {/* Floating System Notification */}
      {systemNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white dark:bg-white/90 dark:text-zinc-900 shadow-lg text-xs font-medium backdrop-blur-xs">
            <Globe className="w-3.5 h-3.5 text-rose-400 dark:text-rose-600" />
            <span>{systemNotification}</span>
          </div>
        </div>
      )}

      {/* View Mode: Video Conference (Google Meet Style) */}
      {viewMode === 'video' ? (
        <div className="flex flex-1 relative overflow-hidden bg-slate-950">
          <VideoMeetingGrid
            localStream={localStream}
            remoteStream={remoteStream}
            currentParticipant={currentParticipant}
            otherParticipant={otherParticipant}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            remoteMediaState={remoteMediaState}
            liveSubtitle={liveSubtitle}
            showCaptions={showCaptions}
            dubbingMode={dubbingMode}
            onToggleDubbingMode={() =>
              setDubbingMode((prev) => (prev === 'dubbing' ? 'subtitles_only' : 'dubbing'))
            }
            connectionState={webrtcConnectionState}
            isTranslating={status === 'translating'}
            mediaError={mediaError}
            isInsecureOrigin={isInsecureOrigin}
            onRetryMedia={() => {
              void initLocalStream();
            }}
            onToggleVirtualStream={() => {
              activateVirtualStream(currentParticipant.display_name);
              showNotification('Virtual test camera & synthetic audio track activated!');
            }}
            onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
            localTranscript={transcript}
            isListening={isMicActive}
          />

          {/* Collapsible Slide-out Chat Drawer */}
          {isChatOpen && (
            <aside className="w-80 sm:w-96 flex flex-col h-full border-l border-slate-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-2xl z-30 transition-all animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-rose-500" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">In-Call Messages</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <MessageList
                  messages={messages}
                  userId={userId}
                  currentParticipant={currentParticipant}
                  otherParticipant={otherParticipant}
                  currentlyPlayingId={currentlyPlayingId}
                  onPlay={handleManualPlay}
                  onRetry={handleRetryTranslation}
                  canPlay={isSpeechSynthesisSupported()}
                />
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <form onSubmit={handleTextSend} className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={`Type in ${getLanguageByCode(currentParticipant.language_code).name}...`}
                    disabled={!otherParticipant}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-hidden focus:border-rose-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || !otherParticipant}
                    className="px-3 h-10 rounded-xl bg-slate-900 dark:bg-zinc-700 hover:bg-rose-600 dark:hover:bg-rose-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            </aside>
          )}
        </div>
      ) : (
        /* View Mode: Traditional Chat List */
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 max-w-sm mx-auto px-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-slate-700 dark:text-zinc-300 mb-4">
                  <span className="text-xl">⚡</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  {participants.length > 1
                    ? 'Active Debate Session'
                    : 'Awaiting Participants'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                  {participants.length > 1
                    ? 'Send a message or tap the mic. Original text and translations are synchronized live for all participants.'
                    : `Share the room code or invitation URL. Configured for up to ${room.max_capacity} participants.`}
                </p>
                {participants.length <= 1 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 font-mono shadow-xs">
                    <span>Room:</span>
                    <span className="font-bold tracking-wider">{room.code}</span>
                  </div>
                )}
              </div>
            )}

            <MessageList
              messages={messages}
              userId={userId}
              currentParticipant={currentParticipant}
              otherParticipant={otherParticipant}
              currentlyPlayingId={currentlyPlayingId}
              onPlay={handleManualPlay}
              onRetry={handleRetryTranslation}
              canPlay={isSpeechSynthesisSupported()}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Bottom Controls Bar: MeetingControls when in video mode, SpeakingPanel when in chat mode */}
      {viewMode === 'video' ? (
        <MeetingControls
          isCameraOn={isCameraOn}
          isMicOn={isMicOn}
          onToggleCamera={toggleCamera}
          onToggleMic={() => {
            toggleMic();
            if (isMicOn) {
              stopListening();
            } else {
              startListening();
            }
          }}
          showCaptions={showCaptions}
          onToggleCaptions={() => setShowCaptions((prev) => !prev)}
          dubbingMode={dubbingMode}
          onToggleDubbingMode={() =>
            setDubbingMode((prev) => (prev === 'dubbing' ? 'subtitles_only' : 'dubbing'))
          }
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen((prev) => !prev)}
          unreadChatCount={0}
          onLeaveCall={handleLeaveRoom}
          isHost={room.creator_id === userId}
          videoDevices={videoDevices}
          audioDevices={audioDevices}
          selectedVideoDeviceId={selectedVideoDeviceId}
          selectedAudioDeviceId={selectedAudioDeviceId}
          onSelectVideoDevice={switchCamera}
          onSelectAudioDevice={switchMicrophone}
          sourceLanguageName={getLanguageByCode(currentParticipant.language_code).name}
          targetLanguageName={
            otherParticipant ? getLanguageByCode(otherParticipant.language_code).name : undefined
          }
          onOpenNotes={() => setIsNotesOpen(true)}
          isNoiseCancellationOn={isNoiseCancellationOn}
          onToggleNoiseCancellation={toggleNoiseCancellation}
          noiseMetrics={noiseMetrics}
          onEnrollVoice={handleEnrollVoice}
          isEnrollingVoice={isEnrollingVoice}
          enrolledVoiceCount={enrolledVoiceProfiles.length}
        />
      ) : (
        <SpeakingPanel
          status={status}
          transcript={transcript}
          textInput={textInput}
          setTextInput={setTextInput}
          isMicActive={isMicActive}
          isInterrupting={isInterrupting}
          speechError={speechError}
          translationError={translationError}
          currentParticipant={currentParticipant}
          otherParticipant={otherParticipant}
          onStartListening={startListening}
          onStopListening={stopListening}
          onInterrupt={handleInterrupt}
          onTextSend={handleTextSend}
          speechSupported={isSpeechRecognitionSupported()}
          synthSupported={isSpeechSynthesisSupported()}
        />
      )}

      {/* Host Terminated / Room Closed Modal */}
      {isRoomEndedByHost && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Conversation Ended
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
              The room host has closed this conversation session. Thank you for participating!
            </p>
            <button
              onClick={() => router.push('/')}
              type="button"
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}

      {/* AI Meeting Notes & Intelligence Modal (Python FastAPI Engine) */}
      <AIMeetingNotesModal
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        roomCode={room.code}
      />

      {/* Phone Connect QR Modal */}
      <PhoneConnectModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        roomCode={room.code}
      />
    </div>
  );
}
