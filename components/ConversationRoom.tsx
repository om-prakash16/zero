'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  stopSpeech,
  queueSpeech,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '@/lib/speech';
import type { Room, Participant, Message, ConversationStatus } from '@/lib/types';
import { getLanguageByCode } from '@/lib/types';
import { MessageList } from '@/components/MessageList';
import { SpeakingPanel } from '@/components/SpeakingPanel';
import { RoomHeader } from '@/components/RoomHeader';
import { v4 as uuidv4 } from 'uuid';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Globe } from 'lucide-react';

type Props = {
  room: Room;
  currentParticipant: Participant;
  initialOtherParticipant: Participant | null;
  initialMessages: Message[];
  userId: string;
};

export function ConversationRoom({
  room,
  currentParticipant: initialCurrentParticipant,
  initialOtherParticipant,
  initialMessages,
  userId,
}: Props) {
  // Participant State
  const [currentParticipant, setCurrentParticipant] = useState<Participant>(
    initialCurrentParticipant
  );
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(
    initialOtherParticipant
  );

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
    return false;
  });

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
  const otherParticipantRef = useRef(otherParticipant);
  const autoPlayVoiceRef = useRef(autoPlayVoice);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    currentParticipantRef.current = currentParticipant;
  }, [currentParticipant]);

  useEffect(() => {
    otherParticipantRef.current = otherParticipant;
  }, [otherParticipant]);

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

  // ─── Audio Playback Handler ───────────────────────────────────────────────
  const playMessageAudio = useCallback(
    (msg: Message, forceManual = false) => {
      if (!isSpeechSynthesisSupported() || !msg.translated_text) return;

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

      // Speak in the target language of the translation
      const targetLang = msg.target_language || currentParticipantRef.current.language_code;

      queueSpeech(
        msg.translated_text,
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
    },
    [userId]
  );

  // Manual Play Toggle
  const handleManualPlay = useCallback(
    (msg: Message) => {
      if (currentlyPlayingId === msg.id) {
        // Stop currently playing
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
              updated[index] = newMsg;
              return updated;
            }
            return [...prev, newMsg];
          });

          // Auto-play if incoming and already translated
          if (
            newMsg.translation_status === 'translated' &&
            newMsg.sender_id !== userId &&
            newMsg.translated_text &&
            !playedMessageIdsRef.current.has(newMsg.id)
          ) {
            playedMessageIdsRef.current.add(newMsg.id);
            playMessageAudio(newMsg, false);
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
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );

          // Auto-play translated messages directed at this user
          if (
            updated.translation_status === 'translated' &&
            updated.sender_id !== userId &&
            updated.translated_text &&
            !playedMessageIdsRef.current.has(updated.id)
          ) {
            playedMessageIdsRef.current.add(updated.id);
            playMessageAudio(updated, false);
          }
        }
      )
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
          if (p.user_id !== userId) {
            setOtherParticipant(p);
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
          if (p.user_id !== userId) {
            const oldLang = otherParticipantRef.current?.language_code;
            setOtherParticipant(p);
            if (oldLang && oldLang !== p.language_code) {
              const newLang = getLanguageByCode(p.language_code);
              showNotification(
                `${p.display_name} switched their language to ${newLang.name}`
              );
            }
          } else {
            setCurrentParticipant(p);
          }
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, userId, playMessageAudio, showNotification]);

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

  // ─── Send Message (Bidirectional & Independent) ───────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !otherParticipantRef.current) return;

      const sourceLangCode = currentParticipantRef.current.language_code;
      const targetLangCode = otherParticipantRef.current.language_code;
      const messageId = uuidv4();

      const optimisticMsg: Message = {
        id: messageId,
        room_id: room.id,
        sender_id: userId,
        sender_name: currentParticipantRef.current.display_name,
        original_text: text.trim(),
        translated_text: null,
        source_language: sourceLangCode,
        target_language: targetLangCode,
        translation_status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Optimistic append
      setMessages((prev) => [...prev, optimisticMsg]);
      setStatus('translating');
      setTranslationError('');

      try {
        // 1. Insert message into Supabase
        const { error: insertError } = await supabase.from('messages').insert({
          id: messageId,
          room_id: room.id,
          sender_id: userId,
          sender_name: currentParticipantRef.current.display_name,
          original_text: text.trim(),
          source_language: sourceLangCode,
          target_language: targetLangCode,
          translation_status: 'pending',
        });

        if (insertError) throw insertError;

        // 2. Call server-side Gemini Translation API
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.trim(),
            sourceLanguage: sourceLangCode,
            targetLanguage: targetLangCode,
            roomId: room.id,
            messageId,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Translation service returned an error');
        }

        // 3. Update message record in database with translation
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            translated_text: data.translatedText,
            translation_status: 'translated',
          })
          .eq('id', messageId);

        if (updateError) throw updateError;

        if (isMountedRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    translated_text: data.translatedText,
                    translation_status: 'translated',
                  }
                : m
            )
          );
          setStatus('idle');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Translation failed';

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

  // ─── Retry Translation for a Failed Message ──────────────────────────────
  const handleRetryTranslation = useCallback(
    async (msg: Message) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, translation_status: 'pending' } : m
        )
      );
      setStatus('translating');

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: msg.original_text,
            sourceLanguage: msg.source_language,
            targetLanguage: msg.target_language,
            roomId: room.id,
            messageId: msg.id,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Retry translation failed');
        }

        const { error: updateError } = await supabase
          .from('messages')
          .update({
            translated_text: data.translatedText,
            translation_status: 'translated',
          })
          .eq('id', msg.id);

        if (updateError) throw updateError;

        if (isMountedRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id
                ? {
                    ...m,
                    translated_text: data.translatedText,
                    translation_status: 'translated',
                  }
                : m
            )
          );
          setStatus('idle');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Retry failed';
        if (isMountedRef.current) {
          setTranslationError(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id ? { ...m, translation_status: 'failed' } : m
            )
          );
          setStatus('error');
        }
      }
    },
    [room.id]
  );

  // ─── Speech Recognition (Independent & Cross-Language) ───────────────────
  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setSpeechError(
        'Speech recognition is not supported in this browser. Please use text input instead.'
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setSpeechError('');
    setTranscript('');

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    const currentLang = getLanguageByCode(currentParticipantRef.current.language_code);
    recognition.lang = currentLang.speechCode;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (isMountedRef.current) {
        setStatus('listening');
        setIsMicActive(true);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      if (isMountedRef.current) {
        setTranscript(text);
        transcriptRef.current = text;
        if (result.isFinal) {
          setStatus('speaking');
        }
      }
    };

    recognition.onend = () => {
      if (isMountedRef.current) {
        setIsMicActive(false);
      }
      recognitionRef.current = null;
      const finalText = transcriptRef.current || '';
      transcriptRef.current = '';
      if (finalText.trim()) {
        sendMessage(finalText);
        if (isMountedRef.current) setTranscript('');
      } else {
        if (isMountedRef.current) setStatus('idle');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (isMountedRef.current) {
        setIsMicActive(false);
      }
      recognitionRef.current = null;
      if (!isMountedRef.current) return;

      if (event.error === 'not-allowed') {
        setSpeechError(
          'Microphone permission denied. Please allow microphone access and try again.'
        );
      } else if (event.error === 'no-speech') {
        setSpeechError('No speech detected. Try speaking closer to your microphone.');
        setStatus('idle');
      } else if (event.error !== 'aborted') {
        setSpeechError(`Speech error: ${event.error}`);
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [sendMessage]);

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
    // 1. Instantly stop all speech playback & invalidate pending audio
    stopSpeech();
    setCurrentlyPlayingId(null);
    setIsInterrupting(true);
    setStatus('interrupted');

    // 2. Open microphone immediately for interrupting speaker
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
      {/* Header with Runtime Language Switching & Independent Audio Controls */}
      <RoomHeader
        room={room}
        currentParticipant={currentParticipant}
        otherParticipant={otherParticipant}
        connectionError={connectionError}
        status={status}
        autoPlayVoice={autoPlayVoice}
        onToggleAutoPlay={handleToggleAutoPlay}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onLanguageChange={handleLanguageChange}
      />

      {/* Floating System Notification (e.g. Partner switched language) */}
      {systemNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white dark:bg-white/90 dark:text-zinc-900 shadow-lg text-xs font-medium backdrop-blur-xs">
            <Globe className="w-3.5 h-3.5 text-rose-400 dark:text-rose-600" />
            <span>{systemNotification}</span>
          </div>
        </div>
      )}

      {/* Main Conversation & Messages Area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 max-w-sm mx-auto px-4">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-slate-700 dark:text-zinc-300 mb-4">
                <span className="text-xl">⚡</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {otherParticipant
                  ? 'Active Debate Session'
                  : 'Awaiting Second Participant'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                {otherParticipant
                  ? 'Send a message or tap the mic. Original text and translations are displayed live for both participants.'
                  : 'Share the room code or invitation URL with your partner to start the live translation.'}
              </p>
              {!otherParticipant && (
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

      {/* Bottom Speaking & Text Input Panel */}
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
    </div>
  );
}
