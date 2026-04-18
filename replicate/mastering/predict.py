"""
IndieThis Mastering Engine — Replicate Cog Predictor

Handles all DSP operations for the mastering pipeline:
  analyze       — BPM, key, LUFS, sections, spectral analysis
  separate      — Demucs 4-stem separation
  classify-stems — frequency-based stem type classification
  mix           — Pedalboard per-stem processing chains → stereo mixdown
  master        — Matchering + Pedalboard 4-version mastering
  preview       — 30-second highest-energy section extraction
  health        — service health check

All audio results are uploaded to Supabase storage.
Returns JSON string — TypeScript caller parses with JSON.parse().
"""

import os
import json
import tempfile
import subprocess
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


# ── Supabase setup ─────────────────────────────────────────────────────────────

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def get_supabase():
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set as env vars on the Replicate model.")


# ── Helpers ────────────────────────────────────────────────────────────────────

def download_audio(url: str, suffix: str = ".wav") -> str:
    """Download audio from URL to a temp file. Returns local path."""
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    resp = requests.get(url, timeout=300)
    resp.raise_for_status()
    tmp.write(resp.content)
    tmp.close()
    return tmp.name


def upload_to_supabase(local_path: str, bucket: str, remote_path: str) -> str:
    """Upload a local file to Supabase storage. Returns a signed URL (1h)."""
    client = get_supabase()
    with open(local_path, "rb") as f:
        client.storage.from_(bucket).upload(
            remote_path, f,
            file_options={"content-type": "audio/wav", "upsert": "true"}
        )
    res = client.storage.from_(bucket).create_signed_url(remote_path, 3600)
    return res["signedURL"]


def estimate_key(chroma: np.ndarray) -> str:
    """Krumhansl-Schmuckler key estimation from chromagram."""
    avg_chroma    = chroma.mean(axis=1)
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    keys          = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    best_corr = -1.0
    best_key  = "C major"

    for i in range(12):
        rotated    = np.roll(avg_chroma, -i)
        major_corr = float(np.corrcoef(rotated, major_profile)[0, 1])
        minor_corr = float(np.corrcoef(rotated, minor_profile)[0, 1])

        if major_corr > best_corr:
            best_corr = major_corr
            best_key  = f"{keys[i]} major"
        if minor_corr > best_corr:
            best_corr = minor_corr
            best_key  = f"{keys[i]} minor"

    return best_key


def compute_true_peak(y: np.ndarray) -> float:
    """Approximate true peak in dBFS."""
    peak = float(np.max(np.abs(y)))
    if peak <= 0:
        return -100.0
    return float(20 * np.log10(peak))


def compute_dynamic_range(y: np.ndarray, sr: int) -> float:
    """Crest factor as a proxy for dynamic range (dB)."""
    rms  = float(np.sqrt(np.mean(y ** 2)))
    peak = float(np.max(np.abs(y)))
    if rms <= 0:
        return 0.0
    return float(20 * np.log10(peak / rms))


def detect_sections(y: np.ndarray, sr: int, duration: float) -> list:
    """
    Simple onset-strength–based section detection.
    Splits the track into 4–6 segments and labels them by position and energy.
    Returns a list matching the TypeScript DetectedSection interface.
    """
    section_labels = ["intro", "verse", "chorus", "verse", "chorus", "outro"]
    section_count  = min(6, max(4, int(duration // 30)))
    seg_duration   = duration / section_count

    # Compute RMS per segment to determine energy
    rms_vals = []
    for i in range(section_count):
        start_sample = int(i * seg_duration * sr)
        end_sample   = int((i + 1) * seg_duration * sr)
        seg          = y[start_sample:end_sample]
        rms_vals.append(float(np.sqrt(np.mean(seg ** 2))) if len(seg) > 0 else 0.0)

    max_rms = max(rms_vals) if max(rms_vals) > 0 else 1.0

    sections = []
    for i in range(section_count):
        label  = section_labels[i] if i < len(section_labels) else "verse"
        energy = rms_vals[i] / max_rms
        # Sections 2 and 4 (0-indexed) are choruses if energy > 0.6
        if energy > 0.6 and label not in ("intro", "outro"):
            label = "chorus"
        sections.append({
            "label":    label,
            "startSec": round(i * seg_duration, 2),
            "endSec":   round((i + 1) * seg_duration, 2),
            "type":     label,
            "energy":   round(energy, 3),
        })

    return sections


def compute_frequency_balance(y: np.ndarray, sr: int) -> list:
    """Returns FrequencyBand array matching the TypeScript interface."""
    spec  = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)

    def band_energy(lo, hi):
        mask = (freqs >= lo) & (freqs < hi)
        return float(spec[mask].mean()) if mask.any() else 0.0

    max_e = max(
        band_energy(20, 60), band_energy(60, 250), band_energy(250, 500),
        band_energy(500, 2000), band_energy(2000, 6000), band_energy(6000, 16000),
        band_energy(16000, sr // 2), 1e-10
    )

    bands = [
        {"band": "sub",     "hzLow": 20,    "hzHigh": 60,        "energy": band_energy(20, 60)},
        {"band": "low",     "hzLow": 60,    "hzHigh": 250,       "energy": band_energy(60, 250)},
        {"band": "lowmid",  "hzLow": 250,   "hzHigh": 500,       "energy": band_energy(250, 500)},
        {"band": "mid",     "hzLow": 500,   "hzHigh": 2000,      "energy": band_energy(500, 2000)},
        {"band": "highmid", "hzLow": 2000,  "hzHigh": 6000,      "energy": band_energy(2000, 6000)},
        {"band": "high",    "hzLow": 6000,  "hzHigh": 16000,     "energy": band_energy(6000, 16000)},
        {"band": "air",     "hzLow": 16000, "hzHigh": sr // 2,   "energy": band_energy(16000, sr // 2)},
    ]

    for b in bands:
        b["energy"] = round(b["energy"] / max_e, 4)

    return bands


# ── Predictor ──────────────────────────────────────────────────────────────────

class Predictor(BasePredictor):

    def setup(self):
        """Pre-download Demucs weights at container start."""
        print("Pre-loading Demucs model weights...")
        try:
            subprocess.run(
                ["python", "-m", "demucs", "--help"],
                capture_output=True, timeout=30
            )
        except Exception:
            pass
        print("Setup complete.")

    def predict(
        self,
        action: str = Input(
            description="One of: analyze, separate, classify-stems, mix, master, preview, health"
        ),
        audio_url: str = Input(
            description="Signed URL to input audio file",
            default=""
        ),
        reference_url: str = Input(
            description="Signed URL to reference track (master action only)",
            default=""
        ),
        stems_json: str = Input(
            description='JSON string: stem name → URL map. e.g. {"vocals":"https://...","bass":"https://..."}',
            default="{}"
        ),
        job_id: str = Input(
            description="Unique mastering job ID — used for Supabase output paths",
            default=""
        ),
        master_params_json: str = Input(
            description="JSON string of mastering parameters from Claude decisions layer",
            default="{}"
        ),
        mix_params_json: str = Input(
            description="JSON string of per-stem processing chains from Claude decisions layer",
            default="{}"
        ),
        supabase_url: str = Input(
            description="Supabase project URL (passed from caller if not set as env var)",
            default=""
        ),
        supabase_service_key: str = Input(
            description="Supabase service role key (passed from caller if not set as env var)",
            default=""
        ),
    ) -> str:
        """Routes to the appropriate method. Always returns a JSON string."""

        # Allow caller to supply Supabase credentials if not set as env vars
        if supabase_url:
            os.environ["SUPABASE_URL"] = supabase_url
        if supabase_service_key:
            os.environ["SUPABASE_SERVICE_KEY"] = supabase_service_key

        if action == "health":
            return json.dumps({"ok": True, "version": "1.0.0"})

        if action == "analyze":
            result = self._analyze(audio_url)

        elif action == "separate":
            result = self._separate(audio_url, job_id)

        elif action == "classify-stems":
            stems = json.loads(stems_json)
            result = self._classify_stems(stems)

        elif action == "mix":
            stems      = json.loads(stems_json)
            mix_params = json.loads(mix_params_json) if mix_params_json else {}
            result     = self._mix(stems, mix_params, job_id)

        elif action == "master":
            master_params = json.loads(master_params_json) if master_params_json else {}
            result        = self._master(audio_url, reference_url, master_params, job_id)

        elif action == "preview":
            result = self._preview(audio_url, job_id)

        else:
            raise ValueError(f"Unknown action: {action}")

        return json.dumps(result)

    # ── ANALYZE ────────────────────────────────────────────────────────────────

    def _analyze(self, audio_url: str) -> dict:
        audio_path = download_audio(audio_url)
        try:
            y_mono, sr = librosa.load(audio_path, sr=None, mono=True)
            y_stereo, _ = librosa.load(audio_path, sr=None, mono=False)
            if y_stereo.ndim == 1:
                y_stereo = np.stack([y_stereo, y_stereo])

            duration = float(len(y_mono) / sr)

            # BPM
            tempo, _ = librosa.beat.beat_track(y=y_mono, sr=sr)
            bpm      = float(tempo) if not hasattr(tempo, '__len__') else float(tempo[0])

            # Key
            chroma = librosa.feature.chroma_cqt(y=y_mono, sr=sr)
            key    = estimate_key(chroma)

            # LUFS (integrated loudness)
            meter    = pyln.Meter(sr)
            lufs     = float(meter.integrated_loudness(y_mono))

            # Spectral centroid
            centroid         = librosa.feature.spectral_centroid(y=y_mono, sr=sr)
            spectral_centroid = float(centroid.mean())

            # Stereo width (mid-side difference)
            if y_stereo.shape[0] >= 2:
                mid  = (y_stereo[0] + y_stereo[1]) / 2
                side = (y_stereo[0] - y_stereo[1]) / 2
                mid_rms  = float(np.sqrt(np.mean(mid ** 2))) + 1e-10
                side_rms = float(np.sqrt(np.mean(side ** 2)))
                stereo_width = round(min(side_rms / mid_rms, 1.0), 3)
            else:
                stereo_width = 0.0

            true_peak      = compute_true_peak(y_mono)
            dynamic_range  = compute_dynamic_range(y_mono, sr)
            freq_balance   = compute_frequency_balance(y_mono, sr)
            sections       = detect_sections(y_mono, sr, duration)

            return {
                "bpm":              round(bpm, 2),
                "key":              key,
                "lufs":             round(lufs, 2),
                "truePeak":         round(true_peak, 2),
                "dynamicRange":     round(dynamic_range, 2),
                "stereoWidth":      stereo_width,
                "spectralCentroid": round(spectral_centroid, 2),
                "frequencyBalance": freq_balance,
                "sections":         sections,
                "durationSec":      round(duration, 2),
            }
        finally:
            os.unlink(audio_path)

    # ── SEPARATE ───────────────────────────────────────────────────────────────

    def _separate(self, audio_url: str, job_id: str) -> dict:
        audio_path = download_audio(audio_url)
        out_dir    = tempfile.mkdtemp()

        try:
            # Full 4-stem Demucs separation (htdemucs)
            subprocess.run(
                ["python", "-m", "demucs", "-o", out_dir, audio_path],
                check=True, timeout=600
            )

            # Find output directory (htdemucs/<filename>/)
            demucs_out = None
            for root, dirs, files in os.walk(out_dir):
                if "vocals.wav" in files:
                    demucs_out = root
                    break

            if not demucs_out:
                raise RuntimeError("Demucs produced no output. Check ffmpeg and audio format.")

            stems = {}
            for stem_name in ["vocals", "drums", "bass", "other"]:
                stem_path = os.path.join(demucs_out, f"{stem_name}.wav")
                if os.path.exists(stem_path):
                    remote_path = f"mastering/{job_id}/stems/{stem_name}.wav"
                    signed_url  = upload_to_supabase(stem_path, "processed", remote_path)
                    stems[stem_name] = signed_url

            return {
                "vocals": stems.get("vocals", ""),
                "bass":   stems.get("bass",   ""),
                "drums":  stems.get("drums",  ""),
                "other":  stems.get("other",  ""),
            }
        finally:
            os.unlink(audio_path)
            shutil.rmtree(out_dir, ignore_errors=True)

    # ── CLASSIFY STEMS ─────────────────────────────────────────────────────────

    def _classify_stems(self, stems_urls: dict) -> list:
        """
        Classify stems by frequency content.
        Returns list matching TypeScript ClassifiedStem[] interface.
        """
        results = []

        for url in stems_urls if isinstance(stems_urls, list) else list(stems_urls.values()):
            audio_path = download_audio(url)
            try:
                y, sr = librosa.load(audio_path, sr=None, mono=True)

                spec  = np.abs(librosa.stft(y))
                freqs = librosa.fft_frequencies(sr=sr)

                energy_sub  = float(spec[freqs < 80].mean())
                energy_low  = float(spec[(freqs >= 80)   & (freqs < 300)].mean())
                energy_mid  = float(spec[(freqs >= 300)  & (freqs < 4000)].mean())
                energy_high = float(spec[freqs >= 4000].mean())

                # Heuristic type detection
                if energy_sub > energy_mid * 1.5 and energy_sub > energy_high:
                    stem_type   = "bass"
                    confidence  = 0.85
                elif energy_high > energy_mid and energy_high > energy_sub * 2:
                    stem_type   = "drums"
                    confidence  = 0.75
                elif energy_mid > energy_high and energy_mid > energy_sub:
                    stem_type   = "vocals"
                    confidence  = 0.70
                else:
                    stem_type   = "other"
                    confidence  = 0.60

                meter    = pyln.Meter(sr)
                lufs_val = float(meter.integrated_loudness(y))
                peak_val = compute_true_peak(y)
                dr_val   = compute_dynamic_range(y, sr)
                centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
                freq_bal = compute_frequency_balance(y, sr)

                results.append({
                    "url":          url,
                    "detectedType": stem_type,
                    "confidence":   round(confidence, 2),
                    "analysis": {
                        "lufs":             round(lufs_val, 2),
                        "peak":             round(peak_val, 2),
                        "rms":              round(float(np.sqrt(np.mean(y ** 2))), 4),
                        "spectralCentroid": round(centroid, 2),
                        "frequencyBalance": freq_bal,
                        "dynamicRange":     round(dr_val, 2),
                    }
                })
            finally:
                os.unlink(audio_path)

        return results

    # ── MIX ────────────────────────────────────────────────────────────────────

    def _mix(self, stems_urls: dict, mix_params: dict, job_id: str) -> dict:
        """
        Apply per-stem Pedalboard processing chains and mix to stereo.
        mix_params.chains: list of StemProcessingChain from Claude decisions layer.
        Falls back to sensible defaults per stem type if chains are not provided.
        """

        def build_chain_from_params(chain_params: dict):
            """Convert Claude's StemProcessingChain dict to a Pedalboard."""
            board = []

            eq = chain_params.get("eq", [])
            for band in eq:
                freq = band.get("freq", 1000)
                gain = band.get("gain", 0)
                q    = band.get("q", 1.0)
                t    = band.get("type", "")
                if gain == 0:
                    continue
                if t == "lowshelf":
                    board.append(LowShelfFilter(cutoff_frequency_hz=freq, gain_db=gain))
                elif t == "highshelf":
                    board.append(HighShelfFilter(cutoff_frequency_hz=freq, gain_db=gain))
                else:
                    board.append(PeakFilter(cutoff_frequency_hz=freq, gain_db=gain, q=q))

            comp = chain_params.get("compression")
            if comp:
                board.append(Compressor(
                    threshold_db=comp.get("threshold", -18),
                    ratio=comp.get("ratio", 3),
                    attack_ms=comp.get("attack", 10),
                    release_ms=comp.get("release", 100),
                ))

            gain_db = chain_params.get("gain", 0)
            if gain_db != 0:
                board.append(Gain(gain_db=gain_db))

            board.append(Limiter(threshold_db=-0.5))
            return Pedalboard(board)

        default_chains = {
            "vocals": Pedalboard([
                PeakFilter(cutoff_frequency_hz=3000, gain_db=2, q=1.0),
                Compressor(threshold_db=-18, ratio=3, attack_ms=10, release_ms=100),
                Limiter(threshold_db=-0.5),
            ]),
            "bass": Pedalboard([
                LowShelfFilter(cutoff_frequency_hz=80, gain_db=3),
                Compressor(threshold_db=-15, ratio=4, attack_ms=5, release_ms=50),
                Limiter(threshold_db=-0.5),
            ]),
            "drums": Pedalboard([
                PeakFilter(cutoff_frequency_hz=100, gain_db=2, q=1.5),
                PeakFilter(cutoff_frequency_hz=5000, gain_db=1.5, q=1.0),
                Compressor(threshold_db=-12, ratio=4, attack_ms=2, release_ms=30),
                Limiter(threshold_db=-0.5),
            ]),
            "other": Pedalboard([
                Compressor(threshold_db=-20, ratio=2, attack_ms=15, release_ms=150),
                Limiter(threshold_db=-0.5),
            ]),
        }

        # Build chain lookup: stemUrl → Pedalboard
        chain_by_url = {}
        for chain_params in mix_params.get("chains", []):
            url    = chain_params.get("stemUrl", "")
            stype  = chain_params.get("stemType", "other")
            board  = build_chain_from_params(chain_params)
            chain_by_url[url] = board

        mixed    = None
        sr_out   = None
        tmp_files = []

        urls = stems_urls if isinstance(stems_urls, list) else list(stems_urls.values())

        for url in urls:
            audio_path = download_audio(url)
            tmp_files.append(audio_path)
            y, sr = librosa.load(audio_path, sr=None, mono=False)
            sr_out = sr

            if y.ndim == 1:
                y = np.stack([y, y])

            chain = chain_by_url.get(url, default_chains["other"])
            processed = chain(y.astype(np.float32), sr)

            if mixed is None:
                mixed = processed
            else:
                min_len = min(mixed.shape[1], processed.shape[1])
                mixed   = mixed[:, :min_len] + processed[:, :min_len]

        for f in tmp_files:
            try:
                os.unlink(f)
            except Exception:
                pass

        # Normalize and prevent clipping
        peak = float(np.max(np.abs(mixed)))
        if peak > 0:
            mixed = mixed / peak * 0.95

        out_path    = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        sf.write(out_path, mixed.T, sr_out)

        remote_path = f"mastering/{job_id}/mixed.wav"
        signed_url  = upload_to_supabase(out_path, "processed", remote_path)
        os.unlink(out_path)

        return {
            "mixdownUrl":           signed_url,
            "perStemProcessedUrls": [],  # simplified — individual stems not re-uploaded
        }

    # ── MASTER ─────────────────────────────────────────────────────────────────

    def _master(self, audio_url: str, reference_url: str, master_params: dict, job_id: str) -> dict:
        """
        Produce 4 mastered versions (Clean, Warm, Punch, Loud).
        Uses Matchering for reference-based mastering when reference_url is provided.
        Falls back to pyloudnorm normalization when no reference.
        """
        input_path = download_audio(audio_url)
        out_dir    = tempfile.mkdtemp()

        try:
            # ── Step 1: Produce Clean baseline ───────────────────────────────
            clean_path = os.path.join(out_dir, "clean.wav")

            if reference_url:
                ref_path = download_audio(reference_url)
                try:
                    mg.process(
                        target=input_path,
                        reference=ref_path,
                        results=[mg.pcm16(clean_path)]
                    )
                finally:
                    os.unlink(ref_path)
            else:
                # Normalize to -14 LUFS (Spotify target)
                y, sr = librosa.load(input_path, sr=None, mono=False)
                if y.ndim == 1:
                    y = np.stack([y, y])
                meter      = pyln.Meter(sr)
                current    = float(meter.integrated_loudness(y[0]))
                target     = master_params.get("limiterThreshold", -14.0)
                if isinstance(target, (int, float)) and target < 0:
                    gain_db = target - current
                else:
                    gain_db = -14.0 - current
                y_norm = y * (10 ** (gain_db / 20))
                y_norm = np.clip(y_norm, -1.0, 1.0)
                sf.write(clean_path, y_norm.T, sr)

            # ── Step 2: Load clean baseline ───────────────────────────────────
            y_clean, sr = librosa.load(clean_path, sr=None, mono=False)
            if y_clean.ndim == 1:
                y_clean = np.stack([y_clean, y_clean])
            y_clean = y_clean.astype(np.float32)

            # ── Step 3: Build 4 versions via Pedalboard ───────────────────────
            version_boards = {
                "Clean": Pedalboard([Limiter(threshold_db=-0.5)]),
                "Warm": Pedalboard([
                    LowShelfFilter(cutoff_frequency_hz=200, gain_db=2.5),
                    HighShelfFilter(cutoff_frequency_hz=8000, gain_db=-1.5),
                    Compressor(threshold_db=-16, ratio=2, attack_ms=20, release_ms=200),
                    Limiter(threshold_db=-0.5),
                ]),
                "Punch": Pedalboard([
                    PeakFilter(cutoff_frequency_hz=2500, gain_db=3, q=1.2),
                    LowShelfFilter(cutoff_frequency_hz=60, gain_db=2),
                    Compressor(threshold_db=-12, ratio=4, attack_ms=5, release_ms=60),
                    Limiter(threshold_db=-0.3),
                ]),
                "Loud": Pedalboard([
                    Compressor(threshold_db=-8, ratio=6, attack_ms=2, release_ms=30),
                    Gain(gain_db=4),
                    Limiter(threshold_db=-0.1),
                ]),
            }

            versions_result = []
            meter           = pyln.Meter(sr)

            for name, board in version_boards.items():
                y_out    = board(y_clean, sr)
                out_path = os.path.join(out_dir, f"{name.lower()}.wav")
                sf.write(out_path, y_out.T, sr)

                final_lufs = float(meter.integrated_loudness(y_out[0]))
                true_peak  = compute_true_peak(y_out[0])

                # Waveform data — 200-point downsampled peak array for WaveSurfer
                hop       = max(1, y_out.shape[1] // 200)
                peaks     = [float(np.max(np.abs(y_out[:, i:i+hop]))) for i in range(0, y_out.shape[1], hop)]
                peaks     = peaks[:200]

                remote_path = f"mastering/{job_id}/master_{name.lower()}.wav"
                signed_url  = upload_to_supabase(out_path, "processed", remote_path)

                versions_result.append({
                    "name":         name,
                    "lufs":         round(final_lufs, 2),
                    "truePeak":     round(true_peak, 2),
                    "url":          signed_url,
                    "waveformData": peaks,
                })

            # ── Step 4: Platform exports (MP3 + loudness-normalized WAVs) ─────
            platform_targets = {
                "spotify":      -14.0,
                "apple_music":  -16.0,
                "youtube":      -14.0,
                "wav_master":   -10.0,
            }

            platforms_param = master_params.get("platforms", list(platform_targets.keys()))
            exports_result  = []

            for platform in platforms_param:
                target_lufs = platform_targets.get(platform, -14.0)
                current_lufs = float(meter.integrated_loudness(y_clean[0]))
                gain_db      = target_lufs - current_lufs
                y_export     = y_clean * (10 ** (gain_db / 20))
                y_export     = np.clip(y_export, -1.0, 1.0)

                ext          = "mp3" if platform != "wav_master" else "wav"
                out_path     = os.path.join(out_dir, f"export_{platform}.{ext}")
                sf.write(out_path, y_export.T, sr)

                remote_path  = f"mastering/{job_id}/export_{platform}.{ext}"
                signed_url   = upload_to_supabase(out_path, "processed", remote_path)

                exports_result.append({
                    "platform": platform,
                    "lufs":     round(target_lufs, 2),
                    "format":   ext,
                    "url":      signed_url,
                })

            # ── Step 5: Analysis report ───────────────────────────────────────
            clean_lufs  = versions_result[0]["lufs"] if versions_result else -14.0
            clean_peak  = versions_result[0]["truePeak"] if versions_result else -1.0
            dyn_range   = compute_dynamic_range(y_clean[0], sr)

            platform_penalties = []
            for platform, target in platform_targets.items():
                penalty = max(0.0, clean_lufs - target)
                platform_penalties.append({
                    "platform": platform,
                    "penalty":  round(penalty, 2),
                })

            report = {
                "finalLufs":         clean_lufs,
                "truePeak":          clean_peak,
                "dynamicRange":      round(dyn_range, 2),
                "loudnessPenalties": platform_penalties,
            }

            return {
                "versions": versions_result,
                "exports":  exports_result,
                "report":   report,
            }

        finally:
            os.unlink(input_path)
            shutil.rmtree(out_dir, ignore_errors=True)

    # ── PREVIEW ────────────────────────────────────────────────────────────────

    def _preview(self, audio_url: str, job_id: str) -> dict:
        """Extract the 30-second highest-energy section with fade in/out."""
        audio_path = download_audio(audio_url)
        try:
            y, sr = librosa.load(audio_path, sr=None, mono=True)

            # RMS in 1-second windows
            hop = sr
            rms = librosa.feature.rms(y=y, hop_length=hop)[0]

            window_frames = 30
            if len(rms) <= window_frames:
                preview    = y
                start_sec  = 0.0
            else:
                best_start = 0
                best_score = 0.0
                for i in range(len(rms) - window_frames):
                    score = float(np.mean(rms[i:i + window_frames]))
                    if score > best_score:
                        best_score = score
                        best_start = i

                start_sample = best_start * hop
                end_sample   = min(start_sample + (30 * sr), len(y))
                preview      = y[start_sample:end_sample]
                start_sec    = float(best_start)

            # 0.5s fade in/out
            fade_samples = int(0.5 * sr)
            if len(preview) > fade_samples * 2:
                preview[:fade_samples]  *= np.linspace(0, 1, fade_samples)
                preview[-fade_samples:] *= np.linspace(1, 0, fade_samples)

            out_path    = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            sf.write(out_path, preview, sr)

            remote_path = f"mastering/{job_id}/preview.wav"
            signed_url  = upload_to_supabase(out_path, "processed", remote_path)
            os.unlink(out_path)

            return {
                "previewUrl": signed_url,
                "startSec":   round(start_sec, 2),
                "endSec":     round(start_sec + 30.0, 2),
            }
        finally:
            os.unlink(audio_path)
