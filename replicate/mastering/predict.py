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
    """Simple noise gate — vectorized, no scipy binary_dilation (too slow)."""
    threshold_lin = float(10 ** (threshold_db / 20))
    hold_samples  = int((hold_ms  / 1000) * sr)
    gate = (np.abs(y) >= threshold_lin).astype(np.float32)
    # Vectorized hold: convolve gate with a box filter of length hold_samples
    # This extends each open region forward by hold_samples without looping
    if hold_samples > 1:
        kernel = np.ones(hold_samples, dtype=np.float32) / hold_samples
        gate   = np.convolve(gate, kernel, mode="same")
        gate   = (gate > 0).astype(np.float32)
    y_gated = y * gate
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


def apply_breath_editing(audio_mono, sr, mode="SUBTLE"):
    """
    Breath editing — detects low-energy non-voiced regions and attenuates them.
    mode: OFF | SUBTLE (-6 to -12dB) | CLEAN (silence gaps) | TIGHT (silence + shorten)
    Returns mono float32 array.
    """
    if mode == "OFF":
        return audio_mono
    try:
        hop      = int(sr * 0.010)   # 10ms frames
        rms      = librosa.feature.rms(y=audio_mono, hop_length=hop)[0]
        # Threshold: breaths are typically 15-25dB below vocal peaks
        peak_rms = float(np.percentile(rms, 95))
        thresh   = peak_rms * 0.12   # ~18dB below peak

        # Build frame-level gain (vectorized — no Python loop)
        below = rms < thresh
        if mode == "SUBTLE":
            ratio_f = np.clip(rms / (thresh + 1e-9), 0.0, 1.0)
            gain_f  = np.where(below, 0.25 + 0.75 * ratio_f, 1.0).astype(np.float32)
        else:  # CLEAN or TIGHT
            gain_f  = np.where(below, 0.0, 1.0).astype(np.float32)

        # Interpolate frame gains to sample resolution
        gain = np.interp(
            np.arange(len(audio_mono)),
            np.linspace(0, len(audio_mono), len(gain_f)),
            gain_f,
        ).astype(np.float32)

        # Smooth to avoid clicks
        from scipy.signal import lfilter
        smooth_c = float(np.exp(-1.0 / (sr * 0.020)))
        gain = lfilter([1 - smooth_c], [1, -smooth_c], gain).astype(np.float32)

        return audio_mono * gain
    except Exception as e:
        print(f"breath_editing failed: {e}", flush=True)
        return audio_mono


def apply_volume_riding(audio_stereo, sr, target_lufs=-18.0, window_s=0.5, max_gain_db=6.0, max_cut_db=-6.0):
    """
    Automatic volume riding — keeps vocal at consistent loudness.
    Measures RMS in short windows, applies gain to ride toward target.
    Vectorized — no per-sample loop.
    """
    try:
        from scipy.signal import lfilter
        y_mono    = (audio_stereo[0] + audio_stereo[1]) / 2
        hop       = int(sr * window_s)
        rms_f     = librosa.feature.rms(y=y_mono, hop_length=hop)[0]

        # Target RMS from target LUFS (approximate: LUFS ≈ RMS-based)
        target_rms = float(10 ** (target_lufs / 20))

        # Compute per-frame gain needed
        rms_f     = np.maximum(rms_f, 1e-6)
        raw_gain  = target_rms / rms_f   # linear gain per frame

        # Clamp to max_gain_db / max_cut_db
        max_lin   = float(10 ** (max_gain_db / 20))
        min_lin   = float(10 ** (max_cut_db  / 20))
        raw_gain  = np.clip(raw_gain, min_lin, max_lin).astype(np.float32)

        # Interpolate to sample resolution
        gain_s = np.interp(
            np.arange(audio_stereo.shape[1]),
            np.linspace(0, audio_stereo.shape[1], len(raw_gain)),
            raw_gain,
        ).astype(np.float32)

        # Smooth with 200ms time constant to avoid pumping
        smooth_c = float(np.exp(-1.0 / (sr * 0.200)))
        gain_s   = lfilter([1 - smooth_c], [1, -smooth_c], gain_s).astype(np.float32)

        return audio_stereo * gain_s[np.newaxis, :]
    except Exception as e:
        print(f"volume_riding failed: {e}", flush=True)
        return audio_stereo


def apply_soft_clipper(audio_stereo, threshold=0.85):
    """
    Soft clipper — tanh-based waveshaper. Rounds off peaks harmonically
    before the hard limiter. Sounds more musical than brick-wall clipping.
    threshold: normalized amplitude where soft clipping begins (0–1).
    """
    try:
        y = audio_stereo.astype(np.float32)
        # Scale so threshold maps to tanh knee, then scale back
        scaled = y / (threshold + 1e-9)
        clipped = np.tanh(scaled) * threshold
        return np.clip(clipped, -1.0, 1.0)
    except Exception as e:
        print(f"soft_clipper failed: {e}", flush=True)
        return audio_stereo


def apply_tape_saturation(audio_stereo, sr, drive=0.3, warmth=0.5):
    """
    Tape saturation — frequency-dependent saturation (more on lows/mids, less on highs).
    Uses soft-knee waveshaping per frequency band + gentle high-freq rolloff.
    drive: 0–1 saturation amount. warmth: 0–1 low-freq emphasis.
    """
    try:
        y = audio_stereo.astype(np.float32)

        # Split into lows (pre-sat emphasis) and highs (protected)
        lo_board = Pedalboard([LowpassFilter(cutoff_frequency_hz=3000)])
        hi_board = Pedalboard([HighpassFilter(cutoff_frequency_hz=3000)])
        y_lo = lo_board(y.copy(), sr)
        y_hi = hi_board(y.copy(), sr)

        # Saturate lows more aggressively
        drive_lin = float(np.clip(drive, 0.0, 1.0))
        y_lo_sat  = np.tanh(y_lo * (1.0 + drive_lin * 3.0)) / (1.0 + drive_lin * 0.5)

        # Light saturation on highs — preserve air
        y_hi_sat  = np.tanh(y_hi * (1.0 + drive_lin * 0.5))

        # Recombine with warmth bias (more low sat when warmth is high)
        lo_mix = warmth * y_lo_sat + (1 - warmth) * y_lo
        result = lo_mix + y_hi_sat * 0.85   # slight hi-freq rolloff

        return np.clip(result, -1.0, 1.0)
    except Exception as e:
        print(f"tape_saturation failed: {e}", flush=True)
        return audio_stereo


def apply_exciter(audio_stereo, sr, freq=8000, amount=0.15):
    """
    Harmonic exciter — adds even-order harmonics above freq to add air and presence.
    Particularly effective on vocals and the final master.
    """
    try:
        y = audio_stereo.astype(np.float32)
        # Isolate high-freq band
        hi_board = Pedalboard([HighpassFilter(cutoff_frequency_hz=float(freq))])
        y_hi = hi_board(y.copy(), sr)
        # Generate harmonics via gentle soft-clip of the high band
        harmonics = np.tanh(y_hi * 3.0) * float(np.clip(amount, 0.0, 0.5))
        return np.clip(y + harmonics, -1.0, 1.0)
    except Exception as e:
        print(f"exciter failed: {e}", flush=True)
        return audio_stereo


def apply_parallel_compression(audio_stereo, sr, threshold_db=-20, ratio=8.0, attack_ms=1, release_ms=50, wet=0.4):
    """
    NY-style parallel (upward) compression — blend heavily compressed signal
    with dry. Adds density and energy without killing transients.
    """
    try:
        dry       = audio_stereo.astype(np.float32)
        squashed  = Pedalboard([
            Compressor(threshold_db=threshold_db, ratio=ratio,
                       attack_ms=attack_ms, release_ms=release_ms),
        ])(dry.copy(), sr)
        return np.clip(dry * (1 - wet) + squashed * wet, -1.0, 1.0)
    except Exception as e:
        print(f"parallel_compression failed: {e}", flush=True)
        return audio_stereo


def apply_ms_eq(audio_stereo, sr, mid_gain_db=0.0, side_gain_db=0.0,
                mid_hi_shelf_db=0.0, side_hi_shelf_db=2.0, shelf_hz=5000):
    """
    M/S EQ — process Mid and Side channels independently.
    mid_gain_db:       overall mid level (negative = more open mix)
    side_gain_db:      overall side level (positive = wider)
    mid_hi_shelf_db:   high shelf on mid (clarity on center image)
    side_hi_shelf_db:  high shelf on side (air/width in stereo field)
    shelf_hz:          shelf frequency for both hi-shelves
    """
    try:
        if audio_stereo.ndim < 2 or audio_stereo.shape[0] < 2:
            return audio_stereo
        y  = audio_stereo.astype(np.float32)
        L, R = y[0], y[1]
        mid  = (L + R) * 0.5
        side = (L - R) * 0.5

        # Apply gain
        mid  = mid  * float(10 ** (mid_gain_db  / 20))
        side = side * float(10 ** (side_gain_db  / 20))

        # Hi-shelf EQ on mid and side independently
        if abs(mid_hi_shelf_db) > 0.05:
            mid_board = Pedalboard([HighShelfFilter(cutoff_frequency_hz=float(shelf_hz),
                                                    gain_db=float(mid_hi_shelf_db))])
            mid = mid_board(mid[np.newaxis, :].astype(np.float32), sr)[0]

        if abs(side_hi_shelf_db) > 0.05:
            side_board = Pedalboard([HighShelfFilter(cutoff_frequency_hz=float(shelf_hz),
                                                     gain_db=float(side_hi_shelf_db))])
            side = side_board(side[np.newaxis, :].astype(np.float32), sr)[0]

        L_out = np.clip(mid + side, -1.0, 1.0)
        R_out = np.clip(mid - side, -1.0, 1.0)
        return np.stack([L_out, R_out])
    except Exception as e:
        print(f"ms_eq failed: {e}", flush=True)
        return audio_stereo


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

        # Vectorized envelope follower using scipy lfilter (avoids per-sample loop)
        from scipy.signal import lfilter
        # Fast envelope: attack-biased (use attack coef as dominant)
        fast_env = lfilter([1 - fast_a], [1, -fast_a], abs_y).astype(np.float32)
        # Slow envelope: release-biased
        slow_env = lfilter([1 - slow_r], [1, -slow_r], abs_y).astype(np.float32)

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


def apply_stereo_widener(audio_stereo, sr, width=1.3):
    """
    M/S stereo widener. width > 1 = wider, width < 1 = narrower.
    Encodes to Mid/Side, scales Side channel, decodes back to L/R.
    Safe: clips to ±1.0 after decode.
    """
    try:
        if audio_stereo.ndim < 2 or audio_stereo.shape[0] < 2:
            return audio_stereo
        L, R   = audio_stereo[0].astype(np.float32), audio_stereo[1].astype(np.float32)
        mid    = (L + R) * 0.5
        side   = (L - R) * 0.5
        side   = side * float(np.clip(width, 0.0, 3.0))
        L_out  = np.clip(mid + side, -1.0, 1.0)
        R_out  = np.clip(mid - side, -1.0, 1.0)
        return np.stack([L_out, R_out])
    except Exception as e:
        print(f"stereo_widener failed: {e}", flush=True)
        return audio_stereo


def apply_sidechain_compression(beat_stereo, vocal_stereo, sr, threshold_db=-20.0, ratio=4.0, attack_ms=5, release_ms=80, reduction_db=3.0):
    """
    Approximate sidechain compression: duck the beat whenever the main vocal
    is loud (above threshold). Uses vocal RMS envelope as the gain-reduction key.
    beat_stereo and vocal_stereo must be the same length.
    """
    try:
        if beat_stereo.shape[1] != vocal_stereo.shape[1]:
            min_len = min(beat_stereo.shape[1], vocal_stereo.shape[1])
            beat_stereo  = beat_stereo[:,  :min_len]
            vocal_stereo = vocal_stereo[:, :min_len]

        # Build RMS envelope from vocal (key signal)
        hop    = int(sr * 0.005)   # 5 ms hop
        key_mono = (vocal_stereo[0] + vocal_stereo[1]) / 2
        rms_frames = librosa.feature.rms(y=key_mono, hop_length=hop)[0]
        rms_samples = np.interp(
            np.arange(beat_stereo.shape[1]),
            np.linspace(0, beat_stereo.shape[1], len(rms_frames)),
            rms_frames,
        ).astype(np.float32)

        threshold_lin = float(10 ** (threshold_db / 20))
        max_reduction = float(10 ** (-abs(reduction_db) / 20))   # e.g. -3 dB → 0.708

        # Gain reduction: 1.0 when vocal quiet, max_reduction when vocal loud
        gain = np.where(
            rms_samples > threshold_lin,
            np.clip(1.0 - (1.0 - max_reduction) * (rms_samples - threshold_lin) / (threshold_lin + 1e-9), max_reduction, 1.0),
            1.0,
        ).astype(np.float32)

        # Smooth gain with lfilter (vectorized — no per-sample loop)
        from scipy.signal import lfilter
        atk_coef = float(np.exp(-1.0 / (sr * attack_ms  / 1000)))
        rel_coef  = float(np.exp(-1.0 / (sr * release_ms / 1000)))
        avg_coef  = (atk_coef + rel_coef) / 2
        smoothed  = lfilter([1 - avg_coef], [1, -avg_coef], gain).astype(np.float32)

        return beat_stereo * smoothed[np.newaxis, :]
    except Exception as e:
        print(f"sidechain_compression failed: {e}", flush=True)
        return beat_stereo


def apply_chorus(audio_stereo, sr, rate_hz=1.2, depth_ms=8.0, wet=0.4, voices=2):
    """
    Stereo chorus — vectorized: uses fixed delay per voice (average of LFO swing).
    Avoids per-sample Python loops — safe at full 44.1kHz stereo.
    """
    try:
        n_samples = audio_stereo.shape[1]
        out       = audio_stereo.copy().astype(np.float32)
        max_delay = int((depth_ms / 1000.0) * sr) + 1

        for v in range(voices):
            # Use a fixed delay per voice (spread evenly across depth range)
            # LFO modulation approximated as static offset per voice — avoids loop
            frac      = (v + 0.5) / max(voices, 1)   # 0.5/V … (V-0.5)/V
            delay_smp = max(1, int(frac * max_delay))

            for ch in range(audio_stereo.shape[0]):
                src     = audio_stereo[ch].astype(np.float32)
                delayed = np.zeros(n_samples, dtype=np.float32)
                delayed[delay_smp:] = src[:n_samples - delay_smp]
                ch_gain = 1.0 if ch == v % 2 else 0.6
                out[ch] += delayed * wet * ch_gain

        peak = float(np.max(np.abs(out)))
        if peak > 1.0:
            out = out / peak
        return out
    except Exception as e:
        print(f"chorus failed: {e}", flush=True)
        return audio_stereo


def apply_flanger(audio_stereo, sr, rate_hz=0.4, depth_ms=4.0, feedback=0.4, wet=0.5):
    """
    Vectorized flanger — uses fixed short delay (no per-sample loop).
    Feedback applied as a single recirculation pass via np.roll.
    """
    try:
        n_samples  = audio_stereo.shape[1]
        delay_smp  = max(1, int((depth_ms / 1000.0) * sr * 0.5))  # mid-point of sweep
        out        = np.zeros_like(audio_stereo, dtype=np.float32)

        for ch in range(audio_stereo.shape[0]):
            src     = audio_stereo[ch].astype(np.float32)
            delayed = np.zeros(n_samples, dtype=np.float32)
            delayed[delay_smp:] = src[:n_samples - delay_smp]
            # Single feedback pass
            fb      = np.zeros(n_samples, dtype=np.float32)
            fb[delay_smp * 2:] = delayed[:n_samples - delay_smp * 2] * feedback
            out[ch] = np.clip(src + (delayed + fb) * wet, -1.0, 1.0)

        return out
    except Exception as e:
        print(f"flanger failed: {e}", flush=True)
        return audio_stereo


def apply_tpdf_dither(audio_stereo, bit_depth=16):
    """
    TPDF (Triangular Probability Density Function) dither.
    Must be applied to float32 audio BEFORE converting to PCM_16.
    Reduces quantization distortion — call this right before sf.write(...PCM_16).
    """
    try:
        lsb = 2.0 / (2 ** bit_depth)   # 1 LSB in normalized float range
        # Two uniform random signals → triangular distribution
        r1 = np.random.uniform(-lsb / 2, lsb / 2, audio_stereo.shape).astype(np.float32)
        r2 = np.random.uniform(-lsb / 2, lsb / 2, audio_stereo.shape).astype(np.float32)
        return np.clip(audio_stereo.astype(np.float32) + r1 + r2, -1.0, 1.0)
    except Exception as e:
        print(f"tpdf_dither failed: {e}", flush=True)
        return audio_stereo


def apply_dynamic_eq(audio_stereo, sr,
                     bands=None):
    """
    Dynamic EQ — per-band gain is triggered by the signal level in that band.
    When a band's RMS exceeds the threshold, gain reduction (or boost) is applied.
    Default bands: cut boxiness (350Hz), tame harshness (3kHz), reduce mud (200Hz).
    bands: list of dicts {freq, gain_db, threshold_db, ratio, attack_ms, release_ms, q}
    """
    try:
        if bands is None:
            bands = [
                {"freq": 200,  "gain_db": -3.0, "threshold_db": -20, "ratio": 3.0, "attack_ms": 10,  "release_ms": 150, "q": 1.0},
                {"freq": 350,  "gain_db": -2.5, "threshold_db": -22, "ratio": 2.5, "attack_ms": 15,  "release_ms": 200, "q": 1.2},
                {"freq": 3000, "gain_db": -3.0, "threshold_db": -24, "ratio": 3.0, "attack_ms": 5,   "release_ms": 100, "q": 1.5},
            ]

        from scipy.signal import lfilter
        out = audio_stereo.astype(np.float32).copy()

        for band in bands:
            freq        = float(band.get("freq",         1000))
            target_gain = float(band.get("gain_db",      -3.0))
            thresh_db   = float(band.get("threshold_db", -20))
            ratio       = float(band.get("ratio",         3.0))
            attack_ms   = float(band.get("attack_ms",    10))
            release_ms  = float(band.get("release_ms",  150))
            q           = float(band.get("q",             1.0))

            # Measure RMS of this frequency band on the mono mix
            band_mono   = (out[0] + out[1]) / 2
            hop         = int(sr * 0.020)   # 20ms frames — coarser = fewer frames = faster
            rms_f       = librosa.feature.rms(y=band_mono, hop_length=hop)[0]
            rms_s       = np.interp(
                np.arange(out.shape[1]),
                np.linspace(0, out.shape[1], len(rms_f)),
                rms_f,
            ).astype(np.float32)

            thresh_lin        = float(10 ** (thresh_db / 20))
            over              = np.clip((rms_s - thresh_lin) / (thresh_lin + 1e-9), 0.0, 1.0)
            gain_reduction_db = (target_gain * (over * (1.0 - 1.0 / ratio))).astype(np.float32)

            # Smooth with lfilter (vectorized attack/release approximation)
            atk_c    = float(np.exp(-1.0 / (sr * attack_ms  / 1000)))
            rel_c    = float(np.exp(-1.0 / (sr * release_ms / 1000)))
            avg_c    = (atk_c + rel_c) / 2   # blended coef — good enough for mastering
            smooth_gr = lfilter([1 - avg_c], [1, -avg_c], gain_reduction_db).astype(np.float32)

            # Apply as a linear gain multiplier (avoids per-chunk Pedalboard instantiation)
            gain_lin = (10 ** (smooth_gr / 20)).astype(np.float32)
            out = out * gain_lin[np.newaxis, :]

        return np.clip(out, -1.0, 1.0)
    except Exception as e:
        print(f"dynamic_eq failed: {e}", flush=True)
        return audio_stereo


def apply_ms_widener_master(audio_stereo, sr, width=1.3, mono_below_hz=120):
    """
    M/S stereo widener for mastering.
    - Monos bass below mono_below_hz (bass energy centered = tight, punchy low end)
    - Widens mids/highs by scaling the Side channel
    Safe: hard clip to ±1.0 after decode.
    """
    try:
        if audio_stereo.ndim < 2 or audio_stereo.shape[0] < 2:
            return audio_stereo
        y = audio_stereo.astype(np.float32)

        # ── Full-band M/S encode ──────────────────────────────────────────────
        L, R  = y[0], y[1]
        mid   = (L + R) * 0.5
        side  = (L - R) * 0.5

        # ── Scale side channel (widen) ────────────────────────────────────────
        side_wide = side * float(np.clip(width, 0.0, 3.0))

        # ── Bass mono: isolate low-freq mid and zero low-freq side ────────────
        bass_board   = Pedalboard([LowpassFilter(cutoff_frequency_hz=float(mono_below_hz))])
        treble_board = Pedalboard([HighpassFilter(cutoff_frequency_hz=float(mono_below_hz))])

        mid_bass     = bass_board(mid[np.newaxis, :].copy(), sr)[0]
        mid_treble   = treble_board(mid[np.newaxis, :].copy(), sr)[0]
        side_treble  = treble_board(side_wide[np.newaxis, :].copy(), sr)[0]
        # side_bass = 0 (mono bass — intentionally dropped)

        # ── Reconstruct: bass is mono mid only, treble is widened M/S ────────
        mid_out  = mid_bass + mid_treble
        side_out = side_treble          # no low-freq side = mono bass

        L_out = np.clip(mid_out + side_out, -1.0, 1.0)
        R_out = np.clip(mid_out - side_out, -1.0, 1.0)
        return np.stack([L_out, R_out])
    except Exception as e:
        print(f"ms_widener_master failed: {e}", flush=True)
        return audio_stereo


# Genre + role chain matrix
CHAIN_MATRIX = {
    "HIP_HOP": {
        "lead":      {"hp": 80,  "comp1_ratio": 4.0,  "comp2_ratio": 2.5, "sat": 0.03, "reverb_wet": 0.15, "reverb_room": 0.3, "pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 300, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.10, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "tp_low": 300,  "tp_high": 3000},
        "insouts":   {"hp": 200, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.04, "reverb_wet": 0.12, "reverb_room": 0.2, "pan": 0.15, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "eq_tilt_low_cut": -3.0, "eq_tilt_high_cut": -2.0},
        "double":    {"hp": 100, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.20, "reverb_room": 0.3, "pan": 0.35, "detune": 12, "gain_db": -4.0, "telephone": False, "blend_db": -4.0},
        "harmony":   {"hp": 120, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.25, "reverb_room": 0.5, "pan": 0.5,  "detune": 8,  "gain_db": -7.0, "telephone": False, "blend_db": -7.0},
    },
    "TRAP": {
        "lead":      {"hp": 80,  "comp1_ratio": 4.0,  "comp2_ratio": 2.5, "sat": 0.04, "reverb_wet": 0.15, "reverb_room": 0.25,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 300, "comp1_ratio": 6.0,  "comp2_ratio": 0.0, "sat": 0.12, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "tp_low": 300,  "tp_high": 3000},
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
        "adlib":     {"hp": 200, "comp1_ratio": 6.0,  "comp2_ratio": 0.0, "sat": 0.12, "reverb_wet": 0.30, "reverb_room": 0.85,"pan": 0.40, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "tp_low": 500,  "tp_high": 4000},
        "insouts":   {"hp": 200, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.08, "reverb_wet": 0.22, "reverb_room": 0.7, "pan": 0.25, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "tp_low": 500,  "tp_high": 4000},
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
        "adlib":     {"hp": 200, "comp1_ratio": 5.0,  "comp2_ratio": 0.0, "sat": 0.10, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.25, "detune": 0,  "gain_db": -6.0, "telephone": False, "blend_db": -6.0,  "tp_low": 400,  "tp_high": 2500},
        "insouts":   {"hp": 200, "comp1_ratio": 4.0,  "comp2_ratio": 0.0, "sat": 0.07, "reverb_wet": 0.10, "reverb_room": 0.2, "pan": 0.2,  "detune": 0,  "gain_db": -7.0, "telephone": False, "blend_db": -7.0,  "tp_low": 400,  "tp_high": 2500},
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
    "NEO_SOUL": {
        # Warm, organic, intimate — subtle saturation, lush reverb, gentle compression
        # Lead sits upfront but smooth; harmonies are lush and wide
        "lead":      {"hp": 80,  "comp1_ratio": 2.5,  "comp2_ratio": 1.8, "sat": 0.04, "reverb_wet": 0.18, "reverb_room": 0.55,"pan": 0.0,  "detune": 0,  "gain_db": 0.0,  "telephone": False, "blend_db": 0.0},
        "adlib":     {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.22, "reverb_room": 0.6, "pan": 0.15, "detune": 0,  "gain_db": -4.5, "telephone": False, "blend_db": -4.5},
        "insouts":   {"hp": 120, "comp1_ratio": 2.5,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.18, "reverb_room": 0.5, "pan": 0.15, "detune": 0,  "gain_db": -5.0, "telephone": False, "blend_db": -5.0},
        "double":    {"hp": 100, "comp1_ratio": 3.0,  "comp2_ratio": 0.0, "sat": 0.03, "reverb_wet": 0.22, "reverb_room": 0.6, "pan": 0.28, "detune": 6,  "gain_db": -3.5, "telephone": False, "blend_db": -3.5},
        "harmony":   {"hp": 100, "comp1_ratio": 3.5,  "comp2_ratio": 0.0, "sat": 0.02, "reverb_wet": 0.30, "reverb_room": 0.7, "pan": 0.45, "detune": 5,  "gain_db": -3.0, "telephone": False, "blend_db": -3.0},
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
            sf.write(path, apply_tpdf_dither(audio.astype(np.float32)).T, samplerate, subtype="PCM_16")

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

        # ═══════════════════════════════════════════════════════════════════════
        # MASTERING CHAIN
        #
        # Shared pre-chain (applied once to y_clean):
        #   1. Noise reduction  — remove hiss before anything amplifies it
        #   2. Dynamic EQ       — tame resonant spikes (freq-aware, not static)
        #
        # Per-variation (each variation gets its own settings):
        #   3. Multiband comp   — frequency-specific compression character
        #   4. Stereo widener   — M/S width + bass mono below 120Hz
        #   5. Transient shaper — punch amount varies per variation
        #   6. Bus EQ           — tonal color (warm/punch/loud character)
        #   7. Limiter          — hard ceiling at -1dBFS (always last before dither)
        #   8. Dither           — TPDF inside write_wav on every PCM_16 export
        # ═══════════════════════════════════════════════════════════════════════

        # ── 1. Noise floor reduction (shared) ─────────────────────────────────
        try:
            import noisereduce as nr
            y_clean = np.stack([
                nr.reduce_noise(y=y_clean[0].astype(np.float32), sr=sr,
                                stationary=True, prop_decrease=0.7,
                                time_mask_smooth_ms=80, freq_mask_smooth_hz=300),
                nr.reduce_noise(y=y_clean[1].astype(np.float32), sr=sr,
                                stationary=True, prop_decrease=0.7,
                                time_mask_smooth_ms=80, freq_mask_smooth_hz=300),
            ]).astype(np.float32)
            print("master: noise reduction applied", flush=True)
        except Exception as e:
            print(f"master noise_reduce skipped: {e}", flush=True)

        # ── 2. Dynamic EQ (shared) ────────────────────────────────────────────
        dyn_eq_bands = [
            {"freq": 200,  "gain_db": -3.0, "threshold_db": -20, "ratio": 3.0, "attack_ms": 10,  "release_ms": 150, "q": 1.0},
            {"freq": 350,  "gain_db": -2.5, "threshold_db": -22, "ratio": 2.5, "attack_ms": 15,  "release_ms": 200, "q": 1.2},
            {"freq": 3000, "gain_db": -3.0, "threshold_db": -24, "ratio": 3.0, "attack_ms": 5,   "release_ms": 100, "q": 1.5},
        ]
        if g == "HIP_HOP":
            dyn_eq_bands.append({"freq": 60,   "gain_db":  1.5, "threshold_db": -28, "ratio": 1.5, "attack_ms": 20, "release_ms": 300, "q": 0.8})
        elif g == "ROCK":
            dyn_eq_bands.append({"freq": 4000, "gain_db": -2.0, "threshold_db": -22, "ratio": 2.5, "attack_ms": 8,  "release_ms": 80,  "q": 1.5})
        y_clean = apply_dynamic_eq(y_clean.astype(np.float32), sr, bands=dyn_eq_bands)
        print("master: dynamic EQ applied", flush=True)

        # ── Helper: build one variation ────────────────────────────────────────
        def build_variation(
            base,                    # y_clean (shared pre-chain output)
            # Multiband comp settings (band: thresh, ratio, atk, rel)
            mb_sub,  mb_low,  mb_mid,  mb_air,
            # Stereo widener
            ms_width,
            # Transient shaper
            ts_attack_db, ts_sustain_db,
            # Bus EQ Pedalboard effects list
            bus_fx,
            # New processors
            ts_tape_drive=0.1, ts_tape_warmth=0.4,
            ms_mid_gain=0.0, ms_side_gain=0.0, ms_mid_hi=0.5, ms_side_hi=1.0,
            ts_excite=0.10,
            ts_parallel_wet=0.20,
            ts_clip_thresh=0.90,
        ):
            """Run steps 3–7 for one mastering variation. Returns float32 stereo array."""
            y = base.astype(np.float32).copy()

            # 3. Multiband compression — per-variation band settings
            try:
                y_f = y.copy()
                b_sub  = Pedalboard([LowpassFilter(cutoff_frequency_hz=120)])(y_f.copy(), sr)
                b_low  = Pedalboard([HighpassFilter(cutoff_frequency_hz=120),
                                     LowpassFilter(cutoff_frequency_hz=500)])(y_f.copy(), sr)
                b_mid  = Pedalboard([HighpassFilter(cutoff_frequency_hz=500),
                                     LowpassFilter(cutoff_frequency_hz=3000)])(y_f.copy(), sr)
                b_air  = Pedalboard([HighpassFilter(cutoff_frequency_hz=3000)])(y_f.copy(), sr)
                def comp_band(band_sig, cfg):
                    return Pedalboard([Compressor(
                        threshold_db=cfg[0], ratio=cfg[1],
                        attack_ms=cfg[2], release_ms=cfg[3]
                    )])(band_sig, sr)
                y = comp_band(b_sub, mb_sub) + comp_band(b_low, mb_low) + \
                    comp_band(b_mid, mb_mid) + comp_band(b_air, mb_air)
            except Exception as mb_err:
                print(f"variation multiband skipped: {mb_err}", flush=True)

            # 4. Stereo widener (M/S) — mono bass below 120Hz
            y = apply_ms_widener_master(y.astype(np.float32), sr,
                                        width=ms_width, mono_below_hz=120)

            # 5. Transient shaper
            y = apply_transient_shaper(y.astype(np.float32), sr,
                                       attack_boost_db=ts_attack_db,
                                       sustain_cut_db=ts_sustain_db)

            # 6. Bus EQ character
            if bus_fx:
                y = Pedalboard(bus_fx)(y.astype(np.float32), sr)

            # 6b. Tape saturation — genre/variation aware warmth
            y = apply_tape_saturation(y.astype(np.float32), sr,
                                      drive=ts_tape_drive, warmth=ts_tape_warmth)

            # 6c. M/S EQ — variation-specific stereo imaging
            y = apply_ms_eq(y.astype(np.float32), sr,
                            mid_gain_db=ms_mid_gain, side_gain_db=ms_side_gain,
                            mid_hi_shelf_db=ms_mid_hi, side_hi_shelf_db=ms_side_hi,
                            shelf_hz=6000)

            # 6d. Exciter — add air above 8kHz
            y = apply_exciter(y.astype(np.float32), sr, freq=8000, amount=ts_excite)

            # 6e. Parallel compression — density before limiter
            y = apply_parallel_compression(y.astype(np.float32), sr,
                                           threshold_db=-22, ratio=6.0,
                                           attack_ms=2, release_ms=60,
                                           wet=ts_parallel_wet)

            # 6f. Soft clipper — rounds peaks before hard limiter
            y = apply_soft_clipper(y.astype(np.float32), threshold=ts_clip_thresh)

            # 7. Limiter — always last before dither
            y = Pedalboard([Limiter(threshold_db=-1.0)])(y.astype(np.float32), sr)

            return y

        # ── Per-variation settings ─────────────────────────────────────────────
        #
        # Multiband configs: (threshold_db, ratio, attack_ms, release_ms) per band
        # Bands: sub(<120Hz), low(120-500Hz), mid(500-3kHz), air(>3kHz)
        #
        #                  sub band              low band              mid band              air band
        VAR_MB = {
            "clean":  [(-22, 2.0, 15, 180), (-20, 1.8, 20, 200), (-22, 1.5, 25, 250), (-26, 1.5, 15, 120)],
            "warm":   [(-18, 3.0, 10, 150), (-18, 2.5, 15, 180), (-22, 2.0, 20, 220), (-28, 1.8, 12, 100)],
            "punch":  [(-14, 4.0,  5,  80), (-16, 3.5, 10, 100), (-18, 3.0, 15, 150), (-24, 2.5, 8,  80)],
            "loud":   [(-10, 5.0,  3,  50), (-12, 4.5,  5,  60), (-14, 4.0,  8, 100), (-20, 3.5, 5,  60)],
        }
        # Stereo widener: clean stays tighter, punch/loud are wider
        VAR_WIDTH = {"clean": 1.15, "warm": 1.20, "punch": 1.30, "loud": 1.35}

        # Transient shaper: clean = gentle, punch/loud = aggressive
        VAR_TS = {
            "clean":  (1.0, -0.5),
            "warm":   (1.5, -0.8),
            "punch":  (3.5, -1.5),
            "loud":   (4.0, -2.0),
        }

        # Tape saturation: (drive, warmth) — warm gets most, clean gets least
        VAR_TAPE = {
            "clean":  (0.05, 0.3),
            "warm":   (0.25, 0.7),
            "punch":  (0.20, 0.4),
            "loud":   (0.30, 0.5),
        }

        # M/S EQ: (mid_gain, side_gain, mid_hi_shelf, side_hi_shelf)
        VAR_MS_EQ = {
            "clean":  (0.0,  0.0,  0.5,  1.0),
            "warm":   (-0.5, 0.5,  0.0,  1.5),
            "punch":  (0.5,  0.0,  1.5,  1.0),
            "loud":   (0.0,  0.5,  1.0,  2.0),
        }

        # Exciter: air amount
        VAR_EXCITE = {"clean": 0.08, "warm": 0.10, "punch": 0.15, "loud": 0.18}

        # Parallel compression wet
        VAR_PARALLEL = {"clean": 0.15, "warm": 0.20, "punch": 0.30, "loud": 0.40}

        # Soft clipper threshold: loud hits harder
        VAR_CLIP = {"clean": 0.92, "warm": 0.90, "punch": 0.87, "loud": 0.83}

        # Bus EQ per variation
        def _warm_bus():
            fx = [
                LowShelfFilter(cutoff_frequency_hz=200, gain_db=warm_low_gain),
                HighShelfFilter(cutoff_frequency_hz=8000, gain_db=warm_high_gain),
                Compressor(threshold_db=warm_threshold, ratio=warm_comp_ratio, attack_ms=20, release_ms=200),
            ]
            if extra_high_boost > 0:
                fx.insert(2, HighShelfFilter(cutoff_frequency_hz=10000, gain_db=extra_high_boost))
            return fx

        def _punch_bus():
            fx = [
                PeakFilter(cutoff_frequency_hz=2500, gain_db=3.0, q=1.2),
                LowShelfFilter(cutoff_frequency_hz=60,  gain_db=2.0),
                Compressor(threshold_db=-12, ratio=punch_ratio, attack_ms=punch_attack, release_ms=60),
            ]
            if extra_high_boost > 0:
                fx.insert(2, HighShelfFilter(cutoff_frequency_hz=10000, gain_db=extra_high_boost))
            return fx

        def _loud_bus():
            fx = [
                Compressor(threshold_db=-8, ratio=6, attack_ms=2, release_ms=30),
                Gain(gain_db=loud_gain),
            ]
            if extra_high_boost > 0:
                fx.append(HighShelfFilter(cutoff_frequency_hz=10000, gain_db=extra_high_boost))
            return fx

        VAR_BUS_FX = {
            "clean": [],
            "warm":  _warm_bus(),
            "punch": _punch_bus(),
            "loud":  _loud_bus(),
        }

        # ── Build all four variations ──────────────────────────────────────────
        lufs_data      = {}
        true_peak_data = {}
        y_versions     = {}

        for vname in ("clean", "warm", "punch", "loud"):
            mb     = VAR_MB[vname]
            ts     = VAR_TS[vname]
            tape   = VAR_TAPE[vname]
            ms_eq  = VAR_MS_EQ[vname]
            print(f"master: building {vname} variation", flush=True)
            y_var = build_variation(
                y_clean,
                mb_sub=mb[0], mb_low=mb[1], mb_mid=mb[2], mb_air=mb[3],
                ms_width=VAR_WIDTH[vname],
                ts_attack_db=ts[0], ts_sustain_db=ts[1],
                bus_fx=VAR_BUS_FX[vname],
                ts_tape_drive=tape[0],   ts_tape_warmth=tape[1],
                ms_mid_gain=ms_eq[0],    ms_side_gain=ms_eq[1],
                ms_mid_hi=ms_eq[2],      ms_side_hi=ms_eq[3],
                ts_excite=VAR_EXCITE[vname],
                ts_parallel_wet=VAR_PARALLEL[vname],
                ts_clip_thresh=VAR_CLIP[vname],
            )
            y_versions[vname] = y_var
            lufs_data[vname]      = measure_lufs(y_var)
            true_peak_data[vname] = measure_true_peak(y_var)

        y_clean_limited = y_versions["clean"]
        y_warm          = y_versions["warm"]
        y_punch         = y_versions["punch"]
        y_loud          = y_versions["loud"]

        write_wav(clean_path, y_clean_limited, sr)
        remote_clean = f"mastering/{job_id}/master_clean.wav"
        versions["clean"] = upload_to_supabase(clean_path, "processed", remote_clean)
        warm_path = os.path.join(out_dir, "warm.wav")
        write_wav(warm_path, y_warm, sr)
        versions["warm"] = upload_to_supabase(warm_path, "processed", f"mastering/{job_id}/master_warm.wav")
        punch_path = os.path.join(out_dir, "punch.wav")
        write_wav(punch_path, y_punch, sr)
        versions["punch"] = upload_to_supabase(punch_path, "processed", f"mastering/{job_id}/master_punch.wav")
        loud_path = os.path.join(out_dir, "loud.wav")
        write_wav(loud_path, y_loud, sr)
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
            "original": y_clean_limited,
            "clean":    y_clean_limited,
            "warm":     y_warm,
            "punch":    y_punch,
            "loud":     y_loud,
        }

        version_waveforms: dict = {}
        preview_paths:     dict = {}

        for vname, vaudio in v_audio_map.items():
            clip = make_clip(vaudio, preview_start, preview_end, sr)
            clip_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
            sf.write(clip_tmp, apply_tpdf_dither(clip).T, sr, subtype="PCM_16")
            remote_p = f"mastering/{job_id}/preview_{vname}.wav"
            upload_to_supabase(clip_tmp, "processed", remote_p)
            preview_paths[vname] = remote_p
            clip_mono = clip[0] if clip.ndim > 1 else clip
            version_waveforms[vname] = extract_waveform_from_array(clip_mono)
            os.unlink(clip_tmp)

        # Full per-version stats
        version_stats: dict = {}
        for vname, vaudio in {
            "clean": y_clean_limited, "warm": y_warm, "punch": y_punch, "loud": y_loud
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
        breath_editing     = params.get("breathEditing",  "SUBTLE") # OFF | SUBTLE | CLEAN | TIGHT
        volume_riding      = params.get("volumeRiding",   True)     # bool

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

        out_dir  = tempfile.mkdtemp()
        mixed    = None
        sr_out   = None
        beat_bus = None   # processed beat — used for sidechain key
        vocal_bus = None  # summed processed vocals — used as sidechain key

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
                    # Claude can explicitly request telephone via stemParams; chain default is always False
                    do_tel   = bool(sp.get("telephone", chain_p.get("telephone", False)))
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

                    # a2. Breath editing — main vocal only (ad-libs/doubles don't need it)
                    if breath_editing != "OFF" and is_main_vocal(label):
                        for ch in range(y.shape[0]):
                            y[ch] = apply_breath_editing(y[ch], sr, mode=breath_editing)

                    # a3. Volume riding — all vocal stems
                    y = apply_volume_riding(y.astype(np.float32), sr,
                                            target_lufs=-18.0 if is_main_vocal(label) else -24.0)

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

                    # j2. Chorus — doubles and harmonies get thickened; lead gets light chorus
                    chorus_wet = float(sp.get("chorusWet", 0.0))
                    if chorus_wet == 0.0:
                        # Auto-assign by role if Claude didn't specify
                        if label in ("vocal_doubles", "double"):
                            chorus_wet = 0.35
                        elif label in ("vocal_harmonies", "harmony", "backing"):
                            chorus_wet = 0.25
                    if chorus_wet > 0.05:
                        y = apply_chorus(y.astype(np.float32), sr, wet=chorus_wet)

                    # j3. Flanger — only when Claude explicitly sets flangerWet > 0
                    flanger_wet = float(sp.get("flangerWet", 0.0))
                    if flanger_wet > 0.05:
                        y = apply_flanger(y.astype(np.float32), sr, wet=flanger_wet)

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

                # Track beat and vocal buses separately for sidechain
                if label == "beat":
                    beat_bus = y_proc.copy().astype(np.float32)
                elif label not in ("beat",):
                    # Accumulate vocal/supporting stems into vocal_bus
                    if vocal_bus is None:
                        vocal_bus = y_proc.copy().astype(np.float32)
                    else:
                        min_vl = min(vocal_bus.shape[1], y_proc.shape[1])
                        vocal_bus = vocal_bus[:, :min_vl] + y_proc[:, :min_vl].astype(np.float32)

                # Sum into mix
                if mixed is None:
                    mixed = y_proc
                else:
                    min_len = min(mixed.shape[1], y_proc.shape[1])
                    mixed   = mixed[:, :min_len] + y_proc[:, :min_len]

            if mixed is None or sr_out is None:
                shutil.rmtree(out_dir, ignore_errors=True)
                return {"file_paths": {}, "waveforms": {}, "original_waveform": [], "preview_file_paths": {}, "applied_parameters": params}

            # ── Sidechain compression: duck beat under vocals ─────────────────────
            # Re-apply the sidechain-ducked beat into the mix by subtracting the
            # original beat bus and adding the ducked version.
            if beat_bus is not None and vocal_bus is not None:
                try:
                    min_sc = min(beat_bus.shape[1], vocal_bus.shape[1])
                    beat_ducked = apply_sidechain_compression(
                        beat_bus[:, :min_sc].astype(np.float32),
                        vocal_bus[:, :min_sc].astype(np.float32),
                        sr_out,
                        threshold_db=-22.0,
                        ratio=4.0,
                        attack_ms=5,
                        release_ms=80,
                        reduction_db=2.5,
                    )
                    # Replace beat contribution in mix:
                    # mixed = (mixed - original_beat) + ducked_beat
                    min_m = min(mixed.shape[1], beat_bus.shape[1], beat_ducked.shape[1])
                    mixed[:, :min_m] -= beat_bus[:, :min_m]
                    mixed[:, :min_m] += beat_ducked[:, :min_m]
                except Exception as sc_err:
                    print(f"sidechain_compression skipped: {sc_err}", flush=True)

            # ── Bus processing ────────────────────────────────────────────────────
            bus_low_shelf  = float(bus_params_ai.get("eqLowShelf",     0.5))
            bus_high_shelf = float(bus_params_ai.get("eqHighShelf",    1.0))
            bus_thresh     = float(bus_params_ai.get("glueCompThresh", -12))
            bus_ratio      = float(bus_params_ai.get("glueCompRatio",   2.0))
            bus_normalize  = float(bus_params_ai.get("peakNormalize",  -1.0))

            # Multiband compression first — tighten each frequency range independently
            mixed = apply_multiband_compressor(mixed.astype(np.float32), sr_out)

            # Dynamic EQ — knock down boxiness/harshness only when they spike
            mixed = apply_dynamic_eq(mixed.astype(np.float32), sr_out)

            # Then bus EQ + glue comp
            bus_board = Pedalboard([
                LowShelfFilter(cutoff_frequency_hz=100,  gain_db=bus_low_shelf),
                HighShelfFilter(cutoff_frequency_hz=8000, gain_db=bus_high_shelf),
                Compressor(threshold_db=bus_thresh, ratio=bus_ratio,
                           attack_ms=30, release_ms=200),
            ])
            mixed = bus_board(mixed.astype(np.float32), sr_out)

            # ── Stereo widener on bus (M/S) ───────────────────────────────────────
            bus_width = float(bus_params_ai.get("stereoWidth", 1.25))
            mixed = apply_stereo_widener(mixed.astype(np.float32), sr_out, width=bus_width)

            # ── M/S EQ — widen highs on side, gentle mid clarity ─────────────────
            mixed = apply_ms_eq(mixed.astype(np.float32), sr_out,
                                 mid_gain_db=0.0, side_gain_db=0.0,
                                 mid_hi_shelf_db=0.5, side_hi_shelf_db=1.5, shelf_hz=6000)

            # ── Parallel compression (NY style) — density without killing transients
            mixed = apply_parallel_compression(mixed.astype(np.float32), sr_out,
                                               threshold_db=-22, ratio=6.0,
                                               attack_ms=2, release_ms=60, wet=0.25)

            # ── Soft clipper before limiter — rounds peaks harmonically ──────────
            mixed = apply_soft_clipper(mixed.astype(np.float32), threshold=0.88)

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
                sf.write(var_path, apply_tpdf_dither(var_audio).T, sr_out, subtype="PCM_16")
                remote = f"mixing/{job_id}/mix_{name}.wav"
                upload_to_supabase(var_path, "processed", remote)
                file_paths[name] = remote
                os.unlink(var_path)

                clip = make_clip(var_audio, preview_start, preview_end, sr_out)
                clip_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
                sf.write(clip_tmp, apply_tpdf_dither(clip).T, sr_out, subtype="PCM_16")
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
            sf.write(orig_tmp, apply_tpdf_dither(orig_clip).T, sr_out, subtype="PCM_16")
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
