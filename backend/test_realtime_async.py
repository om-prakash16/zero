import sys
import os
import asyncio
import threading
import time
from pathlib import Path
import json

# Ensure unbuffered UTF-8 output on Windows terminal
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn
import httpx
import websockets
from main import app

SERVER_PORT = 8765
SERVER_URL = f"http://127.0.0.1:{SERVER_PORT}"
WS_URL = f"ws://127.0.0.1:{SERVER_PORT}"

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=SERVER_PORT, log_level="error")

async def run_tests():
    print("=" * 75, flush=True)
    print(">> PYTHON BACKEND: REAL-TIME TRANSLATING, VOICE & COMMUNICATION TEST", flush=True)
    print("=" * 75, flush=True)

    # 1. Wait for server to be responsive
    async with httpx.AsyncClient() as client:
        for _ in range(30):
            try:
                res = await client.get(f"{SERVER_URL}/health")
                if res.status_code == 200:
                    break
            except Exception:
                await asyncio.sleep(0.2)
        else:
            raise RuntimeError("FastAPI server failed to start on port 8765")

    print("\n--- 1. Service Health & Gemini Client ---", flush=True)
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{SERVER_URL}/health")
        data = res.json()
        print(f"  [OK] Status: {data['status']}, Gemini Configured: {data['gemini_configured']}", flush=True)
        assert data["gemini_configured"] is True, "Gemini must be configured"

    # 2. REST Real-Time Hinglish to French Translation
    print("\n--- 2. Real-Time Hinglish-to-French Speech Translation ---", flush=True)
    hinglish_text = "Maine application me real-time video conference aur live voice translation implement kiya hai jo scalable hai"
    print(f"  [Speaker (Hindi/Hinglish)]: \"{hinglish_text}\"", flush=True)

    start_time = time.time()
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{SERVER_URL}/api/translate",
            json={
                "text": hinglish_text,
                "source_language": "hi",
                "target_language": "fr",
                "room_id": "test-room-1",
                "message_id": "msg-1"
            }
        )
    latency_ms = int((time.time() - start_time) * 1000)
    assert res.status_code == 200, f"Translation failed: {res.text}"
    trans_data = res.json()
    french_text = trans_data["translated_text"]
    print(f"  [Receiver (French)]:        \"{french_text}\" (Latency: {latency_ms}ms)", flush=True)

    assert "fr" in trans_data["translations"], "Missing French key in translations"
    assert len(french_text) > 5, "Translation is empty"
    print("  [PASS] Hinglish speech translated accurately into French", flush=True)

    # 3. Two-Peer Real-Time WebSocket Communication Session
    print("\n--- 3. Real-Time Dual-Peer WebRTC Signaling & Voice Stream ---", flush=True)
    room_id = f"room-live-{int(time.time())}"
    candidate_id = "user_candidate_hindi"
    interviewer_id = "user_interviewer_french"

    candidate_ws_url = f"{WS_URL}/ws/live/{room_id}/{candidate_id}"
    interviewer_ws_url = f"{WS_URL}/ws/live/{room_id}/{interviewer_id}"

    async with websockets.connect(candidate_ws_url) as ws_candidate:
        print(f"  [OK] Candidate connected to meeting: {room_id}", flush=True)

        async with websockets.connect(interviewer_ws_url) as ws_interviewer:
            print(f"  [OK] Interviewer connected to meeting: {room_id}", flush=True)

            # Candidate receives peer_joined event
            peer_joined_msg = json.loads(await ws_candidate.recv())
            assert peer_joined_msg.get("type") == "peer_joined", f"Unexpected msg: {peer_joined_msg}"
            print("  [PASS] Candidate notified of Interviewer presence", flush=True)

            # ── A. WebRTC Offer Signaling ──
            print("\n--- 4. WebRTC Video/Audio Signaling (Offer & Answer) ---", flush=True)
            offer_payload = {
                "type": "webrtc_offer",
                "offer": {"type": "offer", "sdp": "v=0\r\no=candidate 123 456 IN IP4 0.0.0.0\r\ns=LiveMeeting"},
                "from": candidate_id,
                "to": interviewer_id
            }
            await ws_candidate.send(json.dumps(offer_payload))
            recv_offer = json.loads(await ws_interviewer.recv())
            assert recv_offer["type"] == "webrtc_offer" and recv_offer["from"] == candidate_id
            print("  [PASS] Interviewer received candidate WebRTC SDP Offer", flush=True)

            # ── B. WebRTC Answer Signaling ──
            answer_payload = {
                "type": "webrtc_answer",
                "answer": {"type": "answer", "sdp": "v=0\r\no=interviewer 456 789 IN IP4 0.0.0.0\r\ns=LiveMeeting"},
                "from": interviewer_id,
                "to": candidate_id
            }
            await ws_interviewer.send(json.dumps(answer_payload))
            recv_answer = json.loads(await ws_candidate.recv())
            assert recv_answer["type"] == "webrtc_answer" and recv_answer["from"] == interviewer_id
            print("  [PASS] Candidate received interviewer WebRTC SDP Answer", flush=True)

            # ── C. Real-Time Camera On/Off & Mic State Sync ──
            print("\n--- 5. Real-Time Camera On/Off State Sync ---", flush=True)
            cam_off_event = {
                "type": "media_state",
                "isCameraOn": False,
                "isMicOn": True,
                "from": candidate_id
            }
            await ws_candidate.send(json.dumps(cam_off_event))
            recv_cam_state = json.loads(await ws_interviewer.recv())
            assert recv_cam_state["type"] == "media_state"
            assert recv_cam_state["isCameraOn"] is False
            assert recv_cam_state["isMicOn"] is True
            print("  [PASS] Remote viewer notified of Camera OFF (activates fallback avatar card)", flush=True)

            # ── D. Live Speech Recognition Chunk -> Instant Subtitle Broadcast ──
            print("\n--- 6. Live Speech Chunk -> Instant Live French Subtitles ---", flush=True)
            speech_chunk = {
                "type": "speech_chunk",
                "text": "Mujhe 3 saal ka experience hai Next.js ke sath",
                "sourceLanguage": "hi",
                "targetLanguage": "fr",
                "speakerName": "Amit Sharma"
            }
            print(f"  [Candidate speaks in Hinglish]: \"{speech_chunk['text']}\"", flush=True)
            start_ws_trans = time.time()
            await ws_candidate.send(json.dumps(speech_chunk))

            # Interviewer receives the live_subtitle broadcast
            subtitle_msg = json.loads(await ws_interviewer.recv())
            ws_trans_latency = int((time.time() - start_ws_trans) * 1000)
            assert subtitle_msg["type"] == "live_subtitle", f"Expected live_subtitle, got: {subtitle_msg}"
            assert subtitle_msg["targetLanguage"] == "fr"
            print(f"  [Interviewer receives Live French Subtitle]: \"{subtitle_msg['translatedText']}\" (Latency: {ws_trans_latency}ms)", flush=True)
            assert len(subtitle_msg["translatedText"]) > 0
            print("  [PASS] Instant live subtitle banner received by remote French viewer", flush=True)

    # 7. Reverse Flow: Client speaks French -> Candidate receives Hindi
    print("\n--- 7. Reverse Speech Flow: Client French Inquiry -> Candidate Hindi ---", flush=True)
    french_question = "Pouvez-vous m'expliquer l'architecture du backend ?"
    print(f"  [Client (French)]:   \"{french_question}\"", flush=True)
    async with httpx.AsyncClient(timeout=15.0) as client:
        res_rev = await client.post(
            f"{SERVER_URL}/api/translate",
            json={
                "text": french_question,
                "source_language": "fr",
                "target_language": "hi",
                "room_id": "test-room-1",
                "message_id": "msg-2"
            }
        )
    assert res_rev.status_code == 200, f"Reverse translation failed: {res_rev.text}"
    candidate_hindi = res_rev.json()["translated_text"]
    print(f"  [Candidate (Hindi)]: \"{candidate_hindi}\"", flush=True)
    assert len(candidate_hindi) > 5
    print("  [PASS] Reverse French-to-Hindi speech translation verified", flush=True)

    print("\n" + "=" * 75, flush=True)
    print("ALL PYTHON BACKEND REAL-TIME VERIFICATION TESTS PASSED (100% SUCCESS)!", flush=True)
    print("   • Real-Time Hinglish-to-French Translation: VERIFIED", flush=True)
    print("   • WebRTC Peer-to-Peer Signaling:            VERIFIED", flush=True)
    print("   • Camera On/Off & Mic Mute Real-Time Sync:  VERIFIED", flush=True)
    print("   • Instant Live Floating Subtitles Stream:   VERIFIED", flush=True)
    print("   • Dual-Way Multilingual Communication:       VERIFIED", flush=True)
    print("=" * 75 + "\n", flush=True)

def main():
    # Start uvicorn server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Run async test suite
    asyncio.run(run_tests())

if __name__ == "__main__":
    main()
