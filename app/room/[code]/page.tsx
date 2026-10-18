'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Room, Participant, Message, JoinRequest } from '@/lib/types';
import { JoinRoomModal } from '@/components/JoinRoomModal';
import { ConversationRoom } from '@/components/ConversationRoom';
import {
  Zap,
  Loader2,
  Clock,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { normalizeRoomCode, formatRoomCode } from '@/lib/roomCode';

type RoomState =
  | 'loading'
  | 'join'
  | 'pending'
  | 'declined'
  | 'conversation'
  | 'error'
  | 'full'
  | 'not_found';

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
  const [pendingRequest, setPendingRequest] = useState<JoinRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      try {
        let { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
          sessionData = { session: signInData.session };
        }

        const uid = sessionData.session?.user?.id;
        if (!uid) throw new Error('No user session established');
        if (!isMounted) return;
        setUserId(uid);

        // 2. Load room
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode)
          .eq('is_active', true)
          .single();

        if (roomError || !roomData) {
          if (isMounted) setRoomState('not_found');
          return;
        }

        const roomObj = roomData as Room;
        if (!isMounted) return;
        setRoom(roomObj);

        // 3. Check existing participants
        const { data: participantsList } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', roomObj.id);

        const myParticipant = participantsList?.find((p) => p.user_id === uid);
        const hostOrOther = participantsList?.find((p) => p.user_id !== uid);

        if (myParticipant) {
          await supabase
            .from('participants')
            .update({ is_connected: true, last_seen_at: new Date().toISOString() })
            .eq('id', myParticipant.id);

          if (!isMounted) return;
          setCurrentParticipant(myParticipant as Participant);
          setOtherParticipant((hostOrOther ?? null) as Participant | null);

          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomObj.id)
            .order('created_at', { ascending: true });

          if (!isMounted) return;
          setMessages((msgs ?? []) as Message[]);
          setRoomState('conversation');
          return;
        }

        // 4. Check for active or recent join requests
        const { data: recentReq } = await supabase
          .from('join_requests')
          .select('*')
          .eq('room_id', roomObj.id)
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentReq && recentReq.status === 'pending') {
          if (!isMounted) return;
          setPendingRequest(recentReq as JoinRequest);
          setOtherParticipant((hostOrOther ?? null) as Participant | null);
          setRoomState('pending');
          return;
        }

        // 5. Check if room is full
        const maxCap = roomObj.max_capacity ?? 2;
        const count = roomObj.participant_count ?? (participantsList?.length ?? 0);

        if (count >= maxCap) {
          if (!isMounted) return;
          setRoomState('full');
          return;
        }

        // 6. Ready to join
        if (!isMounted) return;
        setOtherParticipant((hostOrOther ?? null) as Participant | null);
        setRoomState('join');
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'An error occurred';
        setErrorMessage(msg);
        setRoomState('error');
      }
    }

    if (roomCode) {
      loadRoom();
    }

    return () => {
      isMounted = false;
    };
  }, [roomCode, reloadKey]);

  // Handle Join Submission (Atomic RPC)
  const handleJoinRoom = useCallback(
    async (displayName: string, languageCode: string, languageName: string) => {
      if (!room || !userId) return;

      try {
        setErrorMessage('');

        const { data: result, error: rpcError } = await supabase.rpc('request_room_admission', {
          p_room_id: room.id,
          p_display_name: displayName,
          p_language_code: languageCode,
          p_language_name: languageName,
        });

        if (rpcError) throw rpcError;

        const res = result as {
          status: string;
          message?: string;
          participant_id?: string;
          request_id?: string;
        };

        if (res.status === 'admitted' || res.status === 'already_joined') {
          // Admitted! Query participant record
          const { data: participant, error: partError } = await supabase
            .from('participants')
            .select('*')
            .eq('room_id', room.id)
            .eq('user_id', userId)
            .single();

          if (partError || !participant) throw new Error('Could not verify admission record');

          setCurrentParticipant(participant as Participant);

          // Load messages
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: true });

          setMessages((msgs ?? []) as Message[]);
          setRoomState('conversation');
        } else if (res.status === 'pending') {
          // Waiting for host approval
          const { data: req } = await supabase
            .from('join_requests')
            .select('*')
            .eq('id', res.request_id || '')
            .single();

          setPendingRequest((req ?? {
            id: res.request_id,
            room_id: room.id,
            user_id: userId,
            display_name: displayName,
            language_code: languageCode,
            language_name: languageName,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }) as JoinRequest);

          setRoomState('pending');
        } else if (res.status === 'room_full') {
          setRoomState('full');
        } else {
          throw new Error(res.message || 'Admission request was not accepted');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to submit admission';
        setErrorMessage(msg);
      }
    },
    [room, userId]
  );

  // Realtime subscription for pending request
  useEffect(() => {
    if (roomState !== 'pending' || !pendingRequest || !room || !userId) return;

    const channel = supabase
      .channel(`pending_req:${pendingRequest.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'join_requests',
          filter: `id=eq.${pendingRequest.id}`,
        },
        async (payload) => {
          const updated = payload.new as JoinRequest;
          if (updated.status === 'approved') {
            // Request was approved! Fetch participant and enter conversation
            const { data: p } = await supabase
              .from('participants')
              .select('*')
              .eq('room_id', room.id)
              .eq('user_id', userId)
              .maybeSingle();

            if (p) {
              setCurrentParticipant(p as Participant);

              const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', room.id)
                .order('created_at', { ascending: true });

              setMessages((msgs ?? []) as Message[]);
              setRoomState('conversation');
            }
          } else if (updated.status === 'declined') {
            setRoomState('declined');
          } else if (updated.status === 'cancelled') {
            setRoomState('join');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomState, pendingRequest, room, userId]);

  // Cancel pending request
  const handleCancelRequest = async () => {
    if (!pendingRequest) return;
    try {
      setIsCancelling(true);
      await supabase.rpc('cancel_join_request', { p_request_id: pendingRequest.id });
      setPendingRequest(null);
      setRoomState('join');
    } catch (err) {
      console.warn('Failed to cancel join request:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Mark disconnected on unmount if participant
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
      supabase
        .from('participants')
        .update({ is_connected: false })
        .eq('id', currentParticipant.id);
    };
  }, [currentParticipant]);

  // 1. Loading State
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

  // 2. Not Found State
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
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // 3. Pending Host Approval State
  if (roomState === 'pending') {
    return (
      <div className="min-h-screen hero-gradient grid-pattern flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="minimal-card rounded-2xl p-6 sm:p-8 text-center max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 relative">
            <Clock className="w-7 h-7 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
          </div>

          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
            Admission Pending
          </span>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Waiting for Host Approval
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-5 leading-relaxed">
            Your join request for room{' '}
            <strong className="font-mono text-slate-900 dark:text-white">{formatRoomCode(roomCode)}</strong> has been submitted. The room creator will approve or decline your admission in real time.
          </p>

          {/* Request summary box */}
          {pendingRequest && (
            <div className="mb-6 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700/80 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Display Name:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{pendingRequest.display_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Chosen Language:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {pendingRequest.language_name} ({pendingRequest.language_code})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Request Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Reviewing...
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              onClick={handleCancelRequest}
              disabled={isCancelling}
              type="button"
              className="w-full h-11 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Cancel Request & Pick Another Room</span>
            </button>

            <button
              onClick={() => router.push('/')}
              type="button"
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors py-1 cursor-pointer"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Declined State
  if (roomState === 'declined') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="minimal-card rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <UserX className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Request Declined</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            The room creator has declined your request to join this session.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setPendingRequest(null);
                setRoomState('join');
              }}
              type="button"
              className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Submit New Request</span>
            </button>
            <button
              onClick={() => router.push('/')}
              type="button"
              className="w-full h-11 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Full State
  if (roomState === 'full') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="minimal-card rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">
            🚫
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Room Capacity Reached</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
            This room has reached its maximum configured capacity of{' '}
            <strong className="text-slate-900 dark:text-white">{room?.max_capacity || 2}</strong> participants.
            No additional participants can be admitted at this time.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              type="button"
              className="w-full h-11 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={() => router.push('/')}
              type="button"
              className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer"
            >
              Start Your Own Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Error State
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
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-xs cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // 7. Join Form State
  if (roomState === 'join' && room) {
    return (
      <JoinRoomModal
        room={room}
        host={otherParticipant}
        onJoin={handleJoinRoom}
        error={errorMessage}
      />
    );
  }

  // 8. Conversation Room State
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
