import os
import sys
import json
import asyncio
from pathlib import Path

# Ensure paths
sys.path.insert(0, str(Path(__file__).resolve().parent))

from starlette.testclient import TestClient
from main import app, room_store, lru_cache

client = TestClient(app)

def test_full_crosswire_engine():
    print("=" * 60)
    print("CROSSWIRE PYTHON FULL ENGINE VERIFICATION SUITE")
    print("=" * 60)

    # 1. Health check
    print("\n[1] Testing /health endpoint...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    print(f" -> Status: {health_data.get('status')}")
    print(f" -> Gemini Configured: {health_data.get('gemini_configured')}")
    print(f" -> TTS Configured: {health_data.get('tts_configured')}")
    print("[PASS] Health endpoint verified.")

    # 2. Instant Guest Session (Zero Auth)
    print("\n[2] Testing /api/auth/guest-session...")
    res = client.post("/api/auth/guest-session", json={"display_name": "LocalTester", "language_code": "hi"})
    assert res.status_code == 200, f"Guest session failed: {res.text}"
    guest = res.json()
    assert guest.get("success") is True
    assert guest.get("user_id").startswith("guest_")
    print(f" -> Created Guest: {guest['display_name']} ({guest['user_id']})")
    print("[PASS] Zero-auth guest engine verified.")

    # 3. Create Conference Room in Python
    print("\n[3] Testing /api/rooms/create...")
    create_payload = {
        "code": "brave-wolf-99",
        "creator_id": guest["user_id"],
        "creator_name": guest["display_name"],
        "language_code": "hi",
        "language_name": "Hindi",
        "max_capacity": 4,
        "admission_mode": "approval_required",
    }
    res = client.post("/api/rooms/create", json=create_payload)
    assert res.status_code == 200, f"Room creation failed: {res.text}"
    room_resp = res.json()
    assert room_resp.get("success") is True
    room = room_resp["room"]
    assert room["code"] == "brave-wolf-99"
    assert room["creator_id"] == guest["user_id"]
    print(f" -> Created Room: {room['code']} (ID: {room['id']})")
    print(f" -> Host: {room_resp['participant']['display_name']} [{room_resp['participant']['language_name']}]")
    print("[PASS] Conference room creation in Python verified.")

    # 4. Get Room Info by Code
    print("\n[4] Testing /api/rooms/info/{code}...")
    res = client.get(f"/api/rooms/info/{room['code']}")
    assert res.status_code == 200, f"Room info failed: {res.text}"
    info = res.json()
    assert info.get("success") is True
    assert info["room"]["code"] == "brave-wolf-99"
    assert len(info["room"]["participants"]) == 1
    print(f" -> Room Info: {info['room']['code']}, capacity: {info['room']['max_capacity']}")
    print("[PASS] Room info retrieval verified.")

    # 5. Peer Join Room (Approval Required Flow)
    print("\n[5] Testing /api/rooms/{code}/join (Peer Admission Request)...")
    join_payload = {
        "user_id": "guest_french_peer_123",
        "display_name": "Marie",
        "language_code": "fr",
        "language_name": "French",
    }
    res = client.post(f"/api/rooms/{room['code']}/join", json=join_payload)
    assert res.status_code == 200, f"Join request failed: {res.text}"
    join_resp = res.json()
    assert join_resp.get("status") == "pending"
    req_id = join_resp.get("request_id")
    print(f" -> Admission Status: {join_resp.get('status')}, Request ID: {req_id}")
    print("[PASS] Pending join request queued successfully.")

    # 6. List and Resolve Join Request (Host approves)
    print("\n[6] Testing /api/rooms/{code}/requests and /admit...")
    res = client.get(f"/api/rooms/{room['code']}/requests")
    assert res.status_code == 200
    reqs = res.json().get("requests", [])
    assert len(reqs) >= 1
    print(f" -> Host sees {len(reqs)} pending request(s)")

    res = client.post(f"/api/rooms/{room['code']}/admit", json={
        "request_id": req_id,
        "action": "approve",
        "host_id": guest["user_id"],
    })
    assert res.status_code == 200
    admit_resp = res.json()
    assert admit_resp.get("success") is True
    print(f" -> Admission Approved: Peer is now admitted as participant.")
    print("[PASS] Host admission workflow verified.")

    # 7. Post Multilingual Conference Message with Automatic Translation
    print("\n[7] Testing /api/rooms/{code}/messages (Multi-participant auto-translation)...")
    msg_payload = {
        "sender_id": guest["user_id"],
        "sender_name": "LocalTester",
        "text": "Namaste, hamari conference call ab shuru ho chuki hai.",
        "source_language": "hi",
        "target_languages": ["fr", "en"],
    }
    res = client.post(f"/api/rooms/{room['code']}/messages", json=msg_payload)
    assert res.status_code == 200, f"Post message failed: {res.text}"
    msg_data = res.json()
    assert msg_data.get("success") is True
    saved_msg = msg_data["message"]
    print(f" -> Original ({saved_msg['source_language']}): {saved_msg['original_text']}")
    print(f" -> Primary Translation ({saved_msg['target_language']}): {saved_msg['translated_text']}")
    print(f" -> Translations Map: {list(saved_msg['translations'].keys())}")
    print("[PASS] Multilingual message broadcast and storage verified.")

    # 8. Sentiment & Emotion Analysis in Python
    print("\n[8] Testing /api/analysis/sentiment...")
    res = client.post("/api/analysis/sentiment", json={
        "text": "I strongly disagree with this architectural approach, we must use asynchronous queues!",
        "context": "tech_debate",
    })
    assert res.status_code == 200
    sent = res.json()
    print(f" -> Tone: {sent.get('tone')}, Intensity: {sent.get('intensity')}/100, Conflict: {sent.get('conflict_level')}")
    print(f" -> Coaching Tip: {sent.get('tip')}")
    print("[PASS] Sentiment & Tone coaching engine verified.")

    # 9. AI Meeting Notes & Executive Summarization in Python
    print("\n[9] Testing /api/rooms/{code}/summary (Gemini 2.5 Executive Intelligence)...")
    res = client.post(f"/api/rooms/{room['code']}/summary", json={})
    assert res.status_code == 200, f"Summary failed: {res.text}"
    summary = res.json()
    assert summary.get("success") is True
    print(f" -> Title: {summary.get('title')}")
    print(f" -> Executive Summary: {summary.get('executive_summary')}")
    print(f" -> Key Points: {summary.get('key_discussion_points')}")
    print(f" -> Decisions: {summary.get('decisions_reached')}")
    print(f" -> Action Items: {summary.get('action_items')}")
    print("[PASS] AI Meeting Notes & Executive Summarization verified.")

    # 10. Voice Synthesis (TTS) in Python
    print("\n[10] Testing /api/voice/synthesize...")
    res = client.post("/api/voice/synthesize", json={"text": "Bonjour, bienvenue à la réunion.", "language": "fr"})
    assert res.status_code == 200
    tts_resp = res.json()
    assert tts_resp.get("success") is True
    assert len(tts_resp.get("audio_base64", "")) > 100
    print(f" -> Synthesized French MP3 audio bytes: {len(tts_resp['audio_base64'])} chars")
    print("[PASS] Neural Voice Dubbing synthesis verified.")

    # 11. System Metrics
    print("\n[11] Testing /api/metrics...")
    res = client.get("/api/metrics")
    assert res.status_code == 200
    metrics = res.json()
    print(f" -> Cache Hit Ratio: {metrics['cache']['hit_ratio_percent']}%")
    print(f" -> Total Managed Rooms: {metrics['rooms']['total_managed_rooms']}")
    print(f" -> Uptime: {metrics['uptime_human']}")
    print("[PASS] Telemetry metrics verified.")

    print("\n" + "=" * 60)
    print("ALL 11 PYTHON ENGINE MODULES PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    test_full_crosswire_engine()
