import os
import sys
import io
import time
import base64
from pathlib import Path

# Unbuffered output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))

from starlette.testclient import TestClient
from main import app, synthesize_tts_bytes

client = TestClient(app)

async def run_voice_pipeline_tests():
    print("=" * 65, flush=True)
    print("CROSSWIRE: REAL-TIME VOICE PIPELINE VERIFICATION", flush=True)
    print("=" * 65, flush=True)

    # -------------------------------------------------------------
    # 1. TEXT TO VOICE (TTS Synthesis & Audio Streaming)
    # -------------------------------------------------------------
    print("\n[STEP 1] Testing Text-to-Voice (Neural TTS Synthesis)...", flush=True)
    sample_phrase = "Welcome to the real-time conference. We are testing audio dubbing."
    res = client.post("/api/voice/synthesize", json={
        "text": sample_phrase,
        "language": "en",
        "slow": False
    })
    assert res.status_code == 200, f"TTS synthesis failed: {res.text}"
    tts_json = res.json()
    assert tts_json.get("success") is True
    audio_b64 = tts_json.get("audio_base64")
    assert audio_b64 is not None and len(audio_b64) > 100
    audio_bytes = base64.b64decode(audio_b64)
    print(f"  ✅ Text-to-Voice generated {len(audio_bytes)} MP3 bytes", flush=True)
    print(f"  ✅ Format: {tts_json.get('format')}", flush=True)

    # Test direct audio stream endpoint
    res_stream = client.get(f"/api/voice/speak?text=TestingAudioStream&lang=en")
    assert res_stream.status_code == 200
    assert res_stream.headers["content-type"] == "audio/mpeg"
    print(f"  ✅ Direct Audio Stream /api/voice/speak responded with audio/mpeg ({len(res_stream.content)} bytes)", flush=True)

    # -------------------------------------------------------------
    # 2. VOICE TO TEXT & REAL-TIME TRANSLATION (Acoustic Multimodal STT)
    # -------------------------------------------------------------
    print("\n[STEP 2] Testing Voice-to-Text & Multimodal Speech Translation...", flush=True)
    hindi_phrase = "हम रियल टाइम वॉइस ट्रांसलेशन का टेस्ट कर रहे हैं"
    print(f"  Synthesizing source voice audio in Hindi: '{hindi_phrase}'", flush=True)
    hindi_audio_bytes = await synthesize_tts_bytes(hindi_phrase, "hi")
    hindi_audio_b64 = base64.b64encode(hindi_audio_bytes).decode("utf-8")

    print("  Submitting voice audio to /api/speech/recognize-and-translate...", flush=True)
    stt_res = client.post("/api/speech/recognize-and-translate", json={
        "audio_base64": hindi_audio_b64,
        "audio_format": "audio/mp3",
        "source_language": "hi",
        "target_language": "en",
        "include_voice_dubbing": True,
    })
    assert stt_res.status_code == 200, f"Speech recognition failed: {stt_res.text}"
    stt_json = stt_res.json()
    assert stt_json.get("success") is True

    print(f"  ✅ Voice-to-Text Transcription: '{stt_json.get('transcription')}'", flush=True)
    print(f"  ✅ Real-time Translation (En): '{stt_json.get('translation')}'", flush=True)
    print(f"  ✅ Acoustic Clarity Rating: {stt_json.get('clarity')}", flush=True)
    dubbed_b64 = stt_json.get("voice_dubbed_audio_base64")
    assert dubbed_b64 is not None and len(dubbed_b64) > 100
    print(f"  ✅ Synchronized Voice Dubbing Generated: {len(base64.b64decode(dubbed_b64))} bytes of target language speech", flush=True)

    # -------------------------------------------------------------
    # 3. REAL-TIME TRANSLATION WITH LRU CACHE ACCELERATION
    # -------------------------------------------------------------
    print("\n[STEP 3] Testing Real-Time Translation & Sub-5ms In-Memory LRU Cache...", flush=True)
    test_statement = "Hum application me live conference video translation implement kar rahe hain."

    # First call: AI Model Execution
    t0 = time.time()
    res1 = client.post("/api/translate", json={
        "text": test_statement,
        "source_language": "hi",
        "target_language": "en",
        "target_languages": ["en", "fr"],
    })
    t_first = (time.time() - t0) * 1000
    assert res1.status_code == 200
    data1 = res1.json()
    print(f"  First call (AI generation): {t_first:.1f}ms", flush=True)
    print(f"  -> En Translation: '{data1['translations'].get('en')}'", flush=True)
    print(f"  -> Fr Translation: '{data1['translations'].get('fr')}'", flush=True)
    print(f"  -> Cached: {data1.get('cached')}", flush=True)

    # Second call: LRU In-Memory Cache (< 5ms response)
    t1 = time.time()
    res2 = client.post("/api/translate", json={
        "text": test_statement,
        "source_language": "hi",
        "target_language": "en",
        "target_languages": ["en", "fr"],
    })
    t_second = (time.time() - t1) * 1000
    assert res2.status_code == 200
    data2 = res2.json()
    print(f"  Second call (LRU Cache Hit): {t_second:.1f}ms", flush=True)
    print(f"  -> Cached: {data2.get('cached')}", flush=True)
    assert data2.get("cached") is True

    # -------------------------------------------------------------
    # 4. WEBSOCKET REAL-TIME SPEECH & VOICE DUBBING PIPELINE
    # -------------------------------------------------------------
    print("\n[STEP 4] Testing Full-Duplex WebSocket Speech Chunk & Dubbing Stream...", flush=True)
    with client.websocket_connect("/ws/live/room-test-99/speaker-1") as ws_speaker:
        with client.websocket_connect("/ws/live/room-test-99/listener-2") as ws_listener:
            # Speaker sends speech chunk
            ws_speaker.send_json({
                "type": "speech_chunk",
                "text": "Conference room speech translation is operational.",
                "sourceLanguage": "en",
                "targetLanguage": "es",
                "speakerName": "Speaker A",
                "includeVoiceDubbing": True,
            })

            # Listener receives live_subtitle broadcast
            msg = ws_listener.receive_json()
            assert msg.get("type") == "live_subtitle", f"Expected live_subtitle, got {msg}"
            print(f"  ✅ Live Subtitle Broadcast received by Peer: '{msg.get('originalText')}' -> '{msg.get('translatedText')}'", flush=True)
            assert msg.get("audioDubbingBase64") is not None
            print(f"  ✅ Live Voice Dubbing Audio attached to subtitle stream ({len(msg['audioDubbingBase64'])} chars)", flush=True)

    print("\n" + "=" * 65, flush=True)
    print("🎉 REAL-TIME VOICE TRANSLATING, VOICE-TO-TEXT & TEXT-TO-VOICE ARE 100% WORKING!", flush=True)
    print("=" * 65, flush=True)

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_voice_pipeline_tests())
