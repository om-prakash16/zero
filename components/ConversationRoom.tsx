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

type Props = {
  room: Room;
  currentParticipant: Participant;
  initialOtherParticipant: Participant | null;
  initialMessages: Message[];
  userId: string;
};

export function ConversationRoom({
  room,
  currentParticipant,
  initialOtherParticipant,
  initialMessages,
  userId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(
    initialOtherParticipant
  );
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [translationError, setTranslationError] = useState('');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const playedMessageIdsRef = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentParticipantRef = useRef(currentParticipant);
  useEffect(() => {
    currentParticipantRef.current = currentParticipant;
  }, [currentParticipant]);

  const myLang = getLanguageByCode(currentParticipant.language_code);

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
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Stable Auto-play handler via Ref ─────────────────────────────────────
  const autoPlayHandlerRef = useRef<(msg: Message) => void>(() => {});
  useEffect(() => {
    autoPlayHandlerRef.current = (msg: Message) => {
      if (!isSpeechSynthesisSupported() || !msg.translated_text) return;
      if (msg.sender_id === userId) return; // Don't play own messages

      if (isMountedRef.current) {
        setCurrentlyPlayingId(msg.id);
        setStatus('playing');
      }

      queueSpeech(
        msg.translated_text,
        currentParticipantRef.current.language_code,
        () => {
          if (isMountedRef.current) setStatus('playing');
        },
        () => {
          if (isMountedRef.current) {
            setCurrentlyPlayingId(null);
            setStatus('idle');
          }
        }
      );
    };
  }, [userId]);

  // ─── Supabase Realtime subscription ───────────────────────────────────────
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
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // If message arrived already translated and belongs to other user
          if (
            newMsg.translation_status === 'translated' &&
            newMsg.sender_id !== userId &&
            newMsg.translated_text &&
            !playedMessageIdsRef.current.has(newMsg.id)
          ) {
            playedMessageIdsRef.current.add(newMsg.id);
            autoPlayHandlerRef.current(newMsg);
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
            autoPlayHandlerRef.current(updated);
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
            setOtherParticipant(p);
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
  }, [room.id, userId]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !otherParticipant) return;

      const messageId = uuidv4();
      const newMessage: Omit<Message, 'created_at'> = {
        id: messageId,
        room_id: room.id,
        sender_id: userId,
        sender_name: currentParticipant.display_name,
        original_text: text.trim(),
        translated_text: null,
        source_language: currentParticipant.language_code,
        target_language: otherParticipant.language_code,
        translation_status: 'pending',
      };

      // Optimistic insert
      setMessages((prev) => [
        ...prev,
        { ...newMessage, created_at: new Date().toISOString() },
      ]);

      setStatus('translating');
      setTranslationError('');

      try {
        // Insert message into DB
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            id: messageId,
            room_id: room.id,
            sender_id: userId,
            sender_name: currentParticipant.display_name,
            original_text: text.trim(),
            source_language: currentParticipant.language_code,
            target_language: otherParticipant.language_code,
            translation_status: 'pending',
          });

        if (insertError) throw insertError;

        // Translate via server-side API
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.trim(),
            sourceLanguage: currentParticipant.language_code,
            targetLanguage: otherParticipant.language_code,
            roomId: room.id,
            messageId,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Translation failed');
        }

        // Update message with translation
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
                ? { ...m, translated_text: data.translatedText, translation_status: 'translated' }
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
          }, 3000);
        }
      }
    },
    [room.id, userId, currentParticipant, otherParticipant]
  );

  // ─── Speech recognition ───────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setSpeechError('Speech recognition is not supported in this browser. Use text input instead.');
      return;
    }

    // Safely abort any prior recognition session
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
    recognition.lang = myLang.speechCode;
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
        setSpeechError('Microphone access denied. Please allow microphone permissions and try again.');
      } else if (event.error === 'no-speech') {
        setSpeechError('No speech detected. Try speaking louder or closer to the mic.');
        setStatus('idle');
      } else if (event.error !== 'aborted') {
        setSpeechError(`Speech recognition error: ${event.error}`);
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [myLang.speechCode, sendMessage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  // ─── Interrupt ────────────────────────────────────────────────────────────
  const handleInterrupt = useCallback(() => {
    // 1. Stop any playing speech immediately
    stopSpeech();
    setCurrentlyPlayingId(null);
    setIsInterrupting(true);
    setStatus('interrupted');

    // 2. Small delay then start listening
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsInterrupting(false);
        startListening();
      }
    }, 200);
  }, [startListening]);

  // ─── Text send ────────────────────────────────────────────────────────────
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

  // ─── Manual play ─────────────────────────────────────────────────────────
  const handleManualPlay = useCallback((msg: Message) => {
    stopSpeech();
    autoPlayHandlerRef.current(msg);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 overflow-hidden transition-colors">
      {/* Header */}
      <RoomHeader
        room={room}
        currentParticipant={currentParticipant}
        otherParticipant={otherParticipant}
        connectionError={connectionError}
        status={status}
      />

      {/* Main conversation area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 max-w-sm mx-auto px-4">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-center text-slate-700 dark:text-zinc-300 mb-4">
                <span className="text-xl">⚡</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {otherParticipant
                  ? 'Argument Session Active'
                  : 'Awaiting Second Participant'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                {otherParticipant
                  ? 'Tap the microphone or type below. Translations are delivered instantly in voice and text.'
                  : 'Share the room code with your conversation partner to start the live translation.'}
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
            canPlay={isSpeechSynthesisSupported()}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom speaking panel */}
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
