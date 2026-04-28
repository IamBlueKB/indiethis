#!/usr/bin/env python3
"""
generate-impulse-responses.py — synthesize the three small impulse response
WAVs used by the Pro Studio Mixer's per-stem ConvolverNode preview reverb
(step 32).

Outputs (44.1 kHz, mono, 16-bit PCM) into public/audio/ir/:

  hall.wav  — large hall IR    (~1.8s tail)   target ~50KB
  plate.wav — plate reverb IR  (~1.2s tail)   target ~40KB
  room.wav  — small room IR    (~0.6s tail)   target ~30KB

Method (per spec): exponential decay envelope with frequency-dependent
damping. We start with white noise, apply a low-pass filter that closes
over time (highs decay faster than lows — physically realistic), and
multiply by an exponential envelope. The result is a believable preview
reverb without any commercial IR licensing concerns.

Requires: numpy, scipy, soundfile
    pip install numpy scipy soundfile

Run from the repo root:
    python scripts/generate-impulse-responses.py
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass

try:
    import numpy as np
    import soundfile as sf
    from scipy import signal
except ImportError as e:
    print(f"Missing dependency: {e}. Install with: pip install numpy scipy soundfile",
          file=sys.stderr)
    sys.exit(1)


SAMPLE_RATE = 44_100
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUT_DIR     = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "public", "audio", "ir"))


@dataclass
class IRParams:
    name:           str
    duration_s:     float   # total tail length
    pre_delay_ms:   float   # initial silent gap
    decay_tau:      float   # exponential time constant (smaller = faster decay)
    initial_lpf_hz: float   # LPF cutoff at t=0
    final_lpf_hz:   float   # LPF cutoff at end (always lower — highs close down)
    early_gain:     float   # peak amplitude of the early reflections


PRESETS: list[IRParams] = [
    # Hall — long, lush, plenty of low/mid energy.
    IRParams(name="hall",  duration_s=1.8, pre_delay_ms=18,
             decay_tau=0.55, initial_lpf_hz=12_000, final_lpf_hz=2_500, early_gain=0.85),
    # Plate — bright, dense, medium tail.
    IRParams(name="plate", duration_s=1.2, pre_delay_ms=4,
             decay_tau=0.40, initial_lpf_hz=16_000, final_lpf_hz=4_500, early_gain=0.95),
    # Room — short, intimate.
    IRParams(name="room",  duration_s=0.6, pre_delay_ms=2,
             decay_tau=0.18, initial_lpf_hz=10_000, final_lpf_hz=2_000, early_gain=0.75),
]


def synth_ir(p: IRParams) -> np.ndarray:
    n = int(p.duration_s * SAMPLE_RATE)
    pre = int(p.pre_delay_ms * 1e-3 * SAMPLE_RATE)
    rng = np.random.default_rng(seed=hash(p.name) & 0xFFFFFFFF)

    # White noise body.
    noise = rng.standard_normal(n).astype(np.float32)

    # Time vector and exponential envelope.
    t   = np.arange(n) / SAMPLE_RATE
    env = np.exp(-t / p.decay_tau).astype(np.float32)

    # Frequency-dependent damping: split into 4 bands and decay highs faster.
    # We approximate by applying a moving low-pass whose cutoff slides from
    # initial_lpf_hz to final_lpf_hz over the tail. Done in chunks for speed.
    chunk = 1024
    out = np.zeros_like(noise)
    for i in range(0, n, chunk):
        j = min(i + chunk, n)
        frac = i / max(1, n - 1)
        cutoff = p.initial_lpf_hz + (p.final_lpf_hz - p.initial_lpf_hz) * frac
        cutoff = max(800.0, min(SAMPLE_RATE / 2 - 100, cutoff))
        sos = signal.butter(2, cutoff, btype="low", fs=SAMPLE_RATE, output="sos")
        out[i:j] = signal.sosfilt(sos, noise[i:j]).astype(np.float32)

    out *= env

    # Early-reflection burst: a few discrete taps at the start scaled by early_gain.
    if pre < n - 4:
        tap_offsets = [pre, pre + int(0.011 * SAMPLE_RATE),
                       pre + int(0.023 * SAMPLE_RATE),
                       pre + int(0.037 * SAMPLE_RATE)]
        tap_amps = [p.early_gain, p.early_gain * 0.75, p.early_gain * 0.55, p.early_gain * 0.4]
        for off, amp in zip(tap_offsets, tap_amps):
            if off < n:
                out[off] += amp * (1 if rng.random() > 0.5 else -1)

    # Apply pre-delay by zeroing the first `pre` samples (the early-reflection
    # taps we placed start at `pre`, so this is effectively trimming the noise
    # before the first reflection).
    if pre > 0:
        out[:pre] = 0.0

    # Tiny fade-out so we don't end on a click.
    fade_n = min(256, n // 8)
    if fade_n > 0:
        out[-fade_n:] *= np.linspace(1.0, 0.0, fade_n, dtype=np.float32)

    # Peak-normalize to -3 dBFS.
    peak = float(np.max(np.abs(out))) or 1.0
    out = (out / peak) * (10 ** (-3.0 / 20.0))

    return out.astype(np.float32)


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    for p in PRESETS:
        ir = synth_ir(p)
        path = os.path.join(OUT_DIR, f"{p.name}.wav")
        # 16-bit PCM mono — small files, plenty of headroom for a preview IR.
        sf.write(path, ir, SAMPLE_RATE, subtype="PCM_16")
        size_kb = os.path.getsize(path) / 1024
        print(f"  wrote {path}  ({len(ir)} samples, {size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
