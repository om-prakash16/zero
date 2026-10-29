import sys
import os
import asyncio
import threading
import time
import json
import base64
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn
import httpx
import websockets
from main import app, room_store

TEST_PORT = 8999
SERVER_URL = f"http://127.0.0.1:{TEST_PORT}"
WS_URL = f"ws://127.0.0.1:{TEST_PORT}"

def run_uvicorn():
    uvicorn.run(app, host="127.0.0.1", port=TEST_PORT, log_level="error")

async def run_realtime_voice_communication_test():
    print("=" * 80)
    print(">> REAL-TIME COMMUNICATION & VOICE TRANSLATION VERIFICATION SUITE")
    print("=" * 80)

    # 1. Server responsiveness check
    print("\n[STEP 1] Connecting to FastAPI Real-Time Engine...")
    async with httpx.AsyncClient() as client:
        for _ in range(30):
            try:
                res = await client.get(f"{SERVER_URL}/health")
                if res.status_code == 200:
                    break
            except Exception:
                await asyncio.sleep(0.2)
        else:
            raise RuntimeError(f"Server failed to start on port {TEST_PORT}")

    health = res.json()
    print(f"  [OK] Server Healthy: Gemini AI = {health.get('gemini_configured')}, TTS = {health.get('tts_configured')}")

    # 2. Setup Conference Room
    room_code = f"comm-voice-{int(time.time())}"
    print(f"\n[STEP 2] Creating Real-Time Multilingual Conference Room: {room_code}...")
    async with httpx.AsyncClient() as client:
        create_res = await client.post(f"{SERVER_URL}/api/rooms/create", json={
            "code": room_code,
            "creator_id": "peer_hindi_speaker",
            "creator_name": "Raj (Hindi Speaker)",
            "language_code": "hi",
            "language_name": "Hindi",
            "max_capacity": 4,
            "admission_mode": "auto_approve",
        })
        assert create_res.status_code == 200
        room_data = create_res.json()["room"]
        print(f"  [OK] Conference Room Established: {room_data['code']}")

        # Peer 2 joins
        join_res = await client.post(f"{SERVER_URL}/api/rooms/{room_code}/join", json={
            "user_id": "peer_french_speaker",
            "display_name": "Amélie (French Speaker)",
            "language_code": "fr",
            "language_name": "French",
        })
        assert join_res.status_code == 200
        print(f"  [OK] French Peer Admitted: Amélie")

    # 3. Establish Dual-Peer Live WebSockets for Full-Duplex Communication
    print("\n[STEP 3] Opening Full-Duplex WebSockets for Real-Time Communication...")
    ws1_url = f"{WS_URL}/ws/live/{room_code}/peer_hindi_speaker"
    ws2_url = f"{WS_URL}/ws/live/{room_code}/peer_french_speaker"

    async with websockets.connect(ws1_url) as ws1:
        print("  [CONNECTED] Raj (Hindi Speaker) WebSocket established")

        async with websockets.connect(ws2_url) as ws2:
            print("  [CONNECTED] Amélie (French Speaker) WebSocket established")

            # Notification of peer presence
            peer_event = json.loads(await ws1.recv())
            assert peer_event.get("type") == "peer_joined"
            print(f"  [SIGNAL] Raj notified of Amélie joining meeting")

            # ── 4. WebRTC Video/Audio Signaling & Media State Sync ──
            print("\n[STEP 4] WebRTC Video/Audio SDP Offer & Answer Signaling...")
            # Offer from Raj to Amélie
            offer_signal = {
                "type": "offer",
                "offer": {"type": "offer", "sdp": "v=0\r\no=raj 100 200 IN IP4 0.0.0.0\r\ns=Crosswire"},
                "from": "peer_hindi_speaker",
                "to": "peer_french_speaker",
            }
            await ws1.send(json.dumps(offer_signal))
            recv_offer = json.loads(await ws2.recv())
            assert recv_offer["type"] == "offer" and recv_offer["from"] == "peer_hindi_speaker"
            print("  [PASS] Amélie received Raj's WebRTC Offer SDP")

            # Answer from Amélie to Raj
            answer_signal = {
                "type": "answer",
                "answer": {"type": "answer", "sdp": "v=0\r\no=amelie 300 400 IN IP4 0.0.0.0\r\ns=Crosswire"},
                "from": "peer_french_speaker",
                "to": "peer_hindi_speaker",
            }
            await ws2.send(json.dumps(answer_signal))
            recv_answer = json.loads(await ws1.recv())
            assert recv_answer["type"] == "answer" and recv_answer["from"] == "peer_french_speaker"
            print("  [PASS] Raj received Amélie's WebRTC Answer SDP")

            # Camera toggle sync
            print("\n[STEP 5] Real-Time Media State Sync (Camera OFF / Mic ON)...")
            media_event = {
                "type": "media_state",
                "isCameraOn": False,
                "isMicOn": True,
                "from": "peer_hindi_speaker",
            }
            await ws1.send(json.dumps(media_event))
            recv_media = json.loads(await ws2.recv())
            assert recv_media["type"] == "media_state"
            assert recv_media["isCameraOn"] is False
            print("  [PASS] Amélie's UI synchronized: Raj's camera is OFF (shows avatar card)")

            # ── 6. Live Speech Chunk -> Instant Live French Translation & Dubbing ──
            print("\n[STEP 6] Real-Time Speech Translation (Hinglish -> French) with Voice Dubbing...")
            speech_chunk = {
                "type": "speech_chunk",
                "text": "Aap sabhi ka is real-time conference call me swagat hai",
                "sourceLanguage": "hi",
                "targetLanguage": "fr",
                "speakerName": "Raj",
                "includeVoiceDubbing": True,
            }
            print(f"  [Speaker (Raj)]: \"{speech_chunk['text']}\"")
            start_t = time.time()
            await ws1.send(json.dumps(speech_chunk))

            # Amélie receives the live_subtitle broadcast
            sub_msg = json.loads(await ws2.recv())
            latency_ms = int((time.time() - start_t) * 1000)
            assert sub_msg["type"] == "live_subtitle"
            assert sub_msg["targetLanguage"] == "fr"
            translated_fr = sub_msg["translatedText"]
            print(f"  [Listener (Amélie)]: \"{translated_fr}\" (Latency: {latency_ms}ms)")
            assert len(translated_fr) > 0

            # Check voice dubbing base64 MP3 payload
            audio_b64 = sub_msg.get("audioDubbingBase64")
            assert audio_b64 is not None and len(audio_b64) > 100
            print(f"  [PASS] Voice Dubbing audio payload received: {len(audio_b64)} chars base64 MP3")

            # ── 7. Reverse Flow: Amélie Speaks French -> Raj Receives Live Hindi Subtitles ──
            print("\n[STEP 7] Reverse Real-Time Speech Translation (French -> Hindi)...")
            speech_chunk_rev = {
                "type": "speech_chunk",
                "text": "Merci Raj, je suis très heureuse de tester cette technologie en direct.",
                "sourceLanguage": "fr",
                "targetLanguage": "hi",
                "speakerName": "Amélie",
                "includeVoiceDubbing": True,
            }
            print(f"  [Speaker (Amélie)]: \"{speech_chunk_rev['text']}\"")
            start_rev = time.time()
            await ws2.send(json.dumps(speech_chunk_rev))

            sub_msg_rev = json.loads(await ws1.recv())
            latency_rev_ms = int((time.time() - start_rev) * 1000)
            assert sub_msg_rev["type"] == "live_subtitle"
            assert sub_msg_rev["targetLanguage"] == "hi"
            translated_hi = sub_msg_rev["translatedText"]
            print(f"  [Listener (Raj)]: \"{translated_hi}\" (Latency: {latency_rev_ms}ms)")
            assert len(translated_hi) > 0
            print("  [PASS] Reverse live speech translation and audio dubbing verified")

    # ── 8. Voice Streaming Endpoint (GET /api/voice/speak) ──
    print("\n[STEP 8] Testing Neural Voice Dubbing Stream (/api/voice/speak)...")
    async with httpx.AsyncClient() as client:
        tts_res = await client.get(f"{SERVER_URL}/api/voice/speak?text=Bienvenue&lang=fr")
        assert tts_res.status_code == 200
        assert "audio/mpeg" in tts_res.headers.get("content-type", "")
        audio_bytes = tts_res.content
        assert len(audio_bytes) > 500
        print(f"  [PASS] Neural Voice stream returned {len(audio_bytes)} bytes of valid MP3 audio")

    print("\n" + "=" * 80)
    print("REAL-TIME COMMUNICATION & VOICE TRANSLATION AUDIT: 100% SUCCESSFUL!")
    print("  • WebRTC Video/Audio P2P Signaling:          VERIFIED")
    print("  • Real-Time Media State Sync:               VERIFIED")
    print("  • Instant Hinglish-to-French Voice Translation: VERIFIED")
    print("  • Instant French-to-Hindi Voice Translation: VERIFIED")
    print("  • Floating Subtitle WebSocket Broadcast:    VERIFIED")
    print("  • Neural MP3 Voice Dubbing Synthesis:       VERIFIED")
    print("=" * 80 + "\n")

def main():
    server_t = threading.Thread(target=run_uvicorn, daemon=True)
    server_t.start()
    asyncio.run(run_realtime_voice_communication_test())

if __name__ == "__main__":
    main()
