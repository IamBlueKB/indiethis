/**
 * TrackWaveform — DAW-style continuous filled waveform for a stem lane.
 *
 * Design spec §1 (waveform rendering):
 *   - One peak value per pixel column (driven by canvas width × DPR).
 *   - Mirror around the lane center: top = +peak, bottom = −peak. The shape
 *     is a single filled polygon (no bars-with-gaps), so transients punch
 *     up, sustained notes hold a steady envelope, and silence collapses
 *     to a thin line at center — the way Pro Tools / Logic / Reaper draw.
 *   - Played region is rendered at full color saturation; unplayed region
 *     dims to ~30% so the playhead reads naturally without changing shape.
 *   - Mute dims the entire shape; solo brightens (handled by parent via
 *     the `dim` and `bright` props).
 *
 * Peaks come from `getPeaks(bins)` — already cached inside useStudioAudio.
 * That helper returns max-abs values per bin (a half-envelope). We mirror
 * the half-envelope around center to draw both top and bottom edges, which
 * is visually identical to a true min/max waveform when the source is
 * roughly symmetric (true for music) and is what every consumer DAW shows
 * in zoomed-out track views.
 *
 * Click/drag scrubs via `onSeek` (seconds).
 *
 * Resolution: peaks recomputed on resize. Cache lives in the audio hook so
 * the same `bins` value never re-walks the buffer.
 */

"use client";

import { useEffect, useRef, useState } from "react";

interface TrackWaveformProps {
  getPeaks:     (bins: number) => Float32Array | null;
  /** Current playhead in seconds. Drives played-vs-unplayed opacity. */
  currentTime:  number;
  /** Total duration in seconds. */
  duration:     number;
  /** Stem color — applied at full saturation in the played region. */
  color:        string;
  /** Optional click/drag scrub. */
  onSeek?:      (seconds: number) => void;
  /** True if stem is muted — collapse opacity. */
  dim?:         boolean;
  /** True if stem is soloed — brighten further. */
  bright?:      boolean;
  /** True if any stem is soloed and *this* one is not — heavy dim. */
  faded?:       boolean;
  /** Optional pixels-per-bin density. Default 1 (one bin per CSS pixel). */
  density?:     number;
}

export function TrackWaveform({
  getPeaks,
  currentTime,
  duration,
  color,
  onSeek,
  dim     = false,
  bright  = false,
  faded   = false,
  density = 1,
}: TrackWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef   = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);

  // Mirrors of currentTime / duration so the rAF glow loop reads the latest
  // values without re-subscribing each render.
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const durRef  = useRef(duration);
  durRef.current  = duration;

  // ─── Track CSS width so we can ask for the right number of peaks. ──────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setWidth(Math.max(0, Math.floor(cr.width)));
    });
    ro.observe(c);
    setWidth(c.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || width === 0) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssH = c.clientHeight;
    if (cssH === 0) return;

    if (c.width !== Math.floor(width * dpr) || c.height !== Math.floor(cssH * dpr)) {
      c.width  = Math.floor(width * dpr);
      c.height = Math.floor(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, cssH);

    // One peak per `density` CSS pixels. Default density=1 → one peak per
    // pixel column, which matches DAW resolution.
    const bins  = Math.max(40, Math.floor(width / density));
    const peaks = getPeaks(bins);
    if (!peaks || peaks.length === 0) {
      // Quiet pre-decode state — thin gold line at center.
      ctx.fillStyle = "rgba(212,168,67,0.10)";
      ctx.fillRect(0, cssH / 2 - 0.5, width, 1);
      return;
    }

    const p        = peaks;                    // local non-null alias for closures
    const N        = p.length;
    const step     = width / N;
    const center   = cssH / 2;
    const halfH    = cssH * 0.46;          // leave a hair of breathing room top/bottom
    const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const playedPx = width * progress;

    // Opacity model (Design §1, §3, MUTE BEHAVIOR):
    //   muted       → very low (15%)
    //   faded       → 30% (some other stem is soloed)
    //   bright      → 100% played, 60% unplayed (this stem is soloed)
    //   default     → 100% played, 35% unplayed
    const playedAlpha   = dim ? 0.15 : 1.0;
    const unplayedAlpha = dim ? 0.10
                              : faded  ? 0.18
                              : bright ? 0.55
                                       : 0.35;

    // ─── Draw a single mirrored filled polygon for played + unplayed ────
    // Strategy: build the top edge of the envelope as a path, then close it
    // with the bottom edge in reverse. We draw twice — once clipped to the
    // played region (full color), once clipped to the unplayed region (dim).
    function envelope(alphaPlayed: number, alphaUnplayed: number) {
      // Played slice
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(0, 0, playedPx, cssH);
      ctx!.clip();
      ctx!.beginPath();
      for (let i = 0; i < N; i++) {
        const x   = i * step;
        const amp = Math.max(0.012, p[i]);   // floor so silence shows a hairline
        const y   = center - amp * halfH;
        if (i === 0) ctx!.moveTo(x, y);
        else         ctx!.lineTo(x, y);
      }
      // Last top point at the right edge.
      ctx!.lineTo(width, center - Math.max(0.012, p[N - 1]) * halfH);
      // Bottom edge, reversed.
      ctx!.lineTo(width, center + Math.max(0.012, p[N - 1]) * halfH);
      for (let i = N - 1; i >= 0; i--) {
        const x   = i * step;
        const amp = Math.max(0.012, p[i]);
        const y   = center + amp * halfH;
        ctx!.lineTo(x, y);
      }
      ctx!.closePath();
      ctx!.fillStyle = withAlpha(color, alphaPlayed);
      ctx!.fill();
      ctx!.restore();

      // Unplayed slice
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(playedPx, 0, Math.max(0, width - playedPx), cssH);
      ctx!.clip();
      ctx!.beginPath();
      for (let i = 0; i < N; i++) {
        const x   = i * step;
        const amp = Math.max(0.012, p[i]);
        const y   = center - amp * halfH;
        if (i === 0) ctx!.moveTo(x, y);
        else         ctx!.lineTo(x, y);
      }
      ctx!.lineTo(width, center - Math.max(0.012, p[N - 1]) * halfH);
      ctx!.lineTo(width, center + Math.max(0.012, p[N - 1]) * halfH);
      for (let i = N - 1; i >= 0; i--) {
        const x   = i * step;
        const amp = Math.max(0.012, p[i]);
        const y   = center + amp * halfH;
        ctx!.lineTo(x, y);
      }
      ctx!.closePath();
      // Unplayed region keeps the stem color but at a lower alpha so the
      // played-vs-unplayed boundary reads as a brightness transition, not a
      // hue shift. (Prior behavior dimmed to white, which washed the lane.)
      ctx!.fillStyle = withAlpha(color, alphaUnplayed);
      ctx!.fill();
      ctx!.restore();
    }

    envelope(playedAlpha, unplayedAlpha);

    // ─── Center hairline (subtle, helps emptier stems read as a line) ───
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, center - 0.5, width, 1);
  }, [getPeaks, currentTime, duration, color, dim, bright, faded, width, density]);

  // ─── Playhead breathing glow (rAF, lightweight) ─────────────────────────
  // Draws a soft white band ~50px wide centered on the playhead, only while
  // playback is actually advancing. Sits on a separate canvas with
  // mix-blend-mode: screen so it brightens the waveform pixels beneath
  // without re-rendering the whole envelope per frame. Goes dormant within
  // ~0.3s of pause/seek-stop so static views stay calm.
  useEffect(() => {
    const c = glowRef.current;
    if (!c || width === 0) return;
    const dpr  = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssH = c.clientHeight;
    if (cssH === 0) return;
    if (c.width !== Math.floor(width * dpr) || c.height !== Math.floor(cssH * dpr)) {
      c.width  = Math.floor(width * dpr);
      c.height = Math.floor(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf         = 0;
    let lastT       = -1;
    let stillFrames = 0;

    const tick = () => {
      const t = timeRef.current;
      const d = durRef.current;
      if (Math.abs(t - lastT) < 0.0005) stillFrames++;
      else                              stillFrames = 0;
      lastT = t;

      const advancing = stillFrames < 20 && d > 0 && !dim;

      ctx.clearRect(0, 0, width, cssH);

      if (advancing) {
        const progress = Math.max(0, Math.min(1, t / d));
        const x        = width * progress;
        const halfBand = 13;                                        // ~26px total
        // Very subtle breathing: ±20% of a small base alpha. Gold instead of
        // white so it reads as a highlight on the waveform, not a wash.
        const pulse     = 0.5 + 0.5 * Math.sin(performance.now() / 420);
        const peakAlpha = (bright ? 0.16 : 0.12) + 0.03 * pulse;

        const grad = ctx.createLinearGradient(x - halfBand, 0, x + halfBand, 0);
        grad.addColorStop(0,   "rgba(212,168,67,0)");
        grad.addColorStop(0.5, `rgba(212,168,67,${peakAlpha.toFixed(3)})`);
        grad.addColorStop(1,   "rgba(212,168,67,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - halfBand, 0, halfBand * 2, cssH);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, dim, bright]);

  // Click + drag to scrub.
  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onSeek || duration <= 0) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x    = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    onSeek((x / rect.width) * duration);
  };

  return (
    <div style={{
      position: "relative",
      width:    "100%",
      height:   "100%",
      // Soloed lanes get a saturation boost so the waveform color reads more
      // vivid than the dimmed neighbours — beyond just being not-faded.
      filter:     bright ? "saturate(1.35)" : "none",
      transition: "filter 180ms ease",
    }}>
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          handlePointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handlePointer(e);
        }}
        style={{
          width:  "100%",
          height: "100%",
          display: "block",
          cursor:  onSeek ? "pointer" : "default",
        }}
      />
      {/* Breathing glow overlay — additive brighten on the waveform near the
          playhead, invisible when paused. Pointer-events:none so scrub still
          targets the underlying canvas. */}
      <canvas
        ref={glowRef}
        aria-hidden
        style={{
          position:        "absolute",
          inset:           0,
          width:           "100%",
          height:          "100%",
          pointerEvents:   "none",
          mixBlendMode:    "screen",
        }}
      />
    </div>
  );
}

// Convert a hex / named color to rgba() with the given alpha.
function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("rgb")) return hex; // already rgba — leave alone
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
