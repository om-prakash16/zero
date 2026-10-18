'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Room, Participant, Message } from '@/lib/types';
import { JoinRoomModal } from '@/components/JoinRoomModal';
import { ConversationRoom } from '@/components/ConversationRoom';
import { Zap, Loader2 } from 'lucide-react';
import { normalizeRoomCode } from '@/lib/roomCode';

type RoomState = 'loading' | 'join' | 'conversation' | 'error' | 'full' | 'not_found';

function RoomPageInner() {
  const params = useParams();
  const router = useRouter();
  const rawCode = typeof params.code === 'string' ? params.code : Array.isArray(params.code) ? params.code[0] : '';
  const roomCode = normalizeRoomCode(rawCode);

  const [roomState, setRoomState] = useState<RoomState>('loading');
  const [room, setRoom] = useState<Room | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize: authenticate and load room
  useEffect(() => {
    async function init() {
      try {
        // Ensure anonymous session
        let { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
          sessionData = { session: signInData.session };
        }

        const uid = sessionData.session?.user?.id;
        if (!uid) throw new Error('No user session');
        setUserId(uid);

        // Load room
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode)
          .eq('is_active', true)
          .single();

        if (roomError || !roomData) {
          setRoomState('not_found');
          return;
        }

        setRoom(roomData as Room);

        // Check if user is already a participant
        const { data: existingParticipant } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', roomData.id)
          .eq('user_id', uid)
          .single();

        if (existingParticipant) {
          // Reconnecting: update connection status
          await supabase
            .from('participants')
            .update({ is_connected: true, last_seen_at: new Date().toISOString() })
            .eq('id', existingParticipant.id);

          setCurrentParticipant(existingParticipant as Participant);

          // Load other participant
          const { data: others } = await supabase
            .from('participants')
            .select('*')
            .eq('room_id', roomData.id)
            .neq('user_id', uid);

          if (others && others.length > 0) {
            setOtherParticipant(others[0] as Participant);
          }

          // Load messages
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomData.id)
            .order('created_at', { ascending: true });

          setMessages((msgs ?? []) as Message[]);
          setRoomState('conversation');
        } else if (roomData.participant_count >= 2) {
          setRoomState('full');
        } else {
          setRoomState('join');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'An error occurred';
        setErrorMessage(msg);
        setRoomState('error');
      }
    }

    if (roomCode) {
      init();
    }
  }, [roomCode]);

  const handleJoinRoom = useCallback(
    async (displayName: string, languageCode: string, languageName: string) => {
      if (!room || !userId) return;

      try {
        const { data: participant, error } = await supabase
          .from('participants')
          .insert({
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
            language_code: languageCode,
            language_name: languageName,
            is_connected: true,
          })
          .select()
          .single();

        if (error) {
          if (error.message.includes('full') || error.message.includes('Maximum')) {
            setRoomState('full');
            return;
          }
          throw error;
        }

        setCurrentParticipant(participant as Participant);
        setRoomState('conversation');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join room';
        setErrorMessage(msg);
      }
    },
    [room, userId]
  );

  // Mark disconnected on unmount
  useEffect(() => {
    if (!currentParticipant) return;

    const handleBeforeUnload = async () => {
      await supabase
        .from('participants')
        .update({ is_connected: false })
        .eq('id', currentParticipant.id);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Mark disconnected
      supabase
        .from('participants')
        .update({ is_connected: false })
        .eq('id', currentParticipant.id);
    };
  }, [currentParticipant]);

  if (roomState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Connecting to live room...</p>
        </div>
      </div>
    );
  }

  if (roomState === 'not_found') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="minimal-card rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center mx-auto mb-4 text-xl">
            🔍
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Room Not Found</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            The room code <span className="font-mono font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{roomCode}</span> was not found or has concluded.
          </p>
          <button
            onClick={() => router.push('/')}
            type="button"
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (roomState === 'full') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="minimal-card rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">
            🚫
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Room Capacity Reached</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            This room already has 2 participants. CROSSWIRE argument sessions are strictly 1-on-1 conversations.
          </p>
          <button
            onClick={() => router.push('/')}
            type="button"
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs"
          >
            Start Your Own Room
          </button>
        </div>
      </div>
    );
  }

  if (roomState === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="minimal-card rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 text-xl">
            ⚠️
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Unable to Join</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">{errorMessage}</p>
          <button
            onClick={() => router.push('/')}
            type="button"
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (roomState === 'join' && room) {
    return (
      <JoinRoomModal
        room={room}
        onJoin={handleJoinRoom}
        error={errorMessage}
      />
    );
  }

  if (roomState === 'conversation' && room && currentParticipant) {
    return (
      <ConversationRoom
        room={room}
        currentParticipant={currentParticipant}
        initialOtherParticipant={otherParticipant}
        initialMessages={messages}
        userId={userId!}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center transition-colors">
      <Loader2 className="w-7 h-7 text-slate-400 dark:text-zinc-500 animate-spin" />
    </div>
  );
}

// Wrap in Suspense so useParams() works correctly during prerender
export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center transition-colors">
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Zap className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Connecting to room...</p>
          </div>
        </div>
      }
    >
      <RoomPageInner />
    </Suspense>
  );
}
