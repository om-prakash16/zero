"""
Senior QA Rigorous Test Suite:
1. Acoustic Noise Cancellation & High-Sound Limiter
2. Voice Identification & Speaker Diarization Profiling
3. Python FastAPI Endpoints & WebSocket Event Verification
"""

import sys
import io
import math
import struct
import wave
import base64
import time
import random
from fastapi.testclient import TestClient

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from main import app, noise_canceller, voice_identifier, room_store, normalize_room_code

client = TestClient(app)

def create_synthetic_wav(
    duration_s: float = 1.0,
    sample_rate: int = 16000,
    pitch_hz: float = 160.0,
    amplitude: float = 0.7,
    noise_amplitude: float = 0.05,
    sudden_loud_burst: bool = False,
) -> bytes:
    """Generates synthetic test speech WAV audio with controlled noise and harmonics."""
    buf = io.BytesIO()
    total_samples = int(duration_s * sample_rate)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)

        raw_samples = []
        for i in range(total_samples):
            t = i / sample_rate
            # Fundamental + Formant Harmonics
            speech = amplitude * math.sin(2 * math.pi * pitch_hz * t)
            speech += (amplitude * 0.4) * math.sin(2 * math.pi * (pitch_hz * 2) * t)
            speech += (amplitude * 0.2) * math.sin(2 * math.pi * (pitch_hz * 3) * t)

            # Background noise (simulating hum / fan)
            noise = noise_amplitude * (random.random() * 2 - 1)
            # Low rumble (60Hz electrical hum)
            noise += 0.04 * math.sin(2 * math.pi * 60 * t)

            sample_val = speech + noise

            # High sound burst (simulating shouting or sudden loud bang)
            if sudden_loud_burst and 0.4 <= t <= 0.6:
                sample_val *= 3.5  # Heavy clipping trigger

            clamped = max(-1.0, min(1.0, sample_val))
            raw_samples.append(int(clamped * 32767.0))

        wf.writeframes(struct.pack(f"<{total_samples}h", *raw_samples))

    return buf.getvalue()

def run_tests():
    print("========================================================================")
    print(">> ZERO SENIOR QA AUDIT: NOISE CANCELLATION & VOICE IDENTIFICATION")
    print("========================================================================\n")

    # ──────────────────────────────────────────────────────────────────────────
    # SUITE 1: Acoustic Noise Cancellation & High-Sound Limiter
    # ──────────────────────────────────────────────────────────────────────────
    print("[1] Testing Acoustic Noise Canceller Engine...")

    # 1.1 Quiet Ambient Room Audio
    clean_audio = create_synthetic_wav(duration_s=1.0, amplitude=0.5, noise_amplitude=0.01)
    clean_pcm, metrics_clean = noise_canceller.denoise_wav_bytes(clean_audio)
    assert len(clean_pcm) > 0, "Denoised PCM must not be empty"
    print(f"  [OK] Clean audio analysis: SNR={metrics_clean.get('snr_db')}dB, Peak={metrics_clean.get('peak_db')}dBFS")

    # 1.2 Loud Audio with High Sound Burst (Shouting / Noise Spikes)
    loud_audio = create_synthetic_wav(duration_s=1.0, amplitude=0.8, sudden_loud_burst=True)
    loud_pcm, metrics_loud = noise_canceller.denoise_wav_bytes(loud_audio)
    assert metrics_loud.get("high_sound_detected") is True, "High sound burst must be detected"
    assert metrics_loud.get("attenuation_applied") is True, "Dynamic range compressor must apply attenuation"
    assert metrics_loud.get("post_peak_db") < metrics_loud.get("peak_db"), "Post-processed peak must be safely attenuated"
    print(f"  [OK] High-sound clamping verified: Peak {metrics_loud.get('peak_db')}dBFS -> {metrics_loud.get('post_peak_db')}dBFS (Compressed)")

    # ──────────────────────────────────────────────────────────────────────────
    # SUITE 2: Voice Identification & Acoustic Profiling
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[2] Testing Voice Identification & Diarization Engine...")

    room_code = "brave-wolf-42"
    # Speaker A: Deep Baritone (~120Hz)
    audio_speaker_a = create_synthetic_wav(duration_s=1.0, pitch_hz=120.0, amplitude=0.7)
    # Speaker B: Alto / Tenor (~220Hz)
    audio_speaker_b = create_synthetic_wav(duration_s=1.0, pitch_hz=220.0, amplitude=0.7)

    # 2.1 Enroll Speaker A (Om Prakash)
    prof_a = client.post(
        "/api/voice/enroll-profile",
        json={
            "room_id": room_code,
            "user_id": "user-om-1",
            "display_name": "Om Prakash",
            "audio_base64": base64.b64encode(audio_speaker_a).decode(),
        },
    )
    assert prof_a.status_code == 200, f"Enroll speaker A failed: {prof_a.text}"
    data_a = prof_a.json()
    assert data_a["success"] is True
    assert data_a["profile"]["display_name"] == "Om Prakash"
    print(f"  [OK] Speaker A enrolled: '{data_a['profile']['display_name']}' ({data_a['profile']['pitch_category']})")

    # 2.2 Enroll Speaker B (Alex)
    prof_b = client.post(
        "/api/voice/enroll-profile",
        json={
            "room_id": room_code,
            "user_id": "user-alex-2",
            "display_name": "Alex Smith",
            "audio_base64": base64.b64encode(audio_speaker_b).decode(),
        },
    )
    assert prof_b.status_code == 200
    data_b = prof_b.json()
    assert data_b["success"] is True
    print(f"  [OK] Speaker B enrolled: '{data_b['profile']['display_name']}' ({data_b['profile']['pitch_category']})")

    # 2.3 Verify Room Voice Profiles Listing
    list_res = client.get(f"/api/rooms/{room_code}/voice-profiles")
    assert list_res.status_code == 200
    profiles_list = list_res.json()["profiles"]
    assert len(profiles_list) == 2, f"Expected 2 profiles, got {len(profiles_list)}"
    print(f"  [OK] Room voice profiles listing verified: {len(profiles_list)} enrolled profiles")

    # 2.4 Identify Speaker A from new audio sample
    test_chunk_a = create_synthetic_wav(duration_s=0.8, pitch_hz=122.0, amplitude=0.6)
    ident_res_a = client.post(
        "/api/voice/identify",
        json={
            "room_id": room_code,
            "audio_base64": base64.b64encode(test_chunk_a).decode(),
            "threshold": 0.50,
        },
    )
    assert ident_res_a.status_code == 200
    ident_data_a = ident_res_a.json()["identification"]
    assert ident_data_a["identified"] is True
    assert ident_data_a["display_name"] == "Om Prakash"
    print(f"  [OK] Speaker identification matched: {ident_data_a['display_name']} (Confidence: {ident_data_a['match_confidence']})")

    # ──────────────────────────────────────────────────────────────────────────
    # SUITE 3: Audio Denoising Endpoint Integration
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[3] Testing /api/audio/denoise endpoint...")
    noisy_payload = create_synthetic_wav(duration_s=1.0, sudden_loud_burst=True)
    denoise_res = client.post(
        "/api/audio/denoise",
        json={
            "audio_base64": base64.b64encode(noisy_payload).decode(),
            "apply_noise_gate": True,
            "apply_high_sound_compression": True,
        },
    )
    assert denoise_res.status_code == 200
    d_data = denoise_res.json()
    assert d_data["success"] is True
    assert "cleaned_audio_base64" in d_data
    assert d_data["metrics"]["high_sound_detected"] is True
    print(f"  [OK] /api/audio/denoise processed successfully. Output length: {len(d_data['cleaned_audio_base64'])} chars")

    # ──────────────────────────────────────────────────────────────────────────
    # SUITE 4: Speech Recognition with Noise Cancellation & Voice ID Metadata
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[4] Testing /api/speech/recognize-and-translate with Acoustic AI...")
    stt_res = client.post(
        "/api/speech/recognize-and-translate",
        json={
            "audio_base64": base64.b64encode(audio_speaker_a).decode(),
            "audio_format": "audio/wav",
            "source_language": "hi",
            "target_language": "en",
            "room_id": room_code,
            "include_voice_dubbing": True,
        },
    )
    assert stt_res.status_code == 200
    stt_data = stt_res.json()
    assert stt_data["success"] is True
    assert "noise_cancellation" in stt_data
    assert "voice_identification" in stt_data
    assert stt_data["voice_identification"]["identified_speaker"] in ("Om Prakash", "Unknown Speaker")
    print(f"  [OK] Recognition with Noise & Voice ID: Identified '{stt_data['voice_identification']['identified_speaker']}'")

    # ──────────────────────────────────────────────────────────────────────────
    # SUITE 5: WebSocket Real-Time Voice Profile & Noise Sync
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[5] Testing WebSocket Real-Time Channel with Noise & Voice ID...")
    with client.websocket_connect(f"/ws/live/{room_code}/test-ws-user") as ws:
        # Ping / Pong check
        ws.send_json({"type": "ping"})
        pong = ws.receive_json()
        assert pong["type"] == "pong", f"Expected pong, got {pong}"
        print("  [OK] WebSocket ping/pong verified")

        # Live voice profile enrollment
        ws.send_json({
            "type": "enroll_voice",
            "displayName": "Om Prakash Live",
            "audioBase64": base64.b64encode(audio_speaker_a).decode(),
        })
        enrolled_sync = ws.receive_json()
        assert enrolled_sync["type"] == "voice_profile_enrolled"
        assert enrolled_sync["displayName"] == "Om Prakash Live"
        assert "profile" in enrolled_sync
        print(f"  [OK] Live voice profile enrollment broadcasted: {enrolled_sync['displayName']}")

    print("\n========================================================================")
    print(">> ALL NOISE CANCELLATION & VOICE IDENTIFICATION AUDITS PASSED 100%!")
    print("========================================================================")

if __name__ == "__main__":
    run_tests()
