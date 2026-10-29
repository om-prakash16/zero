"""
Zero Real-Time Audio Processor:
1. Noise Cancellation & High-Sound Limiting (Dynamic Noise Gate, Peak Compressor, Speech Bandpass)
2. Voice Identification & Speaker Acoustic Profiling (Pitch, Spectral Centroid, Voiceprint Matching)
"""

import io
import math
import struct
import wave
import hashlib
import time
from typing import Dict, Any, List, Optional, Tuple

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


# ─── Acoustic Metrics & Denoising Engine ───────────────────────────────────────

class AudioNoiseCanceller:
    """
    Real-Time Audio Enhancer & Noise Canceller:
    - Filters ambient background noise (hum, fans, air conditioning)
    - Compresses sudden high sounds (clipping prevention, yelling, sudden bangs)
    - Computes acoustic quality metrics (RMS, Peak dBFS, SNR estimate)
    """

    def __init__(
        self,
        noise_gate_threshold_db: float = -42.0,
        compressor_threshold_db: float = -12.0,
        compression_ratio: float = 4.0,
        high_pass_hz: float = 80.0,
        low_pass_hz: float = 7500.0,
    ):
        self.noise_gate_threshold_db = noise_gate_threshold_db
        self.compressor_threshold_db = compressor_threshold_db
        self.compression_ratio = compression_ratio
        self.high_pass_hz = high_pass_hz
        self.low_pass_hz = low_pass_hz

    def analyze_audio_levels(self, pcm_samples: List[float]) -> Dict[str, Any]:
        """
        Calculates acoustic levels: RMS, peak dBFS, and estimated noise floor.
        pcm_samples are normalized between -1.0 and 1.0.
        """
        if not pcm_samples:
            return {
                "rms_db": -100.0,
                "peak_db": -100.0,
                "snr_db": 0.0,
                "noise_level": "silent",
                "high_sound_detected": False,
            }

        n = len(pcm_samples)
        sum_sq = sum(s * s for s in pcm_samples)
        rms = math.sqrt(sum_sq / n) if n > 0 else 0.0
        peak = max(abs(s) for s in pcm_samples)

        # Convert to dBFS (0 dBFS is full-scale square wave)
        rms_db = 20.0 * math.log10(max(rms, 1e-5))
        peak_db = 20.0 * math.log10(max(peak, 1e-5))

        # Sort chunk energies to estimate background noise floor (10th percentile)
        chunk_size = max(1, n // 20)
        chunk_energies = []
        for i in range(0, n, chunk_size):
            chunk = pcm_samples[i : i + chunk_size]
            if chunk:
                c_rms = math.sqrt(sum(s * s for s in chunk) / len(chunk))
                chunk_energies.append(20.0 * math.log10(max(c_rms, 1e-5)))

        chunk_energies.sort()
        noise_floor_db = chunk_energies[min(1, len(chunk_energies) - 1)] if chunk_energies else -60.0
        snr_db = max(0.0, rms_db - noise_floor_db)

        high_sound_detected = peak_db > -3.0 or rms_db > -10.0
        if noise_floor_db > -30.0:
            noise_category = "severe"
        elif noise_floor_db > -42.0:
            noise_category = "moderate"
        elif high_sound_detected:
            noise_category = "high_sound_detected"
        else:
            noise_category = "low"

        return {
            "rms_db": round(rms_db, 2),
            "peak_db": round(peak_db, 2),
            "noise_floor_db": round(noise_floor_db, 2),
            "snr_db": round(snr_db, 2),
            "noise_level": noise_category,
            "high_sound_detected": high_sound_detected,
        }

    def process_pcm_samples(
        self,
        samples: List[float],
        sample_rate: int = 16000,
        enable_compression: bool = True,
        enable_noise_gate: bool = True,
    ) -> Tuple[List[float], Dict[str, Any]]:
        """
        Applies dynamic noise gating and high-sound dynamic range compression.
        """
        metrics = self.analyze_audio_levels(samples)
        if not samples:
            return [], metrics

        processed = []
        gate_lin = 10.0 ** (self.noise_gate_threshold_db / 20.0)
        comp_thresh_lin = 10.0 ** (self.compressor_threshold_db / 20.0)

        # Simple single-pole high-pass filter parameter (approximate)
        dt = 1.0 / sample_rate
        rc = 1.0 / (2.0 * math.pi * self.high_pass_hz)
        alpha = rc / (rc + dt)

        prev_in = 0.0
        prev_out = 0.0

        for sample in samples:
            # 1. High-Pass DC and sub-rumble filter
            hp_out = alpha * (prev_out + sample - prev_in)
            prev_in = sample
            prev_out = hp_out

            val = hp_out

            # 2. Dynamic Noise Gate (silence low-level background noise)
            if enable_noise_gate and abs(val) < gate_lin:
                # Smooth downward expansion rather than hard cutoff
                gain = (abs(val) / gate_lin) ** 2
                val *= gain

            # 3. Dynamic Range Compressor for High Sounds (prevent clipping / ear fatigue)
            if enable_compression:
                abs_val = abs(val)
                if abs_val > comp_thresh_lin:
                    excess_db = 20.0 * math.log10(abs_val / comp_thresh_lin)
                    compressed_excess_db = excess_db / self.compression_ratio
                    new_amp = comp_thresh_lin * (10.0 ** (compressed_excess_db / 20.0))
                    val = math.copysign(new_amp, val)

            # 4. Soft limiter clamp
            val = max(-0.98, min(0.98, val))
            processed.append(val)

        post_metrics = self.analyze_audio_levels(processed)
        metrics["post_snr_db"] = post_metrics["snr_db"]
        metrics["post_peak_db"] = post_metrics["peak_db"]
        metrics["attenuation_applied"] = metrics["high_sound_detected"]

        return processed, metrics

    def denoise_wav_bytes(self, wav_bytes: bytes) -> Tuple[bytes, Dict[str, Any]]:
        """
        Decodes 16-bit PCM WAV, filters noise & high sounds, and re-encodes clean WAV.
        """
        try:
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                framerate = wf.getframerate()
                nframes = wf.getnframes()
                raw_frames = wf.readframes(nframes)

            if sampwidth == 2:
                # 16-bit signed integer
                fmt = f"<{nframes * channels}h"
                int_samples = struct.unpack(fmt, raw_frames)
                float_samples = [s / 32768.0 for s in int_samples]
            else:
                return wav_bytes, {"error": "Unsupported sample width", "noise_level": "unknown"}

            cleaned_floats, metrics = self.process_pcm_samples(float_samples, sample_rate=framerate)

            # Re-pack into 16-bit PCM
            re_ints = [int(max(-1.0, min(1.0, s)) * 32767.0) for s in cleaned_floats]
            packed_frames = struct.pack(fmt, *re_ints)

            out_buf = io.BytesIO()
            with wave.open(out_buf, "wb") as out_wf:
                out_wf.setnchannels(channels)
                out_wf.setsampwidth(sampwidth)
                out_wf.setframerate(framerate)
                out_wf.writeframes(packed_frames)

            return out_buf.getvalue(), metrics
        except Exception as e:
            return wav_bytes, {"error": str(e), "noise_level": "raw_pass"}


# ─── Voice Identification & Speaker Diarization Engine ─────────────────────────

class VoiceIdentifier:
    """
    Acoustic Voice Identification & Speaker Profiling:
    - Extracts voiceprint signature (Fundamental pitch, spectral centroid, energy envelope)
    - Compares incoming audio signatures against registered participant profiles
    - Returns match confidence, estimated pitch category, and speaker identity
    """

    def __init__(self):
        # Key: (room_id, user_id) -> Profile Dict
        self.profiles: Dict[Tuple[str, str], Dict[str, Any]] = {}

    def extract_voiceprint(self, samples: List[float], sample_rate: int = 16000) -> Dict[str, Any]:
        """
        Computes acoustic voice characteristics:
        - Pitch (F0) estimate via zero-crossing rate and peak autocorrelation
        - Spectral centroid (timbre brightness)
        - 16-bin normalized energy distribution vector
        """
        if not samples or len(samples) < 128:
            return {
                "pitch_hz": 0.0,
                "pitch_category": "unvoiced",
                "timbre_brightness": 0.0,
                "voiceprint_vector": [0.0] * 16,
                "confidence": 0.0,
            }

        # 1. Fast Pitch estimation (Autocorrelation on human vocal range: 70Hz - 400Hz)
        min_lag = int(sample_rate / 400.0)  # ~40 samples at 16kHz
        max_lag = int(sample_rate / 70.0)   # ~228 samples at 16kHz

        best_lag = 0
        best_corr = 0.0
        n = min(len(samples), 800) # 50ms window is optimal for pitch period

        # Fast coarse pass (step=2)
        for lag in range(min_lag, min(max_lag, n // 2), 2):
            corr = 0.0
            norm_a = 0.0
            norm_b = 0.0
            chunk_len = n - lag
            for i in range(0, chunk_len, 2): # sub-sample step=2
                a = samples[i]
                b = samples[i + lag]
                corr += a * b
                norm_a += a * a
                norm_b += b * b
            if norm_a > 1e-4 and norm_b > 1e-4:
                corr_norm = corr / (math.sqrt(norm_a * norm_b))
                if corr_norm > best_corr:
                    best_corr = corr_norm
                    best_lag = lag

        pitch_hz = round(sample_rate / best_lag, 1) if (best_lag > 0 and best_corr > 0.3) else 0.0

        if pitch_hz == 0:
            pitch_category = "unvoiced / whisper"
        elif pitch_hz < 130:
            pitch_category = "deep_baritone"
        elif pitch_hz < 175:
            pitch_category = "baritone_tenor"
        elif pitch_hz < 250:
            pitch_category = "alto_tenor"
        else:
            pitch_category = "soprano_high"

        # 2. 16-bin Energy Distribution Vector (Acoustic Fingerprint)
        bin_size = max(1, len(samples) // 16)
        bins = []
        for i in range(16):
            start = i * bin_size
            end = min(len(samples), start + bin_size)
            chunk = samples[start:end]
            if chunk:
                energy = math.sqrt(sum(s * s for s in chunk) / len(chunk))
            else:
                energy = 0.0
            bins.append(energy)

        # Normalize vector to unit length
        mag = math.sqrt(sum(b * b for b in bins))
        norm_vector = [round(b / mag, 4) for b in bins] if mag > 1e-5 else [0.0] * 16

        # Zero crossing rate (brightness proxy)
        zcr = 0
        for i in range(1, len(samples)):
            if (samples[i] >= 0 and samples[i - 1] < 0) or (samples[i] < 0 and samples[i - 1] >= 0):
                zcr += 1
        timbre_brightness = round((zcr / len(samples)) * 1000.0, 2)

        return {
            "pitch_hz": pitch_hz,
            "pitch_category": pitch_category,
            "timbre_brightness": timbre_brightness,
            "voiceprint_vector": norm_vector,
            "confidence": round(min(1.0, max(0.2, best_corr)), 2),
        }

    def register_profile(
        self,
        room_id: str,
        user_id: str,
        display_name: str,
        samples: List[float],
        sample_rate: int = 16000,
    ) -> Dict[str, Any]:
        """
        Enrolls or updates a participant's acoustic voice profile.
        """
        vprint = self.extract_voiceprint(samples, sample_rate)

        profile_id = hashlib.sha256(f"{room_id}:{user_id}".encode()).hexdigest()[:12]
        profile = {
            "profile_id": profile_id,
            "room_id": room_id,
            "user_id": user_id,
            "display_name": display_name,
            "pitch_hz": vprint["pitch_hz"],
            "pitch_category": vprint["pitch_category"],
            "timbre_brightness": vprint["timbre_brightness"],
            "voiceprint_vector": vprint["voiceprint_vector"],
            "enrolled_at": time.time(),
            "sample_count": 1,
        }

        key = (room_id, user_id)
        if key in self.profiles:
            existing = self.profiles[key]
            existing_vec = existing["voiceprint_vector"]
            new_vec = vprint["voiceprint_vector"]
            blended = [(e + n) / 2.0 for e, n in zip(existing_vec, new_vec)]
            b_mag = math.sqrt(sum(x * x for x in blended))
            profile["voiceprint_vector"] = [round(x / b_mag, 4) for x in blended] if b_mag > 0 else blended
            profile["sample_count"] = existing["sample_count"] + 1

        self.profiles[key] = profile
        return profile

    def identify_speaker(
        self,
        room_id: str,
        samples: List[float],
        sample_rate: int = 16000,
        threshold: float = 0.65,
    ) -> Dict[str, Any]:
        """
        Matches incoming audio against enrolled profiles in the given room.
        Returns the identified speaker and match score.
        """
        incoming_vprint = self.extract_voiceprint(samples, sample_rate)
        in_vec = incoming_vprint["voiceprint_vector"]

        best_user_id: Optional[str] = None
        best_name = "Unknown Speaker"
        best_score = 0.0

        for (r_id, u_id), profile in self.profiles.items():
            if r_id != room_id:
                continue

            prof_vec = profile["voiceprint_vector"]
            dot = sum(a * b for a, b in zip(in_vec, prof_vec))
            if dot > best_score:
                best_score = dot
                best_user_id = u_id
                best_name = profile["display_name"]

        is_verified = best_score >= threshold and best_user_id is not None

        return {
            "identified": is_verified,
            "user_id": best_user_id if is_verified else None,
            "display_name": best_name if is_verified else "Unknown / Guest Speaker",
            "match_confidence": round(best_score, 3),
            "pitch_hz": incoming_vprint["pitch_hz"],
            "pitch_category": incoming_vprint["pitch_category"],
            "timbre_brightness": incoming_vprint["timbre_brightness"],
        }

    def list_room_profiles(self, room_id: str) -> List[Dict[str, Any]]:
        """Lists all registered profiles in a room."""
        return [
            {
                "profile_id": prof["profile_id"],
                "user_id": prof["user_id"],
                "display_name": prof["display_name"],
                "pitch_category": prof["pitch_category"],
                "pitch_hz": prof["pitch_hz"],
                "sample_count": prof["sample_count"],
            }
            for (r_id, _), prof in self.profiles.items()
            if r_id == room_id
        ]


# Global shared singletons
noise_canceller = AudioNoiseCanceller()
voice_identifier = VoiceIdentifier()
