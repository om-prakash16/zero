'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createNoiseCancellingAudioGraph,
  recordVoiceSampleBase64,
  type NoiseCancellerGraph,
  type VoiceProfile,
  type NoiseMetrics,
} from '@/lib/audio/noiseProcessor';
import { createVirtualMediaStream } from '@/lib/audio/virtualMedia';

type WebRTCSignal =
  | { type: 'ready'; from: string }
  | { type: 'offer'; offer: RTCSessionDescriptionInit; from: string; to: string }
  | { type: 'answer'; answer: RTCSessionDescriptionInit; from: string; to: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit; from: string; to: string }
  | { type: 'media_state'; isCameraOn: boolean; isMicOn: boolean; from: string };

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

interface UseWebRTCProps {
  roomId: string;
  userId: string;
  remoteUserId: string | null;
  channel: RealtimeChannel | null;
  enabled?: boolean;
}

export function useWebRTC({
  roomId,
  userId,
  remoteUserId,
  channel,
  enabled = true,
}: UseWebRTCProps) {
  // Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Local media controls
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);

  // AI Noise Cancellation & Voice ID Profiling
  const [isNoiseCancellationOn, setIsNoiseCancellationOn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('crosswire_noise_cancellation');
      if (stored !== null) return stored === 'true';
    }
    return true; // Default ON for high sound and noise cancellation
  });
  const [noiseMetrics, setNoiseMetrics] = useState<NoiseMetrics>({
    rmsLevel: 0,
    peakDb: -100,
    isHighSoundDetected: false,
    isNoiseGateActive: false,
  });
  const [enrolledVoiceProfiles, setEnrolledVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [isEnrollingVoice, setIsEnrollingVoice] = useState<boolean>(false);

  // Remote media state received from peer
  const [remoteMediaState, setRemoteMediaState] = useState<{
    isCameraOn: boolean;
    isMicOn: boolean;
  }>({
    isCameraOn: true,
    isMicOn: true,
  });

  // Connection & Device State
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');

  // Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const dspGraphRef = useRef<NoiseCancellerGraph | null>(null);
  const isCameraOnRef = useRef(isCameraOn);
  const isMicOnRef = useRef(isMicOn);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pyWsRef = useRef<WebSocket | null>(null);

  // Send WebRTC signaling payload via Python WebSocket with Supabase channel fallback
  const sendSignal = useCallback(
    (payload: WebRTCSignal) => {
      // 1. Send through Python WebSocket (Ultra-low latency)
      if (pyWsRef.current && pyWsRef.current.readyState === WebSocket.OPEN) {
        try {
          pyWsRef.current.send(JSON.stringify(payload));
        } catch {
          // ignore
        }
      }
      // 2. Dual-redundant backup via Supabase channel
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc',
          payload,
        });
      }
    },
    [channel]
  );

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  // Enumerate camera and microphone devices
  const enumerateDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vDevs = devices.filter((d) => d.kind === 'videoinput');
      const aDevs = devices.filter((d) => d.kind === 'audioinput');
      if (isMountedRef.current) {
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs.length > 0 && !selectedVideoDeviceId) {
          setSelectedVideoDeviceId(vDevs[0].deviceId);
        }
        if (aDevs.length > 0 && !selectedAudioDeviceId) {
          setSelectedAudioDeviceId(aDevs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Could not enumerate media devices:', err);
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  // Broadcast media state helper
  const broadcastMediaState = useCallback(
    (camState: boolean, micState: boolean) => {
      const payload: WebRTCSignal = {
        type: 'media_state',
        isCameraOn: camState,
        isMicOn: micState,
        from: userId,
      };
      sendSignal(payload);
    },
    [sendSignal, userId]
  );

  // Initialize Local Media Stream
  const initLocalStream = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setMediaError(
          'Insecure Origin: Web browsers block camera & microphone on raw HTTP IP addresses. On laptop, switch to http://localhost:3000.'
        );
      } else {
        setMediaError('Webcam & microphone are not supported in this browser environment.');
      }
      return null;
    }

    try {
      setMediaError(null);
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDeviceId
          ? { deviceId: { exact: selectedVideoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: selectedAudioDeviceId
          ? { deviceId: { exact: selectedAudioDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: unknown) {
        console.warn('Full constraints failed, retrying basic constraints:', firstErr);
        try {
          // Relax constraints for virtual devices or basic webcams
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (basicErr: unknown) {
          console.warn('Basic constraints failed, falling back to audio only:', basicErr);
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isMountedRef.current) {
            rawStreamRef.current = audioOnlyStream;
            if (dspGraphRef.current) dspGraphRef.current.cleanup();
            const dspGraph = createNoiseCancellingAudioGraph(audioOnlyStream);
            dspGraphRef.current = dspGraph;
            dspGraph.setEnabled(isNoiseCancellationOn);
            const activeStream = dspGraph.processedStream;

            localStreamRef.current = activeStream;
            setLocalStream(activeStream);
            setIsCameraOn(false);
            isCameraOnRef.current = false;
            setHasCameraPermission(true);
            setMediaError('Camera unavailable or in use by another app. Audio-only mode is active.');
            await enumerateDevices();
            return activeStream;
          }
          return null;
        }
      }

      rawStreamRef.current = stream;

      // Apply Web Audio DSP graph: High-pass rumble filter + Dynamics Compressor (clamps high sounds) + Noise Gate
      if (dspGraphRef.current) {
        dspGraphRef.current.cleanup();
      }
      const dspGraph = createNoiseCancellingAudioGraph(stream);
      dspGraphRef.current = dspGraph;
      dspGraph.setEnabled(isNoiseCancellationOn);

      const activeStream = dspGraph.processedStream;

      // Sync initial tracks enabled state with current state
      activeStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOnRef.current;
      });
      activeStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOnRef.current;
      });

      localStreamRef.current = activeStream;
      setLocalStream(activeStream);
      setHasCameraPermission(true);
      setMediaError(null);

      // Attach tracks to existing RTCPeerConnection if established
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        activeStream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            pcRef.current?.addTrack(track, activeStream);
          }
        });
      }

      // Refresh devices now that permissions have been granted
      await enumerateDevices();
      return activeStream;
    } catch (err: unknown) {
      console.warn('getUserMedia error:', err);
      if (isMountedRef.current) {
        let msg = 'Please allow camera and microphone access to enable video calling.';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Permission denied: Please click the lock or camera icon in your address bar and set Camera & Mic to "Allow".';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No camera or microphone found on this device.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            msg = 'Camera or microphone is busy and currently in use by another app (Zoom, Teams, etc.).';
          }
        }
        setMediaError(msg);
        setHasCameraPermission(false);
      }
      return null;
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId, enumerateDevices, isNoiseCancellationOn]);

  // Clean up Peer Connection
  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (isMountedRef.current) {
      setRemoteStream(null);
      setConnectionState('new');
    }
  }, []);

  // Toggle AI Noise Cancellation (High-sound compression & noise gate)
  const toggleNoiseCancellation = useCallback((forceState?: boolean) => {
    setIsNoiseCancellationOn((prev) => {
      const next = typeof forceState === 'boolean' ? forceState : !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('crosswire_noise_cancellation', String(next));
      }
      if (dspGraphRef.current) {
        dspGraphRef.current.setEnabled(next);
      }
      if (pyWsRef.current && pyWsRef.current.readyState === WebSocket.OPEN) {
        pyWsRef.current.send(
          JSON.stringify({
            type: 'noise_cancellation_state',
            mode: 'deep_suppression',
            active: next,
          })
        );
      }
      return next;
    });
  }, []);

  // Calibrate & Enroll Voice Profile
  const enrollVoiceProfile = useCallback(
    async (displayName: string) => {
      const streamToRecord = rawStreamRef.current || localStreamRef.current;
      if (!streamToRecord) throw new Error('Microphone stream is not available.');

      setIsEnrollingVoice(true);
      try {
        const b64 = await recordVoiceSampleBase64(streamToRecord, 2500);
        if (!b64) throw new Error('Could not record voice calibration sample.');

        const res = await fetch('/api/voice/enroll-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: roomId,
            user_id: userId,
            display_name: displayName,
            audio_base64: b64,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.detail || data.error || 'Voice profile enrollment failed');
        }

        if (pyWsRef.current && pyWsRef.current.readyState === WebSocket.OPEN) {
          pyWsRef.current.send(
            JSON.stringify({
              type: 'enroll_voice',
              displayName,
              audioBase64: b64,
            })
          );
        }

        const enrolled = data.profile as VoiceProfile;
        setEnrolledVoiceProfiles((prev) => {
          const filtered = prev.filter((p) => p.user_id !== userId);
          return [...filtered, enrolled];
        });
        return enrolled;
      } finally {
        if (isMountedRef.current) {
          setIsEnrollingVoice(false);
        }
      }
    },
    [roomId, userId]
  );

  // Create Peer Connection with polite peer negotiation
  const getOrCreatePeerConnection = useCallback((): RTCPeerConnection => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Attach local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Remote Track Listener
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (isMountedRef.current) {
          setRemoteStream(event.streams[0]);
        }
      }
    };

    // ICE Candidate Generation
    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserId) {
        const payload: WebRTCSignal = {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
          from: userId,
          to: remoteUserId,
        };
        sendSignal(payload);
      }
    };

    // Connection State Change
    pc.onconnectionstatechange = () => {
      if (isMountedRef.current) {
        setConnectionState(pc.connectionState);
      }
    };

    // Negotiation Needed handler (Polite peer logic)
    pc.onnegotiationneeded = async () => {
      if (!remoteUserId) return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);

        const payload: WebRTCSignal = {
          type: 'offer',
          offer,
          from: userId,
          to: remoteUserId,
        };
        sendSignal(payload);
      } catch (err) {
        console.error('Error during onnegotiationneeded:', err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [sendSignal, remoteUserId, userId]);

  // Toggle Camera On/Off
  const toggleCamera = useCallback(async () => {
    // 1. If stream does not exist yet, attempt to acquire
    if (!localStreamRef.current) {
      setIsCameraOn(true);
      isCameraOnRef.current = true;
      const s = await initLocalStream();
      if (s) {
        broadcastMediaState(true, isMicOnRef.current);
      }
      return;
    }

    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    isCameraOnRef.current = nextState;

    if (localStreamRef.current) {
      const vTracks = localStreamRef.current.getVideoTracks();
      if (vTracks.length > 0) {
        vTracks.forEach((t) => {
          t.enabled = nextState;
        });
      } else if (nextState) {
        // Stream exists (e.g. audio-only mode) but needs video track
        if (!navigator.mediaDevices?.getUserMedia) {
          setMediaError('Camera access requires HTTPS or localhost:3000.');
          setIsCameraOn(false);
          isCameraOnRef.current = false;
          return;
        }
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({
            video: selectedVideoDeviceId
              ? { deviceId: { exact: selectedVideoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
          const newTrack = videoOnly.getVideoTracks()[0];
          if (newTrack && localStreamRef.current) {
            localStreamRef.current.addTrack(newTrack);
            if (rawStreamRef.current) rawStreamRef.current.addTrack(newTrack);
            if (pcRef.current) {
              const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
              if (sender) {
                await sender.replaceTrack(newTrack);
              } else {
                pcRef.current.addTrack(newTrack, localStreamRef.current);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to re-acquire video track:', err);
          setIsCameraOn(false);
          isCameraOnRef.current = false;
        }
      }
    }
    broadcastMediaState(nextState, isMicOnRef.current);
  }, [isCameraOn, broadcastMediaState, initLocalStream, selectedVideoDeviceId]);

  // Toggle Microphone Mute/Unmute
  const toggleMic = useCallback(async () => {
    // 1. If stream does not exist yet, attempt to acquire
    if (!localStreamRef.current) {
      setIsMicOn(true);
      isMicOnRef.current = true;
      const s = await initLocalStream();
      if (s) {
        broadcastMediaState(isCameraOnRef.current, true);
      }
      return;
    }

    const nextState = !isMicOn;
    setIsMicOn(nextState);
    isMicOnRef.current = nextState;

    if (localStreamRef.current) {
      const aTracks = localStreamRef.current.getAudioTracks();
      if (aTracks.length > 0) {
        aTracks.forEach((track) => {
          track.enabled = nextState;
        });
      } else if (nextState) {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMediaError('Microphone access requires HTTPS or localhost:3000.');
          setIsMicOn(false);
          isMicOnRef.current = false;
          return;
        }
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          const newTrack = audioOnly.getAudioTracks()[0];
          if (newTrack && localStreamRef.current) {
            localStreamRef.current.addTrack(newTrack);
            if (rawStreamRef.current) rawStreamRef.current.addTrack(newTrack);
            if (pcRef.current) {
              const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'audio');
              if (sender) {
                await sender.replaceTrack(newTrack);
              } else {
                pcRef.current.addTrack(newTrack, localStreamRef.current);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to re-acquire audio track:', err);
          setIsMicOn(false);
          isMicOnRef.current = false;
        }
      }
    }
    broadcastMediaState(isCameraOnRef.current, nextState);
  }, [isMicOn, broadcastMediaState, initLocalStream]);

  // Switch Video Device (Camera)
  const switchCamera = useCallback(
    async (deviceId: string) => {
      setSelectedVideoDeviceId(deviceId);
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (!newTrack) return;

        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(newTrack);
          newTrack.enabled = isCameraOnRef.current;
        }

        if (pcRef.current) {
          const senders = pcRef.current.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newTrack);
          } else if (localStreamRef.current) {
            pcRef.current.addTrack(newTrack, localStreamRef.current);
          }
        }
      } catch (err) {
        console.error('Error switching camera device:', err);
      }
    },
    []
  );

  // Switch Audio Device (Microphone)
  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      setSelectedAudioDeviceId(deviceId);
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
        });
        const newTrack = newStream.getAudioTracks()[0];
        if (!newTrack) return;

        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(newTrack);
          newTrack.enabled = isMicOnRef.current;
        }

        if (pcRef.current) {
          const senders = pcRef.current.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender) {
            await audioSender.replaceTrack(newTrack);
          } else if (localStreamRef.current) {
            pcRef.current.addTrack(newTrack, localStreamRef.current);
          }
        }
      } catch (err) {
        console.error('Error switching microphone device:', err);
      }
    },
    []
  );

  // Send a 'ready' ping to remote peer when joined or channel ready
  const announcePresence = useCallback(() => {
    const payload: WebRTCSignal = {
      type: 'ready',
      from: userId,
    };
    sendSignal(payload);
    broadcastMediaState(isCameraOnRef.current, isMicOnRef.current);
  }, [sendSignal, userId, broadcastMediaState]);

  // Listen to Python WebSocket and Supabase Broadcast Events for WebRTC signaling
  useEffect(() => {
    if (!enabled) return;

    const handleWebRTCSignal = async ({ payload }: { payload: WebRTCSignal }) => {
      if (!payload || payload.from === userId) return;

      // Handle remote media state updates
      if (payload.type === 'media_state') {
        if (isMountedRef.current) {
          setRemoteMediaState({
            isCameraOn: payload.isCameraOn,
            isMicOn: payload.isMicOn,
          });
        }
        return;
      }

      // Handle 'ready' announcement from peer
      if (payload.type === 'ready') {
        broadcastMediaState(isCameraOnRef.current, isMicOnRef.current);
        if (userId > payload.from) {
          const pc = getOrCreatePeerConnection();
          try {
            makingOfferRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const offerSignal: WebRTCSignal = {
              type: 'offer',
              offer,
              from: userId,
              to: payload.from,
            };
            sendSignal(offerSignal);
          } catch (err) {
            console.error('Error creating offer on ready:', err);
          } finally {
            makingOfferRef.current = false;
          }
        }
        return;
      }

      // If targeted signal, verify it's for us
      if ('to' in payload && payload.to !== userId) return;

      const pc = getOrCreatePeerConnection();

      // Handle Offer
      if (payload.type === 'offer') {
        const isPolite = userId < payload.from;
        const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';

        ignoreOfferRef.current = !isPolite && offerCollision;
        if (ignoreOfferRef.current) {
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const answerSignal: WebRTCSignal = {
            type: 'answer',
            answer,
            from: userId,
            to: payload.from,
          };
          sendSignal(answerSignal);
        } catch (err) {
          console.error('Error handling offer:', err);
        }
      }

      // Handle Answer
      if (payload.type === 'answer') {
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            while (pendingCandidatesRef.current.length > 0) {
              const cand = pendingCandidatesRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      }

      // Handle ICE Candidate
      if (payload.type === 'candidate') {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } else {
            pendingCandidatesRef.current.push(payload.candidate);
          }
        } catch (err) {
          if (!ignoreOfferRef.current) {
            console.warn('Error adding ice candidate:', err);
          }
        }
      }
    };

    // 1. Supabase channel subscription
    if (channel) {
      channel.on('broadcast', { event: 'webrtc' }, handleWebRTCSignal);
    }

    // 2. Python Ultra-Low Latency WebSocket connection
    const defaultWsHost = typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000`
      : 'ws://127.0.0.1:8000';
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || defaultWsHost;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${wsUrl}/ws/live/${roomId}/${userId}`);
      pyWsRef.current = ws;

      ws.onopen = () => {
        announcePresence();
        // Fetch existing enrolled voice profiles in the room
        fetch(`/api/rooms/${roomId}/voice-profiles`)
          .then((res) => res.json())
          .then((resData) => {
            if (resData.success && Array.isArray(resData.profiles) && isMountedRef.current) {
              setEnrolledVoiceProfiles(resData.profiles);
            }
          })
          .catch(() => {});
      };

      ws.onmessage = async (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'peer_joined' && data.userId !== userId) {
            announcePresence();
          } else if (data.type === 'voice_profile_enrolled' && data.profile) {
            if (isMountedRef.current) {
              setEnrolledVoiceProfiles((prev) => {
                const filtered = prev.filter((p) => p.user_id !== data.userId);
                return [...filtered, data.profile];
              });
            }
          } else {
            let sigType = data.type;
            if (sigType === 'webrtc_offer') sigType = 'offer';
            else if (sigType === 'webrtc_answer') sigType = 'answer';
            else if (sigType === 'webrtc_ice') sigType = 'candidate';
            else if (sigType === 'webrtc_ready') sigType = 'ready';

            if (['offer', 'answer', 'candidate', 'media_state', 'ready'].includes(sigType)) {
              await handleWebRTCSignal({ payload: { ...data, type: sigType } as WebRTCSignal });
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        // Python server not running, fallback to channel seamlessly
      };

      ws.onclose = () => {
        pyWsRef.current = null;
      };
    } catch {
      // fallback
    }

    return () => {
      if (ws) {
        ws.close();
        pyWsRef.current = null;
      }
    };
  }, [channel, enabled, userId, roomId, getOrCreatePeerConnection, broadcastMediaState, sendSignal, announcePresence]);

  // Periodic acoustic noise level & high sound detection metrics polling
  useEffect(() => {
    if (!isMicOn || !isNoiseCancellationOn) return;
    const interval = setInterval(() => {
      if (dspGraphRef.current && isMountedRef.current) {
        setNoiseMetrics(dspGraphRef.current.getMetrics());
      }
    }, 400);
    return () => clearInterval(interval);
  }, [isMicOn, isNoiseCancellationOn]);

  // Mount & Unmount handling
  useEffect(() => {
    let isCancelled = false;
    isMountedRef.current = true;

    if (enabled) {
      const init = async () => {
        await Promise.resolve();
        if (isCancelled || !isMountedRef.current) return;
        await initLocalStream();
        if (isCancelled || !isMountedRef.current) return;
        if (remoteUserId) {
          announcePresence();
        }
      };
      void init();
    }

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
      cleanupPeerConnection();
      if (dspGraphRef.current) {
        dspGraphRef.current.cleanup();
        dspGraphRef.current = null;
      }
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((t) => t.stop());
        rawStreamRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [enabled, initLocalStream, announcePresence, cleanupPeerConnection, remoteUserId]);

  // When remoteUserId changes, announce presence
  useEffect(() => {
    if (remoteUserId && localStreamRef.current) {
      announcePresence();
    }
  }, [remoteUserId, announcePresence]);

  // Switch to Virtual Media Stream (Synthetic canvas video + test tone)
  const activateVirtualStream = useCallback(
    (displayName: string = 'User') => {
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const vStream = createVirtualMediaStream(displayName);
      rawStreamRef.current = vStream;
      localStreamRef.current = vStream;
      setLocalStream(vStream);
      setIsCameraOn(true);
      isCameraOnRef.current = true;
      setIsMicOn(true);
      isMicOnRef.current = true;
      setHasCameraPermission(true);
      setMediaError(null);

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        vStream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            pcRef.current?.addTrack(track, vStream);
          }
        });
      }
      return vStream;
    },
    []
  );

  return {
    localStream,
    remoteStream,
    isCameraOn,
    isMicOn,
    isNoiseCancellationOn,
    noiseMetrics,
    enrolledVoiceProfiles,
    isEnrollingVoice,
    remoteMediaState,
    connectionState,
    mediaError,
    hasCameraPermission,
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
    announcePresence,
    initLocalStream,
    activateVirtualStream,
  };
}
