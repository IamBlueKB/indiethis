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
def get_supabase():
    # Read at call time so credentials set via predict() inputs take effect
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        return create_client(url, key)
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


# ---------- Helper: extract waveform peaks from audio array ----------
def extract_waveform_from_array(y_mono, num_points=200):
    """Returns list of num_points normalized amplitude values (0-1)."""
    n = len(y_mono)
    if n == 0:
        return [0.0] * num_points
    chunk_size = max(1, n // num_points)
    peaks = []
    for i in range(num_points):
        chunk = y_mono[i * chunk_size : (i + 1) * chunk_size]
        peaks.append(float(np.max(np.abs(chunk))) if len(chunk) > 0 else 0.0)
    max_peak = max(peaks) if max(peaks) > 0 else 1.0
    return [p / max_peak for p in peaks]


# ---------- Helper: dynamic range (dB) ----------
def measure_dynamic_range(audio_2d):
    try:
        y_mono = audio_2d[0] if audio_2d.ndim > 1 else audio_2d
        peak_db = 20 * np.log10(max(float(np.max(np.abs(y_mono))), 1e-6))
        rms = librosa.feature.rms(y=y_mono)[0]
        rms_sorted = np.sort(rms)
        floor_rms = np.mean(rms_sorted[:max(1, len(rms_sorted) // 4)])
        floor_db = 20 * np.log10(max(float(floor_rms), 1e-6))
        dr = round(peak_db - floor_db, 1)
        return max(0.0, min(dr, 40.0))
    except Exception:
        return 0.0


# ---------- Helper: stereo width (0–100 %) ----------
def measure_stereo_width(audio_2d):
    try:
        if audio_2d.ndim < 2 or audio_2d.shape[0] < 2:
            return 0.0
        L, R = audio_2d[0], audio_2d[1]
        side = (L - R) / 2
        mid  = (L + R) / 2
        side_pwr = float(np.mean(side ** 2))
        mid_pwr  = float(np.mean(mid  ** 2))
        total = mid_pwr + side_pwr
        if total < 1e-10:
            return 0.0
        return round(min((side_pwr / total) * 200, 100.0), 1)
    except Exception:
        return 0.0


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
        supabase_url: str = Input(description="Supabase project URL", default=""),
        supabase_service_key: str = Input(description="Supabase service role key", default=""),
        genre: str = Input(description="Genre for genre-aware processing (HIP_HOP, POP, RNB, ELECTRONIC, ROCK, INDIE, ACOUSTIC, JAZZ)", default=""),
        input_balance: str = Input(description="JSON string with input frequency balance {sub, low, mid, high}", default="{}"),
    ) -> str:

        # Allow caller to supply Supabase credentials
        if supabase_url:
            os.environ["SUPABASE_URL"] = supabase_url
        if supabase_service_key:
            os.environ["SUPABASE_SERVICE_KEY"] = supabase_service_key

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
            balance_data = json.loads(input_balance) if input_balance and input_balance != "{}" else {}
            result = self._master(audio_url, reference_url, job_id, genre=genre, input_balance=balance_data)
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
    def _master(self, audio_url, reference_url, job_id, genre="", input_balance=None):
        input_path = download_audio(audio_url)
        out_dir = tempfile.mkdtemp()
        versions = {}

        if reference_url:
            ref_path = download_audio(reference_url)
            clean_path = os.path.join(out_dir, "clean.wav")
            mg.process(
                target=input_path,
                reference=ref_path,
                results=[mg.pcm16(clean_path)]
            )
            os.unlink(ref_path)
        else:
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

        y_clean, sr = librosa.load(clean_path, sr=None, mono=False)
        if y_clean.ndim == 1:
            y_clean = np.stack([y_clean, y_clean])

        # Write as 16-bit PCM WAV — half the size of float32 (keeps files under Supabase 50 MB limit)
        def write_wav(path, audio, samplerate):
            sf.write(path, audio.T, samplerate, subtype="PCM_16")

        meter = pyln.Meter(sr)

        def measure_lufs(audio_2d):
            try:
                return round(float(meter.integrated_loudness(audio_2d[0])), 1)
            except Exception:
                return 0.0

        def measure_true_peak(audio_2d):
            try:
                return round(float(np.max(np.abs(audio_2d))) * 20, 1)  # approx dBTP
            except Exception:
                return 0.0

        # ---- Genre-aware chain parameters ----
        g = (genre or "").upper()
        bal = input_balance or {}
        sub_e  = float(bal.get("sub",  0))
        mid_e  = float(bal.get("mid",  0))
        high_e = float(bal.get("high", 0))

        # Warm chain params
        if g == "HIP_HOP":
            warm_low_gain    = 3.0 if sub_e <= mid_e * 1.5 else 1.0  # more sub unless already bass-heavy
            warm_high_gain   = -1.0 if high_e >= mid_e * 0.5 else 1.0
            warm_comp_ratio  = 2.5
            warm_threshold   = -15.0
        elif g == "ACOUSTIC":
            warm_low_gain    = 1.5 if sub_e <= mid_e * 1.5 else 0.5
            warm_high_gain   = -0.5 if high_e >= mid_e * 0.5 else 1.5
            warm_comp_ratio  = 1.8
            warm_threshold   = -18.0
        elif g in ("ELECTRONIC", "ELECTRONIC_EDM"):
            warm_low_gain    = 2.0 if sub_e <= mid_e * 1.5 else 0.5
            warm_high_gain   = 2.0
            warm_comp_ratio  = 2.0
            warm_threshold   = -14.0
        elif g == "RNB":
            warm_low_gain    = 2.0 if sub_e <= mid_e * 1.5 else 0.8
            warm_high_gain   = -0.5
            warm_comp_ratio  = 2.0
            warm_threshold   = -16.0
        elif g == "ROCK":
            warm_low_gain    = 1.5 if sub_e <= mid_e * 1.5 else 0.5
            warm_high_gain   = 1.0 if high_e < mid_e * 0.5 else -0.5
            warm_comp_ratio  = 2.5
            warm_threshold   = -14.0
        else:
            warm_low_gain    = 2.5 if sub_e <= mid_e * 1.5 else 1.0
            warm_high_gain   = -1.5 if high_e >= mid_e * 0.5 else 1.0
            warm_comp_ratio  = 2.0
            warm_threshold   = -16.0

        # Universal high-shelf boost when highs are weak
        extra_high_boost = 1.5 if high_e < mid_e * 0.5 else 0.0

        # Punch chain params
        if g == "HIP_HOP":
            punch_ratio    = 5.0
            punch_attack   = 3.0
        elif g == "ACOUSTIC":
            punch_ratio    = 2.0
            punch_attack   = 10.0
        elif g == "ELECTRONIC":
            punch_ratio    = 4.5
            punch_attack   = 2.0
        elif g == "ROCK":
            punch_ratio    = 5.0
            punch_attack   = 3.0
        else:
            punch_ratio    = 4.0
            punch_attack   = 5.0

        # Loud chain params
        if g == "HIP_HOP":
            loud_gain      = 5.0
            loud_threshold = -0.1
        elif g == "ACOUSTIC":
            loud_gain      = 2.5
            loud_threshold = -0.5
        elif g in ("ELECTRONIC", "ELECTRONIC_EDM"):
            loud_gain      = 6.0
            loud_threshold = -0.05
        elif g == "RNB":
            loud_gain      = 4.0
            loud_threshold = -0.2
        elif g == "ROCK":
            loud_gain      = 4.5
            loud_threshold = -0.1
        else:
            loud_gain      = 4.0
            loud_threshold = -0.1

        write_wav(clean_path, y_clean, sr)  # rewrite clean as PCM_16 (matchering may write float)
        remote_clean = f"mastering/{job_id}/master_clean.wav"
        lufs_data = {}
        true_peak_data = {}
        lufs_data["clean"]      = measure_lufs(y_clean)
        true_peak_data["clean"] = measure_true_peak(y_clean)
        versions["clean"] = upload_to_supabase(clean_path, "processed", remote_clean)

        warm_fx = [
            LowShelfFilter(cutoff_frequency_hz=200, gain_db=warm_low_gain),
            HighShelfFilter(cutoff_frequency_hz=8000, gain_db=warm_high_gain),
            Compressor(threshold_db=warm_threshold, ratio=warm_comp_ratio, attack_ms=20, release_ms=200),
            Limiter(threshold_db=-0.5),
        ]
        if extra_high_boost > 0:
            warm_fx.insert(1, HighShelfFilter(cutoff_frequency_hz=10000, gain_db=extra_high_boost))
        warm_board = Pedalboard(warm_fx)
        y_warm = warm_board(y_clean, sr)
        warm_path = os.path.join(out_dir, "warm.wav")
        write_wav(warm_path, y_warm, sr)
        lufs_data["warm"]      = measure_lufs(y_warm)
        true_peak_data["warm"] = measure_true_peak(y_warm)
        versions["warm"] = upload_to_supabase(warm_path, "processed", f"mastering/{job_id}/master_warm.wav")

        punch_fx = [
            PeakFilter(cutoff_frequency_hz=2500, gain_db=3, q=1.2),
            LowShelfFilter(cutoff_frequency_hz=60, gain_db=2),
            Compressor(threshold_db=-12, ratio=punch_ratio, attack_ms=punch_attack, release_ms=60),
            Limiter(threshold_db=-0.3),
        ]
        if extra_high_boost > 0:
            punch_fx.append(HighShelfFilter(cutoff_frequency_hz=10000, gain_db=extra_high_boost))
        punch_board = Pedalboard(punch_fx)
        y_punch = punch_board(y_clean, sr)
        punch_path = os.path.join(out_dir, "punch.wav")
        write_wav(punch_path, y_punch, sr)
        lufs_data["punch"]      = measure_lufs(y_punch)
        true_peak_data["punch"] = measure_true_peak(y_punch)
        versions["punch"] = upload_to_supabase(punch_path, "processed", f"mastering/{job_id}/master_punch.wav")

        loud_fx = [
            Compressor(threshold_db=-8, ratio=6, attack_ms=2, release_ms=30),
            Gain(gain_db=loud_gain),
            Limiter(threshold_db=loud_threshold),
        ]
        if extra_high_boost > 0:
            loud_fx.append(HighShelfFilter(cutoff_frequency_hz=10000, gain_db=extra_high_boost))
        loud_board = Pedalboard(loud_fx)
        y_loud = loud_board(y_clean, sr)
        loud_path = os.path.join(out_dir, "loud.wav")
        write_wav(loud_path, y_loud, sr)
        lufs_data["loud"]      = measure_lufs(y_loud)
        true_peak_data["loud"] = measure_true_peak(y_loud)
        versions["loud"] = upload_to_supabase(loud_path, "processed", f"mastering/{job_id}/master_loud.wav")

        # ---- Per-version preview clips + waveforms + full stats ----
        # Find best 30-second window using the normalized clean mono audio
        y_clean_mono = librosa.to_mono(y_clean)
        hop_sz = sr
        rms_env = librosa.feature.rms(y=y_clean_mono, hop_length=hop_sz)[0]
        window_frames = 30
        if len(rms_env) > window_frames:
            best_start_f, best_rms_v = 0, 0.0
            for fi in range(len(rms_env) - window_frames):
                avg = float(np.mean(rms_env[fi : fi + window_frames]))
                if avg > best_rms_v:
                    best_rms_v = avg
                    best_start_f = fi
            preview_start = best_start_f * hop_sz
        else:
            preview_start = 0
        preview_end = preview_start + (30 * sr)

        def make_clip(audio_2d, start, end, srate):
            end = min(end, audio_2d.shape[1])
            clip = audio_2d[:, start:end].copy()
            fade = int(0.5 * srate)
            if clip.shape[1] > fade * 2:
                clip[:, :fade]  *= np.linspace(0, 1, fade)
                clip[:, -fade:] *= np.linspace(1, 0, fade)
            return clip

        v_audio_map = {
            "original": y_clean,
            "clean":    y_clean,
            "warm":     y_warm,
            "punch":    y_punch,
            "loud":     y_loud,
        }

        version_waveforms: dict = {}
        preview_paths:     dict = {}

        for vname, vaudio in v_audio_map.items():
            clip = make_clip(vaudio, preview_start, preview_end, sr)
            clip_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            sf.write(clip_tmp, clip.T, sr, subtype="PCM_16")
            remote_p = f"mastering/{job_id}/preview_{vname}.wav"
            upload_to_supabase(clip_tmp, "processed", remote_p)
            preview_paths[vname] = remote_p
            clip_mono = clip[0] if clip.ndim > 1 else clip
            version_waveforms[vname] = extract_waveform_from_array(clip_mono)
            os.unlink(clip_tmp)

        # Full per-version stats
        version_stats: dict = {}
        for vname, vaudio in {
            "clean": y_clean, "warm": y_warm, "punch": y_punch, "loud": y_loud
        }.items():
            version_stats[vname] = {
                "lufs":         lufs_data.get(vname, 0),
                "truePeak":     true_peak_data.get(vname, 0),
                "dynamicRange": measure_dynamic_range(vaudio),
                "stereoWidth":  measure_stereo_width(vaudio),
            }

        os.unlink(input_path)
        shutil.rmtree(out_dir, ignore_errors=True)

        return {
            "versions":          versions,
            "lufs":              lufs_data,
            "true_peak":         true_peak_data,
            "version_waveforms": version_waveforms,
            "version_stats":     version_stats,
            "preview_paths":     preview_paths,
        }

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

        fade_samples = int(0.5 * sr)
        if len(preview) > fade_samples * 2:
            preview[:fade_samples] *= np.linspace(0, 1, fade_samples)
            preview[-fade_samples:] *= np.linspace(1, 0, fade_samples)

        out_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        sf.write(out_path, preview, sr)

        remote_path = f"mastering/{job_id}/preview.wav"
        signed_url = upload_to_supabase(out_path, "processed", remote_path)

        os.unlink(audio_path)
        os.unlink(out_path)

        return {"preview_url": signed_url}
