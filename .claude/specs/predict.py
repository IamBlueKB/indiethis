import os
import json
import tempfile
import shutil
import requests
import numpy as np
import librosa
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import (
    Pedalboard, Compressor, Limiter, Gain,
    LowShelfFilter, HighShelfFilter, PeakFilter
)
import matchering as mg
from supabase import create_client
from cog import BasePredictor, Input


# ---------- Supabase setup ----------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def get_supabase():
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return None


# ---------- Helper: download audio (synchronous) ----------
def download_audio(url, suffix=".wav"):
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    resp = requests.get(url, timeout=300)
    resp.raise_for_status()
    tmp.write(resp.content)
    tmp.close()
    return tmp.name


# ---------- Helper: upload to Supabase ----------
def upload_to_supabase(local_path, bucket, remote_path):
    client = get_supabase()
    if not client:
        raise RuntimeError("Supabase not configured")
    with open(local_path, "rb") as f:
        client.storage.from_(bucket).upload(
            remote_path, f,
            file_options={"content-type": "audio/wav"}
        )
    res = client.storage.from_(bucket).create_signed_url(remote_path, 3600)
    return res["signedURL"]


# ---------- Helper: key estimation (Krumhansl-Schmuckler) ----------
def estimate_key(chroma):
    avg_chroma = chroma.mean(axis=1)
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    best_corr = -1
    best_key = "C major"

    for i in range(12):
        rotated = np.roll(avg_chroma, -i)
        major_corr = np.corrcoef(rotated, major_profile)[0, 1]
        minor_corr = np.corrcoef(rotated, minor_profile)[0, 1]

        if major_corr > best_corr:
            best_corr = major_corr
            best_key = f"{keys[i]} major"
        if minor_corr > best_corr:
            best_corr = minor_corr
            best_key = f"{keys[i]} minor"

    return best_key


# ---------- Main Predictor ----------
class Predictor(BasePredictor):

    def setup(self):
        print("Setup complete — no heavy models needed")

    def predict(
        self,
        action: str = Input(description="One of: analyze, classify-stems, mix, master, preview, health"),
        audio_url: str = Input(description="Signed URL to input audio", default=""),
        reference_url: str = Input(description="Signed URL to reference track for mastering", default=""),
        stems_urls: str = Input(description="JSON string of stem name to URL mapping", default="{}"),
        job_id: str = Input(description="Unique job ID for organizing outputs", default=""),
    ) -> str:

        if action == "health":
            return json.dumps({"status": "ok"})
        elif action == "analyze":
            result = self._analyze(audio_url)
        elif action == "classify-stems":
            stems = json.loads(stems_urls)
            result = self._classify_stems(stems)
        elif action == "mix":
            stems = json.loads(stems_urls)
            result = self._mix(stems, job_id)
        elif action == "master":
            result = self._master(audio_url, reference_url, job_id)
        elif action == "preview":
            result = self._preview(audio_url, job_id)
        else:
            raise ValueError(f"Unknown action: {action}")

        return json.dumps(result)

    # ---------- ANALYZE ----------
    def _analyze(self, audio_url):
        audio_path = download_audio(audio_url)
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo) if not hasattr(tempo, '__len__') else float(tempo[0])

        # Key
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key = estimate_key(chroma)

        # LUFS
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(y)

        # Frequency balance
        spec = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)
        balance = {
            "sub": float(spec[freqs < 60].mean()),
            "low": float(spec[(freqs >= 60) & (freqs < 250)].mean()),
            "mid": float(spec[(freqs >= 250) & (freqs < 2000)].mean()),
            "high": float(spec[freqs >= 2000].mean()),
        }

        # Beat count and duration
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        _, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)

        os.unlink(audio_path)

        return {
            "bpm": bpm,
            "key": key,
            "lufs": float(loudness),
            "balance": balance,
            "beat_count": len(beat_times),
            "duration": float(len(y) / sr)
        }

    # ---------- CLASSIFY STEMS ----------
    def _classify_stems(self, stems_urls):
        classifications = {}
        for name, url in stems_urls.items():
            audio_path = download_audio(url)
            y, sr = librosa.load(audio_path, sr=None, mono=True)

            spec = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)

            energy_sub = float(spec[freqs < 80].mean())
            energy_low = float(spec[(freqs >= 80) & (freqs < 300)].mean())
            energy_mid = float(spec[(freqs >= 300) & (freqs < 4000)].mean())
            energy_high = float(spec[freqs >= 4000].mean())

            if energy_sub > energy_mid and energy_sub > energy_high:
                stem_type = "bass"
            elif energy_high > energy_mid and energy_high > energy_low:
                stem_type = "hi-hat/cymbal"
            elif energy_sub > energy_low * 1.5:
                stem_type = "kick"
            elif energy_mid > energy_high:
                stem_type = "vocals/synth"
            else:
                stem_type = "other"

            classifications[name] = {
                "type": stem_type,
                "energy": {
                    "sub": energy_sub,
                    "low": energy_low,
                    "mid": energy_mid,
                    "high": energy_high
                }
            }

            os.unlink(audio_path)

        return {"classifications": classifications}

    # ---------- MIX ----------
    def _mix(self, stems_urls, job_id):
        mixed = None
        sr_out = None

        chains = {
            "vocals": Pedalboard([
                PeakFilter(cutoff_frequency_hz=3000, gain_db=2, q=1.0),
                Compressor(threshold_db=-18, ratio=3, attack_ms=10, release_ms=100),
                Limiter(threshold_db=-1)
            ]),
            "bass": Pedalboard([
                LowShelfFilter(cutoff_frequency_hz=80, gain_db=3),
                Compressor(threshold_db=-15, ratio=4, attack_ms=5, release_ms=50),
                Limiter(threshold_db=-1)
            ]),
            "drums": Pedalboard([
                PeakFilter(cutoff_frequency_hz=100, gain_db=2, q=1.5),
                PeakFilter(cutoff_frequency_hz=5000, gain_db=1.5, q=1.0),
                Compressor(threshold_db=-12, ratio=4, attack_ms=2, release_ms=30),
                Limiter(threshold_db=-1)
            ]),
            "other": Pedalboard([
                Compressor(threshold_db=-20, ratio=2, attack_ms=15, release_ms=150),
                Limiter(threshold_db=-1)
            ])
        }

        for name, url in stems_urls.items():
            audio_path = download_audio(url)
            y, sr = librosa.load(audio_path, sr=None, mono=False)
            sr_out = sr

            if y.ndim == 1:
                y = np.stack([y, y])

            chain = chains.get(name, chains["other"])
            processed = chain(y, sr)

            if mixed is None:
                mixed = processed
            else:
                min_len = min(mixed.shape[1], processed.shape[1])
                mixed = mixed[:, :min_len] + processed[:, :min_len]

            os.unlink(audio_path)

        peak = np.max(np.abs(mixed))
        if peak > 0:
            mixed = mixed / peak * 0.95

        out_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        sf.write(out_path, mixed.T, sr_out)

        remote_path = f"mastering/{job_id}/mixed.wav"
        signed_url = upload_to_supabase(out_path, "processed", remote_path)

        os.unlink(out_path)

        return {"mixed_url": signed_url}

    # ---------- MASTER ----------
    def _master(self, audio_url, reference_url, job_id):
        input_path = download_audio(audio_url)
        out_dir = tempfile.mkdtemp()
        versions = {}

        if reference_url:
            # Reference-based mastering with Matchering
            ref_path = download_audio(reference_url)
            clean_path = os.path.join(out_dir, "clean.wav")
            mg.process(
                target=input_path,
                reference=ref_path,
                results=[mg.pcm16(clean_path)]
            )
            os.unlink(ref_path)
        else:
            # No reference — loudness normalization baseline
            y, sr = librosa.load(input_path, sr=None, mono=False)
            if y.ndim == 1:
                y = np.stack([y, y])
            meter = pyln.Meter(sr)
            loudness = meter.integrated_loudness(y[0])
            target_lufs = -14.0
            gain_db = target_lufs - loudness
            y_norm = y * (10 ** (gain_db / 20))
            y_norm = np.clip(y_norm, -1, 1)
            clean_path = os.path.join(out_dir, "clean.wav")
            sf.write(clean_path, y_norm.T, sr)

        # Load clean master as baseline
        y_clean, sr = librosa.load(clean_path, sr=None, mono=False)
        if y_clean.ndim == 1:
            y_clean = np.stack([y_clean, y_clean])

        # Clean — upload as-is
        remote_clean = f"mastering/{job_id}/master_clean.wav"
        versions["clean"] = upload_to_supabase(clean_path, "processed", remote_clean)

        # Warm — low shelf boost, gentle high roll-off, light compression
        warm_board = Pedalboard([
            LowShelfFilter(cutoff_frequency_hz=200, gain_db=2.5),
            HighShelfFilter(cutoff_frequency_hz=8000, gain_db=-1.5),
            Compressor(threshold_db=-16, ratio=2, attack_ms=20, release_ms=200),
            Limiter(threshold_db=-0.5)
        ])
        y_warm = warm_board(y_clean, sr)
        warm_path = os.path.join(out_dir, "warm.wav")
        sf.write(warm_path, y_warm.T, sr)
        remote_warm = f"mastering/{job_id}/master_warm.wav"
        versions["warm"] = upload_to_supabase(warm_path, "processed", remote_warm)

        # Punch — mid presence boost, aggressive compression
        punch_board = Pedalboard([
            PeakFilter(cutoff_frequency_hz=2500, gain_db=3, q=1.2),
            LowShelfFilter(cutoff_frequency_hz=60, gain_db=2),
            Compressor(threshold_db=-12, ratio=4, attack_ms=5, release_ms=60),
            Limiter(threshold_db=-0.3)
        ])
        y_punch = punch_board(y_clean, sr)
        punch_path = os.path.join(out_dir, "punch.wav")
        sf.write(punch_path, y_punch.T, sr)
        remote_punch = f"mastering/{job_id}/master_punch.wav"
        versions["punch"] = upload_to_supabase(punch_path, "processed", remote_punch)

        # Loud — hard compression, maximizer style
        loud_board = Pedalboard([
            Compressor(threshold_db=-8, ratio=6, attack_ms=2, release_ms=30),
            Gain(gain_db=4),
            Limiter(threshold_db=-0.1)
        ])
        y_loud = loud_board(y_clean, sr)
        loud_path = os.path.join(out_dir, "loud.wav")
        sf.write(loud_path, y_loud.T, sr)
        remote_loud = f"mastering/{job_id}/master_loud.wav"
        versions["loud"] = upload_to_supabase(loud_path, "processed", remote_loud)

        # Cleanup
        os.unlink(input_path)
        shutil.rmtree(out_dir, ignore_errors=True)

        return {"versions": versions}

    # ---------- PREVIEW ----------
    def _preview(self, audio_url, job_id):
        audio_path = download_audio(audio_url)
        y, sr = librosa.load(audio_path, sr=None, mono=True)

        hop = sr
        rms = librosa.feature.rms(y=y, hop_length=hop)[0]

        window_frames = 30
        if len(rms) <= window_frames:
            preview = y
        else:
            best_start = 0
            best_rms = 0
            for i in range(len(rms) - window_frames):
                avg = np.mean(rms[i:i + window_frames])
                if avg > best_rms:
                    best_rms = avg
                    best_start = i

            start_sample = best_start * hop
            end_sample = start_sample + (30 * sr)
            preview = y[start_sample:end_sample]

        # Fade in/out (0.5s each)
        fade_samples = int(0.5 * sr)
        if len(preview) > fade_samples * 2:
            fade_in = np.linspace(0, 1, fade_samples)
            fade_out = np.linspace(1, 0, fade_samples)
            preview[:fade_samples] *= fade_in
            preview[-fade_samples:] *= fade_out

        out_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        sf.write(out_path, preview, sr)

        remote_path = f"mastering/{job_id}/preview.wav"
        signed_url = upload_to_supabase(out_path, "processed", remote_path)

        os.unlink(audio_path)
        os.unlink(out_path)

        return {"preview_url": signed_url}
