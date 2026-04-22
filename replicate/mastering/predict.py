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
    LowShelfFilter, HighShelfFilter, HighpassFilter, LowpassFilter, PeakFilter
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


# ---------- Helper: noise gate ----------
def apply_noise_gate(y, sr, threshold_db=-40, hold_ms=50, release_ms=100):
    """Simple noise gate — zero out samples below threshold."""
    threshold_lin = 10 ** (threshold_db / 20)
    hold_samples = int((hold_ms / 1000) * sr)
    release_samples = int((release_ms / 1000) * sr)
    gate = np.abs(y) >= threshold_lin
    # Extend gate by hold samples
    from scipy.ndimage import binary_dilation
    gate = binary_dilation(gate, iterations=hold_samples)
    y_gated = y.copy()
    y_gated[~gate] = 0
    return y_gated


# ---------- Helper: section detection from energy ----------
def detect_sections_from_energy(y, sr, min_duration=4.0):
    """Detect approximate song sections from RMS energy contour."""
    hop = int(sr * 0.5)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)

    # Smooth energy
    from scipy.signal import savgol_filter
    rms_smooth = savgol_filter(rms, window_length=min(21, len(rms)//2*2+1), polyorder=2)

    # Find local minima (section boundaries)
    from scipy.signal import find_peaks
    inv_rms = -rms_smooth
    peaks, _ = find_peaks(inv_rms, distance=int(min_duration / 0.5))

    boundaries = [0.0] + [float(times[p]) for p in peaks] + [float(len(y) / sr)]

    # Label sections heuristically: low energy = verse, high energy = chorus
    sections = []
    section_labels = ["intro", "verse1", "chorus1", "verse2", "chorus2", "bridge", "chorus3", "outro"]
    for i, (start, end) in enumerate(zip(boundaries[:-1], boundaries[1:])):
        label = section_labels[i] if i < len(section_labels) else f"section{i+1}"
        sections.append({"name": label, "start": round(start, 2), "end": round(end, 2)})

    return sections


# ─── Chain matrix helpers ─────────────────────────────────────────────────────

def normalize_input_lufs(audio, sr, target_lufs=-23.0):
    """Normalize audio to target LUFS (integrated loudness). Input gain staging."""
    try:
        meter = pyln.Meter(sr)
        # pyloudnorm expects (samples, channels) for stereo
        if audio.ndim == 2:
            audio_in = audio.T
        else:
            audio_in = audio
        loudness = meter.integrated_loudness(audio_in)
        if loudness == float('-inf') or np.isnan(loudness):
            return audio  # can't measure — return as-is
        # pyln works on (samples, channels)
        normalized = pyln.normalize.loudness(audio_in, loudness, target_lufs)
        if audio.ndim == 2:
            return normalized.T
        return normalized
    except Exception:
        return audio


def detect_sibilance_freq(audio_mono, sr):
    """Detect dominant sibilant frequency band per vocalist (male vs female)."""
    try:
        # High-freq RMS in two candidate bands
        freqs = np.fft.rfftfreq(2048, d=1.0 / sr)
        S = np.abs(librosa.stft(audio_mono, n_fft=2048))
        # Band energies
        low_sib  = np.mean(S[(freqs >= 4000) & (freqs <= 7000), :])
        high_sib = np.mean(S[(freqs >= 8000) & (freqs <= 12000), :])
        if high_sib > low_sib * 1.3:
            return 10000  # female/bright voice
        return 5500       # male/darker voice
    except Exception:
        return 6000


def apply_telephone_filter(audio, sr, low_hz=300, high_hz=3000):
    """Bandpass filter for telephone/lo-fi ad-lib effect."""
    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=low_hz),
        LowpassFilter(cutoff_frequency_hz=high_hz),
    ])
    return board(audio, sr)


def apply_parallel_saturation(audio, sr, wet=0.08):
    """Parallel saturation — blend dry + driven signal."""
    if wet <= 0:
        return audio
    from pedalboard import Distortion
    dry = audio.copy()
    driven = Pedalboard([Distortion(drive_db=wet * 30)])(audio.copy(), sr)
    return dry * (1.0 - wet) + driven * wet


def apply_detune_cents(audio_mono, sr, cents):
    """Pitch shift by N cents — pyrubberband primary, librosa fallback."""
    if cents == 0:
        return audio_mono
    try:
        import pyrubberband as pyrb
        return pyrb.pitch_shift(audio_mono.astype(np.float32), sr, cents / 100.0)
    except Exception:
        try:
            return librosa.effects.pitch_shift(audio_mono.astype(np.float32), sr=sr, n_steps=cents / 100.0)
        except Exception:
            return audio_mono


def apply_de_reverb(audio_stereo, sr, strength=0.6):
    """
    Spectral de-reverb using noisereduce.
    strength: 0–1 (proportion of noise reduction to apply).
    Works on stereo — processes L and R independently.
    """
    try:
        import noisereduce as nr
        out = audio_stereo.copy()
        for ch in range(audio_stereo.shape[0]):
            out[ch] = nr.reduce_noise(
                y=audio_stereo[ch].astype(np.float32),
                sr=sr,
                stationary=False,
                prop_decrease=float(np.clip(strength, 0.1, 0.95)),
                time_mask_smooth_ms=100,
                freq_mask_smooth_hz=500,
            ).astype(np.float32)
        return out
    except Exception as e:
        print(f"de_reverb failed: {e}", flush=True)
        return audio_stereo


def apply_pitch_correction(audio_mono, sr, strength=0.5):
    """
    Snap pitch toward nearest semitone using pyworld vocoder.
    strength 0.0 = no correction, 1.0 = hard snap.
    Returns mono float32 array same length as input.
    """
    try:
        import pyworld as pw
        y64 = audio_mono.astype(np.float64)
        _f0, t = pw.dio(y64, sr, f0_floor=60.0, f0_ceil=800.0)
        f0    = pw.stonemask(y64, _f0, t, sr)
        sp    = pw.cheaptrick(y64, f0, t, sr)
        ap    = pw.d4c(y64, f0, t, sr)

        voiced = f0 > 50
        f0_corrected = f0.copy()
        if np.any(voiced):
            # Convert voiced frames to MIDI, round to nearest semitone, convert back
            midi            = 12 * np.log2(np.maximum(f0[voiced], 1e-6) / 440.0) + 69
            midi_quantized  = np.round(midi)
            f0_quantized    = 440.0 * (2.0 ** ((midi_quantized - 69) / 12.0))
            f0_corrected[voiced] = (
                f0[voiced] * (1.0 - strength) + f0_quantized * strength
            )

        y_out = pw.synthesize(f0_corrected, sp, ap, float(sr)).astype(np.float32)
        # Preserve original length
        tgt_len = len(audio_mono)
        if len(y_out) >= tgt_len:
            return y_out[:tgt_len]
        return np.pad(y_out, (0, tgt_len - len(y_out)))
    except Exception as e:
        print(f"pitch_correction failed: {e}", flush=True)
        return audio_mono


def apply_delay_throw(audio_stereo, sr, start_s, end_s, bpm, throw_type="dotted_eighth", feedback_count=3, wet=0.35):
    """
    Apply a synced delay throw to a word region [start_s, end_s].
    The delayed repeats ring out after end_s, attenuating with each repeat.
    bpm is used to calculate musically synced delay time.
    """
    if audio_stereo.ndim != 2:
        return audio_stereo

    beat_s = 60.0 / max(float(bpm), 60.0)
    if throw_type == "dotted_eighth":
        delay_s = beat_s * 0.75
    elif throw_type == "quarter":
        delay_s = beat_s
    elif throw_type == "half":
        delay_s = beat_s * 2.0
    else:
        delay_s = beat_s * 0.75

    delay_samples = int(delay_s * sr)
    start_sample  = int(start_s * sr)
    end_sample    = min(int(end_s * sr), audio_stereo.shape[1])

    if delay_samples <= 0 or start_sample >= audio_stereo.shape[1]:
        return audio_stereo

    output = audio_stereo.copy().astype(np.float64)
    region = audio_stereo[:, start_sample:end_sample].astype(np.float64)
    reg_len = region.shape[1]

    for repeat in range(1, min(feedback_count + 1, 6)):
        offset   = start_sample + repeat * delay_samples
        if offset >= output.shape[1]:
            break
        gain     = (0.55 ** repeat) * wet
        end_pos  = min(offset + reg_len, output.shape[1])
        seg_len  = end_pos - offset
        output[:, offset:end_pos] += region[:, :seg_len] * gain

    return np.clip(output, -1.0, 1.0).astype(np.float32)


def apply_transient_shaper(audio_stereo, sr, attack_boost_db=3.0, sustain_cut_db=-2.0):
    """
    Transient shaper: boosts attack transients and optionally cuts sustain.
    Uses dual envelope follower (fast vs. slow) to detect transients.
    """
    try:
        y_mono = (audio_stereo[0] + audio_stereo[1]) / 2 if audio_stereo.ndim > 1 else audio_stereo
        abs_y  = np.abs(y_mono)
        n      = len(abs_y)

        fast_a = float(np.exp(-1.0 / (sr * 0.001)))   # 1 ms attack
        fast_r = float(np.exp(-1.0 / (sr * 0.050)))   # 50 ms release
        slow_a = float(np.exp(-1.0 / (sr * 0.050)))   # 50 ms attack
        slow_r = float(np.exp(-1.0 / (sr * 0.500)))   # 500 ms release

        fast_env = np.zeros(n, dtype=np.float32)
        slow_env = np.zeros(n, dtype=np.float32)

        for i in range(1, n):
            c = abs_y[i]
            fast_env[i] = fast_a * fast_env[i-1] + (1 - fast_a) * c if c > fast_env[i-1] else fast_r * fast_env[i-1]
            slow_env[i] = slow_a * slow_env[i-1] + (1 - slow_a) * c if c > slow_env[i-1] else slow_r * slow_env[i-1]

        transient      = np.clip(fast_env - slow_env, 0, None)
        peak_t         = np.max(transient)
        transient_norm = transient / peak_t if peak_t > 1e-6 else transient

        attack_lin  = 10 ** (attack_boost_db  / 20)
        sustain_lin = 10 ** (sustain_cut_db   / 20)
        gain        = sustain_lin + (attack_lin - sustain_lin) * transient_norm

        if audio_stereo.ndim > 1:
            return audio_stereo * gain[np.newaxis, :]
        return audio_stereo * gain
    except Exception as e:
        print(f"transient_shaper failed: {e}", flush=True)
        return audio_stereo


def apply_multiband_compressor(audio_stereo, sr):
    """
    4-band compressor: sub (<120 Hz), low-mid (120–500 Hz),
    mid-high (500–3 kHz), air (>3 kHz).
    Gentle default settings — glues without pumping.
    """
    try:
        audio_f = audio_stereo.astype(np.float32)
        crossovers = [120, 500, 3000]

        # Split into 4 bands
        b_sub  = Pedalboard([LowpassFilter(cutoff_frequency_hz=120)])(audio_f.copy(), sr)
        b_low  = Pedalboard([HighpassFilter(cutoff_frequency_hz=120),
                             LowpassFilter(cutoff_frequency_hz=500)])(audio_f.copy(), sr)
        b_mid  = Pedalboard([HighpassFilter(cutoff_frequency_hz=500),
                             LowpassFilter(cutoff_frequency_hz=3000)])(audio_f.copy(), sr)
        b_air  = Pedalboard([HighpassFilter(cutoff_frequency_hz=3000)])(audio_f.copy(), sr)

        band_configs = [
            # (band_signal, threshold, ratio, attack, release)
            (b_sub,  -20, 3.0,  10, 150),
            (b_low,  -18, 2.5,  15, 200),
            (b_mid,  -20, 2.0,  20, 250),
            (b_air,  -24, 2.0,  10, 100),
        ]

        result = None
        for band_sig, thresh, ratio, atk, rel in band_configs:
            comp_board = Pedalboard([
                Compressor(threshold_db=thresh, ratio=ratio, attack_ms=atk, release_ms=rel)
            ])
            compressed = comp_board(band_sig, sr)
            result = compressed if result is None else result + compressed

        return result if result is not None else audio_stereo
    except Exception as e:
        print(f"multiband_compressor failed: {e}", flush=True)
        return audio_stereo


# Genre + role chain matrix
CHAIN_MATRIX = {
    "HIP_HOP": {
        "lead":      {"hp": 80,  "comp1_ratio": 4.0,  "comp2_ratio": 2.5, "sat": 0.03, "reverb_wet": 0.15, "reverb_room": 0.3, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 300, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.10, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -6.0, "telephone": True,  "blend_db": -6.0,  "tp_low": 300,  "tp_high": 3000},
        "insouts":   {"hp": 200, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.04, "reverb_wet": 0.12, "reverb_room": 0.2, "pan": 0.15, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "eq_tilt_low_cut": -3.0, "eq_tilt_high_cut": -2.0},
        "double":    {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.20, "reverb_room": 0.3, "pan": 0.35, "detune": 12, "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "harmony":   {"hp": 120, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.25, "reverb_room": 0.5, "pan": 0.5,  "detune": 8,  "gain_db": -7.0, "telephone": False, "blend_db": -7.0},
    },
    "TRAP": {
        "lead":      {"hp": 80,  "comp1_ratio": 4.0,  "comp2_ratio": 2.5, "sat": 0.04, "reverb_wet": 0.15, "reverb_room": 0.25,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 300, "comp1_ratio": 6.0,  "comp2_ratio": 0.0, "sat": 0.12, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -6.0, "telephone": True,  "blend_db": -6.0,  "tp_low": 300,  "tp_high": 3000},
        "insouts":   {"hp": 200, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.05, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.15, "detune": 0,  "gain_db": -7.0, "telephone": False, "blend_db": -7.0,  "eq_tilt_low_cut": -3.0, "eq_tilt_high_cut": -2.0},
        "double":    {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.20, "reverb_room": 0.25,"pan": 0.35, "detune": 12, "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "harmony":   {"hp": 120, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.20, "reverb_room": 0.45,"pan": 0.5,  "detune": 8,  "gain_db": -7.0, "telephone": False, "blend_db": -7.0},
    },
    "RNB": {
        "lead":      {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.20, "reverb_room": 0.6, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.25, "reverb_room": 0.7, "pan": 0.15, "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "insouts":   {"hp": 150, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.18, "reverb_room": 0.5, "pan": 0.15, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0},
        "double":    {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.22, "reverb_room": 0.6, "pan": 0.25, "detune": 7,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.30, "reverb_room": 0.7, "pan": 0.45, "detune": 5,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
    },
    "POP": {
        "lead":      {"hp": 80,  "comp1_ratio": 4.0,  "comp2_ratio": 2.0, "sat": 0.03, "reverb_wet": 0.18, "reverb_room": 0.45,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 120, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.18, "reverb_room": 0.45,"pan": 0.2,  "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "insouts":   {"hp": 150, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.15, "reverb_room": 0.4, "pan": 0.15, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0},
        "double":    {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.20, "reverb_room": 0.45,"pan": 0.30, "detune": 10, "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 100, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.30, "reverb_room": 0.65,"pan": 0.45, "detune": 5,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
    },
    "ROCK": {
        "lead":      {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.07, "reverb_wet": 0.12, "reverb_room": 0.25,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 150, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.10, "reverb_wet": 0.08, "reverb_room": 0.2, "pan": 0.30, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0},
        "insouts":   {"hp": 150, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.07, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -7.0, "telephone": False, "blend_db": -7.0},
        "double":    {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.06, "reverb_wet": 0.12, "reverb_room": 0.25,"pan": 0.40, "detune": 15, "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 120, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.06, "reverb_wet": 0.20, "reverb_room": 0.45,"pan": 0.50, "detune": 8,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
    },
    "ELECTRONIC": {
        "lead":      {"hp": 100, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.25, "reverb_room": 0.8, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 200, "comp1_ratio": 6.0,  "comp2_ratio": 0.0, "sat": 0.12, "reverb_wet": 0.30, "reverb_room": 0.85,"pan": 0.40, "detune": 0,  "gain_db": -6.0, "telephone": True,  "blend_db": -6.0,  "tp_low": 500,  "tp_high": 4000},
        "insouts":   {"hp": 200, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.08, "reverb_wet": 0.22, "reverb_room": 0.7, "pan": 0.25, "detune": 0,  "gain_db": -6.0, "telephone": True,  "blend_db": -6.0,  "tp_low": 500,  "tp_high": 4000},
        "double":    {"hp": 120, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.05, "reverb_wet": 0.25, "reverb_room": 0.8, "pan": 0.30, "detune": 15, "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "harmony":   {"hp": 120, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.35, "reverb_room": 0.9, "pan": 0.50, "detune": 5,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0},
    },
    "ACOUSTIC": {
        "lead":      {"hp": 80,  "comp1_ratio": 2.0,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.12, "reverb_room": 0.35,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 100, "comp1_ratio": 2.5,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.15, "reverb_room": 0.35,"pan": 0.2,  "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "insouts":   {"hp": 100, "comp1_ratio": 2.5,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.12, "reverb_room": 0.3, "pan": 0.15, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0},
        "double":    {"hp": 80,  "comp1_ratio": 2.5,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.15, "reverb_room": 0.35,"pan": 0.30, "detune": 5,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "harmony":   {"hp": 80,  "comp1_ratio": 2.5,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.15, "reverb_room": 0.35,"pan": 0.30, "detune": 5,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
    },
    "LO_FI": {
        "lead":      {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.06, "reverb_wet": 0.15, "reverb_room": 0.4, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 200, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.10, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.25, "detune": 0,  "gain_db": -6.0, "telephone": True,  "blend_db": -6.0,  "tp_low": 400,  "tp_high": 2500},
        "insouts":   {"hp": 200, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.07, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -7.0, "telephone": True,  "blend_db": -7.0,  "tp_low": 400,  "tp_high": 2500},
        "double":    {"hp": 120, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.05, "reverb_wet": 0.15, "reverb_room": 0.4, "pan": 0.20, "detune": 10, "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 120, "comp1_ratio": 3.5,  "comp2_ratio": 0.0, "sat": 0.04, "reverb_wet": 0.18, "reverb_room": 0.4, "pan": 0.35, "detune": 7,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
    },
    "AFROBEATS": {
        "lead":      {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.15, "reverb_room": 0.3, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 120, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.0,  "reverb_wet": 0.10, "reverb_room": 0.25,"pan": 0.25, "detune": 0,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "insouts":   {"hp": 150, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.10, "reverb_room": 0.25,"pan": 0.2,  "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "double":    {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.01, "reverb_wet": 0.15, "reverb_room": 0.3, "pan": 0.20, "detune": 8,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.25, "reverb_room": 0.55,"pan": 0.40, "detune": 6,  "gain_db": -3.5, "telephone": False, "blend_db": -3.5},
        "chants":    {"hp": 150, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.05, "reverb_wet": 0.20, "reverb_room": 0.4, "pan": 0.50, "detune": 10, "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
    },
    "LATIN": {
        "lead":      {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.20, "reverb_room": 0.5, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 120, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.15, "reverb_room": 0.4, "pan": 0.20, "detune": 0,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "insouts":   {"hp": 150, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.12, "reverb_room": 0.35,"pan": 0.15, "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "double":    {"hp": 100, "comp1_ratio": 3.5,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.20, "reverb_room": 0.5, "pan": 0.25, "detune": 8,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.25, "reverb_room": 0.55,"pan": 0.40, "detune": 6,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
    },
    "GOSPEL": {
        "lead":      {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.25, "reverb_room": 0.75,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.28, "reverb_room": 0.75,"pan": 0.15, "detune": 0,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "insouts":   {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.22, "reverb_room": 0.65,"pan": 0.15, "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "double":    {"hp": 100, "comp1_ratio": 3.5,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.25, "reverb_room": 0.75,"pan": 0.30, "detune": 5,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.35, "reverb_room": 0.8, "pan": 0.50, "detune": 4,  "gain_db": -2.5, "telephone": False, "blend_db": -2.5},
    },
    "COUNTRY": {
        "lead":      {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.15, "reverb_room": 0.4, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.15, "reverb_room": 0.4, "pan": 0.20, "detune": 0,  "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "insouts":   {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.12, "reverb_room": 0.35,"pan": 0.15, "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "double":    {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.18, "reverb_room": 0.4, "pan": 0.30, "detune": 5,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
        "harmony":   {"hp": 80,  "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.18, "reverb_room": 0.4, "pan": 0.30, "detune": 5,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
    },
}


# Role label normalizer — map incoming labels to matrix keys
ROLE_MAP = {
    "vocal_main":      "lead",
    "vocal_adlibs":    "adlib",
    "vocal_insouts":   "insouts",
    "vocal_doubles":   "double",
    "vocal_harmonies": "harmony",
    "lead":            "lead",
    "adlib":           "adlib",
    "double":          "double",
    "harmony":         "harmony",
    "backing":         "harmony",
    "vocal":           "lead",   # legacy single-vocal label
    "chants":          "chants",
    "group_vocals":    "chants",
    "choir":           "chants",
}


def get_chain_params(genre, role_label, vocal_style_preset=None):
    """Look up chain params from matrix. Apply vocal style preset overrides."""
    genre_key = (genre or "HIP_HOP").upper().replace(" ", "_").replace("-", "_").replace("&", "").replace("B", "B")
    if genre_key == "RNB" or genre_key == "R_B":
        genre_key = "RNB"
    genre_chains = CHAIN_MATRIX.get(genre_key, CHAIN_MATRIX["HIP_HOP"])
    role_key = ROLE_MAP.get(role_label, "lead")
    chain = dict(genre_chains.get(role_key, genre_chains["lead"]))  # copy

    if not vocal_style_preset or vocal_style_preset.upper() in ("AUTO", "NONE", ""):
        return chain

    preset = vocal_style_preset.upper()

    if preset == "CLEAN_NATURAL":
        chain["comp1_ratio"] = max(1.5, chain["comp1_ratio"] - 1.0)
        chain["sat"] = 0.0
        chain["reverb_wet"] = chain["reverb_wet"] * 0.7
        chain["telephone"] = False

    elif preset == "LOFI_GRITTY":
        chain["sat"] = min(0.15, chain.get("sat", 0) + 0.05)
        if role_label in ("vocal_adlibs", "adlib"):
            chain["telephone"] = True
            chain["tp_low"]  = chain.get("tp_low",  300)
            chain["tp_high"] = chain.get("tp_high", 3000)

    elif preset == "AIRY_SPACIOUS":
        chain["reverb_wet"]  = min(0.5, chain["reverb_wet"] * 1.5)
        chain["reverb_room"] = min(0.9, chain["reverb_room"] + 0.2)
        chain["telephone"] = False

    elif preset == "RAW_UPFRONT":
        chain["reverb_wet"]  = chain["reverb_wet"] * 0.5
        chain["comp1_ratio"] = min(8.0, chain["comp1_ratio"] + 1.0)
        chain["pan"]         = chain["pan"] * 0.7

    return chain


# ---------- Main Predictor ----------
class Predictor(BasePredictor):

    def setup(self):
        print("Setup complete — no heavy models needed")

    def predict(
        self,
        action: str = Input(description="One of: analyze, classify-stems, mix, master, preview, health"),
        audio_url: str = Input(description="Signed URL to input audio", default=""),
        reference_url: str = Input(description="Signed URL to reference track for mastering", default=""),
        stems_json: str = Input(description="JSON string of stem name to URL mapping", default="{}"),
        job_id: str = Input(description="Unique job ID for organizing outputs", default=""),
        supabase_url: str = Input(description="Supabase project URL", default=""),
        supabase_service_key: str = Input(description="Supabase service role key", default=""),
        genre: str = Input(description="Genre for genre-aware processing (HIP_HOP, POP, RNB, ELECTRONIC, ROCK, INDIE, ACOUSTIC, JAZZ)", default=""),
        input_balance: str = Input(description="JSON string with input frequency balance {sub, low, mid, high}", default="{}"),
        mix_params_json: str = Input(description="JSON string of mix parameters from Claude decision", default="{}"),
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
            stems = json.loads(stems_json)
            result = self._classify_stems(stems)
        elif action == "mix":
            stems = json.loads(stems_json)
            result = self._mix(stems, job_id)
        elif action == "master":
            balance_data = json.loads(input_balance) if input_balance and input_balance != "{}" else {}
            result = self._master(audio_url, reference_url, job_id, genre=genre, input_balance=balance_data)
        elif action == "preview":
            result = self._preview(audio_url, job_id)
        elif action == "analyze-mix":
            result = self._analyze_mix(stems_json, job_id)
        elif action == "mix-full":
            result = self._mix_full(job_id, mix_params_json)
        elif action == "preview-mix":
            result = self._preview_mix(job_id)
        elif action == "revise-mix":
            result = self._revise_mix(job_id, mix_params_json)
        elif action == "separate-stems":
            result = self._separate_stems(audio_url, job_id)
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

        # Waveform — 200-point peak envelope of the full original track
        waveform = extract_waveform_from_array(y)

        os.unlink(audio_path)

        return {
            "bpm": bpm,
            "key": key,
            "lufs": float(loudness),
            "balance": balance,
            "beat_count": len(beat_times),
            "duration": float(len(y) / sr),
            "waveform": waveform,
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

        # ── Step 1: Noise floor reduction on the clean source ──────────────────
        # Runs before any mastering chain so the limiter doesn't amplify hiss.
        try:
            import noisereduce as nr
            y_clean_nr = np.stack([
                nr.reduce_noise(y=y_clean[0].astype(np.float32), sr=sr,
                                stationary=True, prop_decrease=0.7,
                                time_mask_smooth_ms=80, freq_mask_smooth_hz=300),
                nr.reduce_noise(y=y_clean[1].astype(np.float32), sr=sr,
                                stationary=True, prop_decrease=0.7,
                                time_mask_smooth_ms=80, freq_mask_smooth_hz=300),
            ]).astype(np.float32)
            y_clean = y_clean_nr
        except Exception as e:
            print(f"master noise_reduce skipped: {e}", flush=True)

        # ── Step 2: Multiband compression on clean source ───────────────────────
        # Applied once before the 4 version chains — each version inherits a
        # pre-controlled frequency spectrum.
        y_clean = apply_multiband_compressor(y_clean.astype(np.float32), sr)

        # ── Step 3: Transient shaper on clean source ────────────────────────────
        # Adds punch to drums without raising the overall level — makes the
        # difference between a flat master and one that hits.
        y_clean = apply_transient_shaper(y_clean.astype(np.float32), sr,
                                         attack_boost_db=2.0, sustain_cut_db=-1.0)

        write_wav(clean_path, y_clean, sr)  # rewrite clean as PCM_16
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

    # ---------- ANALYZE MIX ----------
    def _analyze_mix(self, stems_urls_json, job_id):
        import sys
        print("analyze-mix: starting", flush=True)
        sys.stdout.flush()

        stems_urls = json.loads(stems_urls_json) if stems_urls_json else []
        ANALYSIS_SR   = 22050   # sufficient for BPM/key/pitch — cuts RAM ~75%
        ANALYSIS_SECS = 30.0    # max 30s per stem on load — prevents OOM on 6-stem jobs

        # ── Per-stem analysis — load, analyze, delete immediately ─────────────
        stem_results = []
        mix_accum    = None

        for i, url in enumerate(stems_urls):
            print(f"analyze-mix: loading stem {i}", flush=True)
            audio_path = download_audio(url)
            try:
                y, sr = librosa.load(
                    audio_path,
                    sr=ANALYSIS_SR,
                    mono=True,
                    duration=ANALYSIS_SECS,
                    res_type="kaiser_fast",
                )
            except Exception:
                y, sr = np.zeros(ANALYSIS_SR), ANALYSIS_SR
            finally:
                os.unlink(audio_path)

            # Accumulate mono mix for global analysis
            if mix_accum is None:
                mix_accum = y.copy()
            else:
                min_len = min(len(mix_accum), len(y))
                mix_accum = mix_accum[:min_len] + y[:min_len]

            # Per-stem metrics
            meter = pyln.Meter(sr)
            try:
                lufs = float(meter.integrated_loudness(y))
                if not np.isfinite(lufs):
                    lufs = -99.0  # silent/near-silent stem
            except Exception:
                lufs = -99.0
            rms  = float(np.sqrt(np.mean(y ** 2)))
            spec  = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)
            balance = {
                "sub":  float(spec[freqs < 60].mean()),
                "low":  float(spec[(freqs >= 60)  & (freqs < 250)].mean()),
                "mid":  float(spec[(freqs >= 250) & (freqs < 2000)].mean()),
                "high": float(spec[freqs >= 2000].mean()),
            }
            stem_results.append({
                "label":   f"stem_{i}",
                "rms":     rms,
                "lufs":    lufs,
                "balance": balance,
            })

            del y, spec  # free immediately before next stem

        sr = ANALYSIS_SR
        mix = (mix_accum / max(len(stems_urls), 1)) if mix_accum is not None else np.zeros(sr)

        print("analyze-mix: running global analysis", flush=True)

        # BPM + key
        tempo, _ = librosa.beat.beat_track(y=mix, sr=sr)
        bpm = float(tempo) if not hasattr(tempo, "__len__") else float(tempo[0])
        chroma = librosa.feature.chroma_cqt(y=mix, sr=sr)
        key = estimate_key(chroma)

        # Sections from energy
        sections = detect_sections_from_energy(mix, sr)

        # Room reverb — simplified RT60 from RMS envelope decay
        room_reverb = 0.15
        try:
            rms_env = librosa.feature.rms(y=mix, hop_length=sr // 4)[0]
            if len(rms_env) > 4:
                peak_idx  = int(np.argmax(rms_env))
                if peak_idx + 4 < len(rms_env):
                    peak_val  = rms_env[peak_idx]
                    decay_val = rms_env[peak_idx + 4]
                    if peak_val > 0 and decay_val > 0:
                        rt60 = -60 / (20 * np.log10(decay_val / peak_val + 1e-10) * 4)
                        room_reverb = max(0.0, min(float(rt60), 2.0))
        except Exception:
            pass

        # Pitch deviation — pyin on the mix (already 30s at 22050 Hz, safe)
        try:
            f0, _, voiced = librosa.pyin(mix, fmin=80, fmax=1000)
            voiced_f0 = f0[voiced] if voiced is not None else np.array([])
            if len(voiced_f0) > 0:
                midi = librosa.hz_to_midi(voiced_f0[voiced_f0 > 0])
                pitch_deviation = float(np.mean(np.abs(midi - np.round(midi))))
            else:
                pitch_deviation = 0.0
        except Exception:
            pitch_deviation = 0.0

        # Vocal classification
        vocal_classification = []
        for i, st in enumerate(stem_results):
            bal = st["balance"]
            mid_ratio = bal["mid"] / (bal["sub"] + bal["low"] + bal["mid"] + bal["high"] + 1e-6)
            role = "lead" if mid_ratio > 0.4 else "other"
            confidence = min(mid_ratio * 2, 1.0)
            vocal_classification.append({
                "stem_index":  i,
                "role":        role,
                "confidence":  round(confidence, 2),
            })

        return {
            "bpm":                 bpm,
            "key":                 key,
            "sections":            sections,
            "stem_analysis":       stem_results,
            "vocal_classification": vocal_classification,
            "lyrics":              "",
            "word_timestamps":     [],
            "room_reverb":         round(room_reverb, 3),
            "pitch_deviation":     round(pitch_deviation, 3),
        }

    # ---------- SEPARATE STEMS (Beat Polish) ----------
    def _separate_stems(self, audio_url, job_id):
        """
        Separates a stereo beat/instrumental into drums, bass, other, and vocals
        using a simple frequency-band split (no ML model — keeps Cog image lean).
        Used only for Beat Polish add-on in VOCAL_BEAT mode.
        Returns { drums, bass, other } signed URLs uploaded to Supabase.
        """
        audio_path = download_audio(audio_url)
        y, sr = librosa.load(audio_path, sr=None, mono=False)
        os.unlink(audio_path)

        if y.ndim == 1:
            y = np.stack([y, y])

        def write_stem(audio_2d, name):
            path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            sf.write(path, audio_2d.T, sr, subtype="PCM_16")
            remote = f"mix-console/{job_id}/beat_{name}.wav"
            url = upload_to_supabase(path, "processed", remote)
            os.unlink(path)
            return url

        # Frequency-band stem separation via EQ carving
        from pedalboard import HighpassFilter, LowpassFilter

        # Bass: below 300Hz
        bass_board = Pedalboard([LowpassFilter(cutoff_frequency_hz=300)])
        y_bass = bass_board(y.astype(np.float32), sr)

        # Drums: mid-punch band (300Hz–5kHz), transient-heavy
        drums_board = Pedalboard([
            HighpassFilter(cutoff_frequency_hz=200),
            LowpassFilter(cutoff_frequency_hz=8000),
            Compressor(threshold_db=-12, ratio=4, attack_ms=1, release_ms=30),
        ])
        y_drums = drums_board(y.astype(np.float32), sr)

        # Other: everything else (melodics, pads, synths)
        other_board = Pedalboard([HighpassFilter(cutoff_frequency_hz=300)])
        y_other = other_board(y.astype(np.float32), sr)

        return {
            "bass":  write_stem(y_bass,  "bass"),
            "drums": write_stem(y_drums, "drums"),
            "other": write_stem(y_other, "other"),
        }

    # ---------- MIX FULL ----------
    def _mix_full(self, job_id, mix_params_json):
        """
        Full mixing engine.
        - Smart role-based gain staging (beat → -12 LUFS reference, main vocal → -18 LUFS)
        - Applies Claude's per-stem stemParams (EQ, comp thresholds, reverb) with chain
          matrix as fallback for any missing values
        - Beat gets vocal-pocket carve + light glue comp, not just a gain trim
        - Bus uses Claude's busParams when available
        """
        try:
            params = json.loads(mix_params_json) if mix_params_json else {}
        except Exception:
            params = {}

        genre              = params.get("genre", "HIP_HOP")
        vocal_style_preset = params.get("vocalStylePreset", "AUTO")
        stems_input        = params.get("stems_urls", {})     # {label: url}
        stem_params_map    = params.get("stemParams", {})     # Claude's per-stem decisions
        bus_params_ai      = params.get("busParams", {})      # Claude's bus decisions
        delay_throws       = params.get("delayThrows", [])    # Claude's delay throw list
        pitch_correction   = params.get("pitchCorrection", "OFF")   # OFF | SUBTLE | TIGHT | HARD
        room_reverb_rt60   = float(params.get("roomReverb", 0.0))   # RT60 from analysis
        bpm_global         = float(params.get("bpm", 120.0))        # for delay sync

        if not stems_input:
            return {"file_paths": {}, "waveforms": {}, "original_waveform": [], "preview_file_paths": {}, "applied_parameters": params}

        # ── Role → target LUFS offset relative to main vocal (-18 LUFS) ──────────
        BEAT_TARGET_LUFS       = -12.0   # beat is the loudest element — it's the foundation
        MAIN_VOCAL_TARGET_LUFS = -18.0   # main vocal sits 6 dB below beat
        SUPPORTING_LUFS_OFFSET = {       # offset from main vocal target
            "vocal_adlibs":   -6.0,
            "vocal_insouts":  -7.0,
            "vocal_doubles":  -4.0,
            "vocal_harmonies":-8.0,
            "adlib":          -6.0,
            "insouts":        -7.0,
            "double":         -4.0,
            "harmony":        -8.0,
            "backing":        -8.0,
        }

        def measure_lufs(y_stereo, sr):
            try:
                meter = pyln.Meter(sr)
                y_mono = (y_stereo[0] + y_stereo[1]) / 2 if y_stereo.ndim > 1 else y_stereo
                lufs = float(meter.integrated_loudness(y_mono))
                return lufs if np.isfinite(lufs) else -30.0
            except Exception:
                return -30.0

        def stage_gain(y, current_lufs, target_lufs):
            """Apply a fixed gain to reach target_lufs from current_lufs."""
            diff_db = target_lufs - current_lufs
            return y * (10 ** (diff_db / 20))

        def is_main_vocal(label):
            return label in ("vocal_main", "lead") or (
                label.startswith("vocal_") and
                not any(k in label for k in ("adlib", "double", "harmoni", "insout"))
            )

        # ── Step 1: load all stems + measure LUFS ────────────────────────────────
        loaded = {}   # label → (y_stereo float32, sr)
        lufs   = {}   # label → float

        for label, url in stems_input.items():
            audio_path = download_audio(url)
            y, sr = librosa.load(audio_path, sr=None, mono=False)
            os.unlink(audio_path)
            if y.ndim == 1:
                y = np.stack([y, y])
            loaded[label] = (y.astype(np.float32), sr)
            lufs[label]   = measure_lufs(y, sr)

        out_dir = tempfile.mkdtemp()
        mixed   = None
        sr_out  = None

        def apply_comp_inner(audio, ratio, thresh_db, attack_ms, release_ms, sr):
            if ratio <= 0:
                return audio
            board = Pedalboard([Compressor(
                threshold_db=thresh_db, ratio=ratio,
                attack_ms=attack_ms,   release_ms=release_ms,
            )])
            if ratio > 5.0:
                dry        = audio.copy()
                compressed = board(audio.copy(), sr)
                return dry * 0.5 + compressed * 0.5
            return board(audio, sr)

        try:
            for label, (y, sr) in loaded.items():
                sr_out = sr
                current_lufs = lufs[label]
                sp           = stem_params_map.get(label, {})   # Claude's params for this stem
                chain_p      = get_chain_params(genre, label, vocal_style_preset)

                # ── 1. Role-aware gain staging ────────────────────────────────────
                if label == "beat":
                    target_lufs_stem = BEAT_TARGET_LUFS
                elif is_main_vocal(label):
                    target_lufs_stem = MAIN_VOCAL_TARGET_LUFS
                else:
                    offset           = SUPPORTING_LUFS_OFFSET.get(label, -6.0)
                    target_lufs_stem = MAIN_VOCAL_TARGET_LUFS + offset

                y = stage_gain(y, current_lufs, target_lufs_stem)

                # ── 2. Per-stem processing ────────────────────────────────────────
                if label == "beat":
                    # Beat: HP + default vocal-pocket carve + Claude's EQ + light glue comp
                    beat_fx = [
                        HighpassFilter(cutoff_frequency_hz=30),
                        PeakFilter(cutoff_frequency_hz=2500, gain_db=-2.5, q=0.8),  # vocal pocket
                        PeakFilter(cutoff_frequency_hz=5000, gain_db=-1.0, q=1.0),  # presence carve
                    ]
                    # Apply Claude's EQ decisions for the beat (e.g. 250-500Hz mud cut)
                    beat_eq_points = sp.get("eq", [])
                    for ep in beat_eq_points:
                        t = ep.get("type", "peak")
                        f = float(ep.get("freq",   1000))
                        g = float(ep.get("gainDb", 0))
                        q = float(ep.get("q",      1.0))
                        if abs(g) < 0.1:
                            continue
                        if t == "peak":
                            beat_fx.append(PeakFilter(cutoff_frequency_hz=f, gain_db=g, q=q))
                        elif t == "highshelf":
                            beat_fx.append(HighShelfFilter(cutoff_frequency_hz=f, gain_db=g))
                        elif t == "lowshelf":
                            beat_fx.append(LowShelfFilter(cutoff_frequency_hz=f, gain_db=g))
                    beat_fx.append(Compressor(threshold_db=-18, ratio=2.0, attack_ms=30, release_ms=200))
                    beat_board = Pedalboard(beat_fx)
                    y_proc = beat_board(y, sr)

                    # Transient shaper on beat — tighten attack, pull back sustain slightly
                    y_proc = apply_transient_shaper(y_proc, sr, attack_boost_db=2.5, sustain_cut_db=-1.5)

                else:
                    # ── Vocal stem chain ──────────────────────────────────────────
                    # Merge Claude's params with chain matrix (Claude takes priority)
                    hp_hz    = float(sp.get("highpassHz",  chain_p.get("hp",          80)))
                    sat_wet  = float(sp.get("saturation",  chain_p.get("sat",         0.02)))
                    rev_wet  = float(sp.get("reverbSend",  chain_p.get("reverb_wet",  0.12)))
                    rev_room = float(chain_p.get("reverb_room", 0.35))
                    pan      = float(sp.get("panLR",       chain_p.get("pan",         0.0)))
                    detune   = float(chain_p.get("detune", 0))
                    do_tel   = bool(chain_p.get("telephone", False))
                    tp_low   = float(chain_p.get("tp_low",  300))
                    tp_high  = float(chain_p.get("tp_high", 3000))

                    # Gain fine-tune (on top of LUFS staging)
                    gain_fine = float(sp.get("gainDb", 0.0))

                    # Compression — Claude's comp1/comp2 override matrix ratios
                    c1           = sp.get("comp1", {})
                    c2           = sp.get("comp2", {})
                    comp1_thresh = float(c1.get("thresholdDb", -18))
                    comp1_ratio  = float(c1.get("ratio",       chain_p.get("comp1_ratio", 4.0)))
                    comp1_atk    = float(c1.get("attackMs",    2))
                    comp1_rel    = float(c1.get("releaseMs",   80))
                    comp2_ratio  = float(c2.get("ratio",       chain_p.get("comp2_ratio", 0.0)))

                    # a. Noise gate
                    y_mono_g  = (y[0] + y[1]) / 2
                    y_gated   = apply_noise_gate(y_mono_g, sr, threshold_db=-42)
                    diff      = y_gated - y_mono_g
                    y         = np.stack([y[0] + diff, y[1] + diff])

                    # b. De-esser
                    sib_freq     = detect_sibilance_freq((y[0] + y[1]) / 2, sr)
                    de_ess_board = Pedalboard([PeakFilter(
                        cutoff_frequency_hz=sib_freq, gain_db=-3.0, q=2.5)])
                    y = de_ess_board(y.astype(np.float32), sr)

                    # c. HP filter
                    hp_board = Pedalboard([HighpassFilter(
                        cutoff_frequency_hz=max(20, hp_hz))])
                    y = hp_board(y.astype(np.float32), sr)

                    # d. EQ from Claude stemParams
                    eq_points = sp.get("eq", [])
                    if eq_points:
                        eq_fx = []
                        for ep in eq_points:
                            t = ep.get("type", "peak")
                            f = float(ep.get("freq",   1000))
                            g = float(ep.get("gainDb", 0))
                            q = float(ep.get("q",      1.0))
                            if abs(g) < 0.1:
                                continue
                            if t == "peak":
                                eq_fx.append(PeakFilter(
                                    cutoff_frequency_hz=f, gain_db=g, q=q))
                            elif t == "highshelf":
                                eq_fx.append(HighShelfFilter(
                                    cutoff_frequency_hz=f, gain_db=g))
                            elif t == "lowshelf":
                                eq_fx.append(LowShelfFilter(
                                    cutoff_frequency_hz=f, gain_db=g))
                        if eq_fx:
                            eq_board = Pedalboard(eq_fx)
                            y = eq_board(y.astype(np.float32), sr)

                    # e. Telephone bandpass (ad-libs, ins/outs)
                    if do_tel:
                        y = apply_telephone_filter(y, sr, low_hz=tp_low, high_hz=tp_high)

                    # f. Compression
                    y = apply_comp_inner(y, comp1_ratio, comp1_thresh, comp1_atk, comp1_rel, sr)
                    if comp2_ratio > 0:
                        y = apply_comp_inner(y, comp2_ratio, -24, 15, 200, sr)

                    # g. Saturation
                    y = apply_parallel_saturation(y, sr, wet=sat_wet)

                    # h. Detune (doubles / harmonies)
                    if detune > 0 and y.ndim == 2:
                        y_left  = apply_detune_cents(y[0], sr, +detune)
                        y_right = apply_detune_cents(y[1], sr, -detune)
                        min_len = min(len(y_left), len(y_right))
                        y       = np.stack([y_left[:min_len], y_right[:min_len]])

                    # i. Pan
                    if pan != 0 and y.ndim == 2:
                        l_gain = max(0.0, 1.0 - pan) if pan > 0 else 1.0
                        r_gain = max(0.0, 1.0 + pan) if pan < 0 else 1.0
                        y[0]   = y[0] * l_gain
                        y[1]   = y[1] * r_gain

                    # j. Reverb
                    if rev_wet > 0:
                        from pedalboard import Reverb
                        rev_board = Pedalboard([Reverb(
                            room_size=rev_room, wet_level=rev_wet, dry_level=1.0)])
                        y = rev_board(y.astype(np.float32), sr)

                    # k. Fine-tune gain (role blend offset)
                    if gain_fine != 0:
                        y = y * (10 ** (gain_fine / 20))

                    # l. De-reverb — only on vocal stems when room reverb detected
                    if room_reverb_rt60 > 0.25:
                        # Scale strength 0.3–0.85 based on RT60 (0.25s → 0.3, 2.0s → 0.85)
                        dereverb_strength = float(np.clip(
                            0.3 + (room_reverb_rt60 - 0.25) / 2.0 * 0.55, 0.3, 0.85
                        ))
                        y = apply_de_reverb(y.astype(np.float32), sr, strength=dereverb_strength)

                    # m. Pitch correction — main vocal only
                    if pitch_correction != "OFF" and is_main_vocal(label):
                        strength_map = {"SUBTLE": 0.3, "TIGHT": 0.65, "HARD": 0.92}
                        pc_strength  = strength_map.get(pitch_correction.upper(), 0.3)
                        # Process each channel mono (pyworld is mono-only)
                        y_l = apply_pitch_correction(y[0], sr, strength=pc_strength)
                        y_r = apply_pitch_correction(y[1], sr, strength=pc_strength)
                        min_len = min(len(y_l), len(y_r), y.shape[1])
                        y = np.stack([y_l[:min_len], y_r[:min_len]])

                    # n. Delay throws — main vocal only, from Claude's analysis
                    if delay_throws and is_main_vocal(label):
                        for throw in delay_throws:
                            y = apply_delay_throw(
                                y.astype(np.float32), sr,
                                start_s=float(throw.get("start", 0)),
                                end_s=float(throw.get("end", 0.5)),
                                bpm=bpm_global,
                                throw_type=str(throw.get("type", "dotted_eighth")),
                                feedback_count=int(throw.get("feedback", 3)),
                                wet=0.35,
                            )

                    y_proc = y.astype(np.float64)

                # Sum into mix
                if mixed is None:
                    mixed = y_proc
                else:
                    min_len = min(mixed.shape[1], y_proc.shape[1])
                    mixed   = mixed[:, :min_len] + y_proc[:, :min_len]

            if mixed is None or sr_out is None:
                shutil.rmtree(out_dir, ignore_errors=True)
                return {"file_paths": {}, "waveforms": {}, "original_waveform": [], "preview_file_paths": {}, "applied_parameters": params}

            # ── Bus processing ────────────────────────────────────────────────────
            bus_low_shelf  = float(bus_params_ai.get("eqLowShelf",     0.5))
            bus_high_shelf = float(bus_params_ai.get("eqHighShelf",    1.0))
            bus_thresh     = float(bus_params_ai.get("glueCompThresh", -12))
            bus_ratio      = float(bus_params_ai.get("glueCompRatio",   2.0))
            bus_normalize  = float(bus_params_ai.get("peakNormalize",  -1.0))

            # Multiband compression first — tighten each frequency range independently
            mixed = apply_multiband_compressor(mixed.astype(np.float32), sr_out)

            # Then bus EQ + glue comp
            bus_board = Pedalboard([
                LowShelfFilter(cutoff_frequency_hz=100,  gain_db=bus_low_shelf),
                HighShelfFilter(cutoff_frequency_hz=8000, gain_db=bus_high_shelf),
                Compressor(threshold_db=bus_thresh, ratio=bus_ratio,
                           attack_ms=30, release_ms=200),
            ])
            mixed = bus_board(mixed.astype(np.float32), sr_out)

            # ── Clip guard + normalize to target peak ─────────────────────────────
            target_peak = 10 ** (bus_normalize / 20)
            cur_peak    = float(np.max(np.abs(mixed)))
            if cur_peak > 0:
                mixed = mixed / cur_peak * target_peak

            # ── Find best 30s preview window ──
            y_mono_mix = librosa.to_mono(mixed)
            hop_sz     = sr_out
            rms_env    = librosa.feature.rms(y=y_mono_mix, hop_length=hop_sz)[0]
            window_frames = 30
            best_f, best_v = 0, 0.0
            if len(rms_env) > window_frames:
                for fi in range(len(rms_env) - window_frames):
                    avg = float(np.mean(rms_env[fi: fi + window_frames]))
                    if avg > best_v:
                        best_v, best_f = avg, fi
            preview_start = best_f * hop_sz
            preview_end   = preview_start + (30 * sr_out)

            def make_clip(audio_2d, start, end, srate):
                end  = min(end, audio_2d.shape[1])
                clip = audio_2d[:, start:end].copy()
                fade = int(0.5 * srate)
                if clip.shape[1] > fade * 2:
                    clip[:, :fade]  *= np.linspace(0, 1, fade)
                    clip[:, -fade:] *= np.linspace(1, 0, fade)
                return clip

            # ── Generate 3 meaningfully different variations ──
            variation_configs = [
                ("clean",      "transparent"),
                ("polished",   "radio"),
                ("aggressive", "punchy"),
            ]
            file_paths    = {}
            waveforms     = {}
            preview_paths = {}

            for name, style in variation_configs:
                var_audio = mixed.copy().astype(np.float32)

                if style == "transparent":
                    # Clean: very light bus glue, -1 dB ceiling — closest to raw mix
                    var_board = Pedalboard([
                        Compressor(threshold_db=-16, ratio=1.5, attack_ms=30, release_ms=250),
                        Gain(gain_db=-1.0),
                        Limiter(threshold_db=-1.0),
                    ])
                elif style == "radio":
                    # Polished: glue comp + subtle warmth low shelf + air high shelf → radio-ready
                    var_board = Pedalboard([
                        LowShelfFilter(cutoff_frequency_hz=200,  gain_db=0.5),
                        HighShelfFilter(cutoff_frequency_hz=8000, gain_db=2.0),
                        Compressor(threshold_db=-12, ratio=2.5, attack_ms=20, release_ms=200),
                        Gain(gain_db=0.5),
                        Limiter(threshold_db=-0.5),
                    ])
                else:
                    # Aggressive: heavy parallel comp + mid presence + sub punch + louder
                    var_board = Pedalboard([
                        PeakFilter(cutoff_frequency_hz=2500, gain_db=2.5, q=1.2),
                        LowShelfFilter(cutoff_frequency_hz=80,  gain_db=1.0),
                        Compressor(threshold_db=-10, ratio=4.0, attack_ms=5,  release_ms=60),
                        Gain(gain_db=2.0),
                        Limiter(threshold_db=-0.2),
                    ])

                var_audio = var_board(var_audio, sr_out)

                # Clip guard
                vp = float(np.max(np.abs(var_audio)))
                if vp > 0.99:
                    var_audio = var_audio / vp * 0.99

                var_path = os.path.join(out_dir, f"mix_{name}.wav")
                sf.write(var_path, var_audio.T, sr_out, subtype="PCM_16")
                remote = f"mixing/{job_id}/mix_{name}.wav"
                upload_to_supabase(var_path, "processed", remote)
                file_paths[name] = remote
                os.unlink(var_path)

                clip = make_clip(var_audio, preview_start, preview_end, sr_out)
                clip_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
                sf.write(clip_tmp, clip.T, sr_out, subtype="PCM_16")
                prev_remote = f"mixing/{job_id}/preview_{name}.wav"
                upload_to_supabase(clip_tmp, "processed", prev_remote)
                preview_paths[name] = prev_remote
                clip_mono = clip[0] if clip.ndim > 1 else clip
                waveforms[name] = extract_waveform_from_array(clip_mono)
                os.unlink(clip_tmp)

            # ── Original waveform ──
            orig_clip = make_clip(mixed.astype(np.float32), preview_start, preview_end, sr_out)
            orig_mono = orig_clip[0] if orig_clip.ndim > 1 else orig_clip
            original_waveform = extract_waveform_from_array(orig_mono)
            orig_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            sf.write(orig_tmp, orig_clip.T, sr_out, subtype="PCM_16")
            orig_remote = f"mixing/{job_id}/preview_original.wav"
            upload_to_supabase(orig_tmp, "processed", orig_remote)
            preview_paths["original"] = orig_remote
            os.unlink(orig_tmp)

        finally:
            shutil.rmtree(out_dir, ignore_errors=True)

        return {
            "file_paths":          file_paths,
            "waveforms":           waveforms,
            "original_waveform":   original_waveform,
            "preview_file_paths":  preview_paths,
            "applied_parameters":  params,
        }

    # ---------- PREVIEW MIX ----------
    def _preview_mix(self, job_id):
        """
        Placeholder — actual preview clips are generated in _mix_full.
        This action just returns confirmation so the webhook can mark COMPLETE.
        """
        return {
            "preview_urls":  {},
            "preview_start": 0,
        }

    # ---------- REVISE MIX ----------
    def _revise_mix(self, job_id, mix_params_json):
        """Re-run mix with updated parameters (revision round)."""
        return self._mix_full(job_id, mix_params_json)
