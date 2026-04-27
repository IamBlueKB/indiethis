/**
 * MiniSpectrum — small real-time frequency visualizer.
 *
 * Used in two places:
 *   1. Per-stem strip (40px tall) — top slot of <ChannelStrip>
 *   2. Master strip   (40px tall) — top slot of <MasterStrip>
 *
 * Reads from the AnalyserNode the audio graph already exposes:
 *   - Per-stem analyser sits AFTER the stem panner so what you see matches
 *     what the stem contributes to the master bus (with all its effects).
 *   - Master analyser sits AFTER the master EQ chain so it shows the final
 *     output spectrum the user is hearing.
 *
 * Rendering: 24 bars laid out across the canvas. Each bar's height is the
 * average of a slice of getByteFrequencyData. Smoothed over frames with a
 * decay curve so quiet stems don't flicker and loud peaks linger briefly.
 */

"use client";

import { useEffect, useRef } from "react";

interface MiniSpectrumProps {
  analyser: AnalyserNode | null;
  /** Bar fill color — matches the strip color. */
  color?:   string;
  /** Background fill (renders behind bars). */
  background?: string;
  /** Number of bars. Defaults to 24. */
  bars?:    number;
  /** Height in px. Defaults to 40. */
  height?:  number;
}

const DEFAULTS = {
  color:      "#D4A843",
  background: "#0F0D0B",
  bars:       24,
  height:     40,
};

export function MiniSpectrum(props: MiniSpectrumProps) {
  const {
    analyser,
    color      = DEFAULTS.color,
    background = DEFAULTS.background,
    bars       = DEFAULTS.bars,
    height     = DEFAULTS.height,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Smoothing buffer — one slot per bar. Decays over frames so peaks linger.
  const peaksRef  = useRef<Float32Array>(new Float32Array(bars));

  useEffect(() => {
    if (!analyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas device pixel ratio for crisp bars on retina.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ro  = new ResizeObserver(() => resize());
    ro.observe(canvas);

    function resize() {
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    if (peaksRef.current.length !== bars) {
      peaksRef.current = new Float32Array(bars);
    }

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf: number | null = null;

    const tick = () => {
      analyser.getByteFrequencyData(buf);

      // Bin slicing — log-ish weighting so we sample more from low/mid bins
      // (where music lives) and less from the high air bands.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);

      const barWidth = w / bars;
      const peaks    = peaksRef.current;

      // Use sqrt taper so the band slicing emphasises lows + mids — feels more
      // like a Pro Tools / Logic mini-meter than a flat FFT split.
      for (let i = 0; i < bars; i++) {
        const t0   = (i / bars) ** 1.6;
        const t1   = ((i + 1) / bars) ** 1.6;
        const bin0 = Math.floor(t0 * buf.length);
        const bin1 = Math.max(bin0 + 1, Math.floor(t1 * buf.length));
        let sum = 0;
        for (let j = bin0; j < bin1; j++) sum += buf[j];
        const avg = sum / (bin1 - bin0) / 255;  // 0..1

        // Decay smoothing — quick rise, slow fall.
        const prev = peaks[i];
        const v    = avg > prev ? avg : prev * 0.88;
        peaks[i]   = v;

        const barHeight = Math.max(1, v * h);
        const x = i * barWidth + 0.5;
        const y = h - barHeight;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [analyser, color, background, bars]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width:           "100%",
        height:          height,
        display:         "block",
        backgroundColor: background,
        borderRadius:    2,
      }}
      aria-hidden="true"
    />
  );
}
