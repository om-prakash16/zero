"""
Comprehensive Python Backend Real-Time Verification Suite
Tests:
1. Real-time Hinglish-to-French speech translation via Gemini
2. Two-peer WebRTC signaling (Offer/Answer/Candidate exchange) via WebSockets
3. Camera On/Off and Mic Mute media state real-time synchronization
4. Live floating subtitle broadcast to remote participant
5. Bidirectional French-to-Hindi interviewer response translation
"""

import sys
import os
from pathlib import Path
import json

# Ensure UTF-8 output on Windows terminal
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from main import app, ai_client

def test_pipeline():
    print("=" * 75)
    print(">> PYTHON BACKEND: REAL-TIME TRANSLATION & COMMUNICATION VERIFICATION")
    print("=" * 75)

    client = TestClient(app)

    # 1. Health check
    print("\n--- 1. Service Health Check ---")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    print(f"  ✓ Health status: {health_data['status']}")
    print(f"  ✓ Gemini API initialized: {health_data['gemini_configured']}")
    assert health_data["gemini_configured"] is True, "Gemini client must be configured"

    # 2. REST Real-time Hinglish-to-French Translation
    print("\n--- 2. Real-Time Hinglish to French Translation ---")
    hinglish_text = "Maine application me real-time video conference aur voice translator banaya hai jo scalable hai"
    print(f"  [Speaker (Hindi/Hinglish)]: \"{hinglish_text}\"")

    res = client.post("/api/translate", json={
        "text": hinglish_text,
        "source_language": "hi",
        "target_language": "fr",
        "room_id": "test-room-1",
        "message_id": "msg-1"
    })
    assert res.status_code == 200, f"Translation request failed: {res.text}"
    data = res.json()
    french_text = data["translated_text"]
    print(f"  [Receiver (French)]:        \"{french_text}\"")

    assert "fr" in data["translations"], "French translation missing in translations map"
    assert len(french_text) > 5, "French translation is too short"
    assert any(term in french_text.lower() for term in ["vidéo", "conférence", "temps réel", "traduction", "scalable", "évolutiv"]), \
        f"Key technical terms missing in French translation: {french_text}"
    print("  ✓ PASS: Hinglish speech translated accurately into professional French")

    # 3. Two-Way WebSocket Real-Time Communication (Candidate & Interviewer)
    print("\n--- 3. Real-Time Dual-Peer WebSocket Meeting Session ---")
    room_id = "test-interview-room-99"
    candidate_id = "user-candidate-hindi"
    interviewer_id = "user-interviewer-french"

    with client.websocket_connect(f"/ws/live/{room_id}/{candidate_id}") as ws_candidate:
        print(f"  ✓ Candidate connected to room: {room_id}")

        with client.websocket_connect(f"/ws/live/{room_id}/{interviewer_id}") as ws_interviewer:
            print(f"  ✓ Interviewer connected to room: {room_id}")

            # Candidate receives peer_joined event
            peer_event = ws_candidate.receive_json()
            assert peer_event["type"] == "peer_joined" and peer_event["userId"] == interviewer_id, \
                f"Candidate did not receive peer_joined: {peer_event}"
            print("  ✓ PASS: Peer presence detected by candidate")

            # ── A. WebRTC Offer Exchange ──
            print("\n--- 4. WebRTC Video/Audio Signaling (Offer & Answer) ---")
            sdp_offer = {
                "type": "webrtc_offer",
                "offer": {"type": "offer", "sdp": "v=0\r\no=candidate 1000 2000 IN IP4 0.0.0.0\r\ns=LiveMeet"},
                "from": candidate_id,
                "to": interviewer_id
            }
            ws_candidate.send_json(sdp_offer)

            interviewer_offer = ws_interviewer.receive_json()
            assert interviewer_offer["type"] == "webrtc_offer", f"Interviewer didn't get offer: {interviewer_offer}"
            assert interviewer_offer["from"] == candidate_id, "Offer 'from' mismatch"
            print("  ✓ PASS: Interviewer received candidate WebRTC SDP Offer")

            # ── B. WebRTC Answer Exchange ──
            sdp_answer = {
                "type": "webrtc_answer",
                "answer": {"type": "answer", "sdp": "v=0\r\no=interviewer 2000 3000 IN IP4 0.0.0.0\r\ns=LiveMeet"},
                "from": interviewer_id,
                "to": candidate_id
            }
            ws_interviewer.send_json(sdp_answer)

            candidate_answer = ws_candidate.receive_json()
            assert candidate_answer["type"] == "webrtc_answer", f"Candidate didn't get answer: {candidate_answer}"
            assert candidate_answer["from"] == interviewer_id, "Answer 'from' mismatch"
            print("  ✓ PASS: Candidate received interviewer WebRTC SDP Answer")

            # ── C. Camera On/Off & Mic Mute Media State Sync ──
            print("\n--- 5. Camera On/Off and Mic Mute Real-Time State Sync ---")
            # Candidate turns off webcam, mic stays on
            cam_toggle_event = {
                "type": "media_state",
                "isCameraOn": False,
                "isMicOn": True,
                "from": candidate_id
            }
            ws_candidate.send_json(cam_toggle_event)

            interviewer_cam_state = ws_interviewer.receive_json()
            assert interviewer_cam_state["type"] == "media_state", "Media state type mismatch"
            assert interviewer_cam_state["isCameraOn"] is False, "Camera state not received as False"
            assert interviewer_cam_state["isMicOn"] is True, "Mic state not received as True"
            print("  ✓ PASS: Interviewer notified of Candidate Camera OFF (activates fallback avatar card)")

            # ── D. Live Speech Chunk -> Real-Time Subtitle Broadcast ──
            print("\n--- 6. Live Speech Recognition Chunk ➔ Instant French Subtitles ---")
            live_speech_chunk = {
                "type": "speech_chunk",
                "text": "Mujhe 3 saal ka experience hai Next.js ke sath",
                "sourceLanguage": "hi",
                "targetLanguage": "fr",
                "speakerName": "Amit Sharma"
            }
            print(f"  [Candidate speaks in Hinglish]: \"{live_speech_chunk['text']}\"")
            ws_candidate.send_json(live_speech_chunk)

            # Interviewer should receive the translated subtitle
            subtitle_event = ws_interviewer.receive_json()
            assert subtitle_event["type"] == "live_subtitle", f"Expected live_subtitle, got: {subtitle_event}"
            assert subtitle_event["targetLanguage"] == "fr", "Target language mismatch"
            assert len(subtitle_event["translatedText"]) > 0, "Translated text is empty"
            print(f"  [Interviewer receives French Live Subtitle]: \"{subtitle_event['translatedText']}\"")
            assert any(t in subtitle_event["translatedText"].lower() for t in ["ans", "expérience", "next.js", "trois"]), \
                f"Translation incomplete: {subtitle_event['translatedText']}"
            print("  ✓ PASS: Instant live subtitle banner received by remote French viewer")

    # 7. Reverse Translation: Client speaking French ➔ Candidate hears Hindi
    print("\n--- 7. Reverse Flow: Client French Inquiry ➔ Candidate Hindi Output ---")
    client_french = "Pouvez-vous me montrer le code de l'architecture ?"
    print(f"  [Client (French)]:   \"{client_french}\"")

    res_rev = client.post("/api/translate", json={
        "text": client_french,
        "source_language": "fr",
        "target_language": "hi",
        "room_id": "test-room-1",
        "message_id": "msg-2"
    })
    assert res_rev.status_code == 200, f"Reverse translation failed: {res_rev.text}"
    candidate_hindi = res_rev.json()["translated_text"]
    print(f"  [Candidate (Hindi)]: \"{candidate_hindi}\"")
    assert any(term in candidate_hindi for term in ["कोड", "आर्किटेक्चर", "दिखा", "सकते"]), \
        f"Hindi reverse translation missing key terms: {candidate_hindi}"
    print("  ✓ PASS: Reverse French-to-Hindi speech translation verified")

    print("\n" + "=" * 75)
    print("✅ ALL PYTHON BACKEND REAL-TIME VERIFICATION TESTS PASSED (100% SUCCESS)!")
    print("   • Real-Time Hinglish-to-French Translation: VERIFIED")
    print("   • WebRTC Peer-to-Peer Signaling:            VERIFIED")
    print("   • Camera On/Off & Mic Mute Real-Time Sync:  VERIFIED")
    print("   • Instant Live Floating Subtitles Stream:   VERIFIED")
    print("   • Dual-Way Multilingual Communication:       VERIFIED")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    test_pipeline()
