"use client";

/**
 * FrequencyVisualizer — three step-function lines that scroll leftward at
 * song pace, with three colored playhead dots fixed at the horizontal
 * center of the canvas riding their respective lines.
 *
 * Architecture:
 *   1. On each new audio src, fetch + decodeAudioData the file.
 *   2. Compute three energy curves (mix / vocals / beat) at FIXED sample
 *      rate of 1 value every STEP_SECONDS — so a 4-minute song produces
 *      ~480 values per role at STEP_SECONDS = 0.5.
 *   3. Each animation frame, draw the visible WINDOW_SECONDS of song
 *      centered on `audio.currentTime`. The visible window's left edge
 *      maps to canvas X=0; the right edge maps to canvas X=W. The
 *      playhead (currentTime) sits at canvas center.
 *   4. Draw three step-function lines across the visible window, one big
 *      colored dot per line at canvas center riding the line's current Y.
 *
 * No band labels. No scattered white dots. Just three lines, three dots.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

// ─── Tuning ───────────────────────────────────────────────────────────────────

const COLORS = {
  mix:    "#D4AF37", // gold
  vocals: "#E8735A", // coral
  beat:   "#7F77DD", // purple
} as const;

type Role = "mix" | "vocals" | "beat";
const ROLES: Role[] = ["mix", "vocals", "beat"];
const LANE_ORDER: Role[] = ["mix", "vocals", "beat"]; // top → bottom

/** How many seconds of audio each step plateau represents. */
const STEP_SECONDS = 0.3;

/** How much of the song is visible at one time (seconds). */
const WINDOW_SECONDS = 4.5;

/** Idle baseline before any audio is decoded. */
const IDLE_BASE = 0.30;

const ROLE_WEIGHTS_BUCKETED: Record<Role, [number, number, number]> = {
  // bucket weights for [low, mid, high] energy bands
  mix:    [1.00, 1.00, 1.00],
  vocals: [0.20, 0.95, 0.50],
  beat:   [1.00, 0.40, 0.80],
};

// ─── Audio analysis (offline) ─────────────────────────────────────────────────

interface SongCurves {
  mix:      Float32Array;
  vocals:   Float32Array;
  beat:     Float32Array;
  /** Seconds per index — equal to STEP_SECONDS. */
  stepSec:  number;
  duration: number;
}

/**
 * Decode `url` into 3 energy curves sampled every STEP_SECONDS.
 * Uses simple time-domain band splits (running averages) — fast, plenty
 * faithful for a visual.
 */
async function decodeSongCurves(url: string): Promise<SongCurves | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf.slice(0));

    const len = audio.length;
    const sr  = audio.sampleRate;

    // Mono mixdown
    const ch0  = audio.getChannelData(0);
    const ch1  = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
    const mono = new Float32Array(len);
    if (ch1) {
      for (let i = 0; i < len; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
    } else {
      mono.set(ch0);
    }

    const lowSmoothMs = 4;   // approx low-pass at ~250Hz vibe
    const midSmoothMs = 0.8; // approx low-pass at ~1.5kHz vibe
    const lowN = Math.max(1, Math.round((lowSmoothMs / 1000) * sr));
    const midN = Math.max(1, Math.round((midSmoothMs / 1000) * sr));
    const lowSmooth = boxFilter(mono, lowN);
    const midSmooth = boxFilter(mono, midN);

    const N      = Math.max(1, Math.floor(audio.duration / STEP_SECONDS));
    const winLen = Math.floor(len / N);
    const lowE   = new Float32Array(N);
    const midE   = new Float32Array(N);
    const highE  = new Float32Array(N);
    for (let w = 0; w < N; w++) {
      const s = w * winLen;
      const e = Math.min(len, s + winLen);
      let sl = 0, sm = 0, sh = 0;
      for (let i = s; i < e; i++) {
        const lo = lowSmooth[i];
        const md = midSmooth[i] - lo;
        const hi = mono[i] - midSmooth[i];
        sl += lo * lo;
        sm += md * md;
        sh += hi * hi;
      }
      const inv = 1 / Math.max(1, e - s);
      lowE[w]  = Math.sqrt(sl * inv);
      midE[w]  = Math.sqrt(sm * inv);
      highE[w] = Math.sqrt(sh * inv);
    }

    // Convert raw energies into spiky "transient-aware" signals.
    // Each window's value is its energy combined with how much louder it
    // is than the running average of the last few windows — so sustained
    // sections settle to a low baseline and onsets (drum hits, vocal
    // attacks) shoot up. Result reads as discrete musical events instead
    // of a flat noise floor.
    function transient(arr: Float32Array, lookback = 4): Float32Array {
      const out = new Float32Array(arr.length);
      let acc = 0;
      for (let i = 0; i < arr.length; i++) {
        acc += arr[i];
        if (i > lookback) acc -= arr[i - lookback - 1];
        const avg = acc / Math.min(lookback + 1, i + 1);
        const flux = Math.max(0, arr[i] - avg);
        // Mix steady energy (30%) with flux (70%) so we keep some shape
        // even where there's no transient.
        out[i] = arr[i] * 0.30 + flux * 4.0;
      }
      return out;
    }

    const mix    = transient(combine(lowE, midE, highE, ROLE_WEIGHTS_BUCKETED.mix));
    const vocals = transient(combine(lowE, midE, highE, ROLE_WEIGHTS_BUCKETED.vocals));
    const beat   = transient(combine(lowE, midE, highE, ROLE_WEIGHTS_BUCKETED.beat));

    void ctx.close();

    return {
      mix:      normalize(mix),
      vocals:   normalize(vocals),
      beat:     normalize(beat),
      stepSec:  STEP_SECONDS,
      duration: audio.duration,
    };
  } catch (err) {
    console.error("[FrequencyVisualizer] decodeSongCurves failed:", err);
    return null;
  }
}

function combine(
  low: Float32Array, mid: Float32Array, high: Float32Array,
  weights: [number, number, number],
): Float32Array {
  const out = new Float32Array(low.length);
  const [wl, wm, wh] = weights;
  for (let i = 0; i < low.length; i++) {
    out[i] = low[i] * wl + mid[i] * wm + high[i] * wh;
  }
  return out;
}

function normalize(arr: Float32Array): Float32Array {
  // Contrast-stretch: subtract the 20th percentile (baseline) and divide
  // by the 95th-minus-20th (span). Then power-curve to push quiet content
  // even quieter, leaving spikes tall and isolated.
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const p20 = sorted[Math.floor(sorted.length * 0.20)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const span = Math.max(1e-6, p95 - p20);
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let v = (arr[i] - p20) / span;
    v = Math.max(0, Math.min(1, v));
    out[i] = Math.pow(v, 1.4); // expand contrast — sustained sections settle low
  }
  return out;
}

function boxFilter(input: Float32Array, N: number): Float32Array {
  const out = new Float32Array(input.length);
  if (N <= 1) { out.set(input); return out; }
  let acc = 0;
  for (let i = 0; i < input.length; i++) {
    acc += input[i];
    if (i >= N) acc -= input[i - N];
    out[i] = acc / Math.min(N, i + 1);
  }
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface FrequencyVisualizerProps {
  audioRef:  RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  height?:   number;
  /** Click maps to revision marker (Premium/Pro). Receives currentTime. */
  onTap?:    (timeSec: number) => void;
  /** Click also seeks to the clicked X position. Always wired. */
  onSeek?:   (timeSec: number) => void;
}

export function FrequencyVisualizer({
  audioRef,
  isPlaying: _isPlaying,
  height = 200,
  onTap,
  onSeek,
}: FrequencyVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef   = useRef<HTMLDivElement | null>(null);
  const rafRef    = useRef<number>(0);

  const [curves, setCurves] = useState<SongCurves | null>(null);
  const curvesRef = useRef<SongCurves | null>(null);
  useEffect(() => { curvesRef.current = curves; }, [curves]);

  // If the user hits play before decode finishes, pause immediately and
  // auto-resume the moment curves are ready, so the lines start moving
  // the instant audio actually plays.
  const wantsPlayRef = useRef(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      if (!curvesRef.current) {
        wantsPlayRef.current = true;
        audio.pause();
      }
    };
    audio.addEventListener("play", onPlay);
    return () => { audio.removeEventListener("play", onPlay); };
  }, [audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (curves && wantsPlayRef.current && audio) {
      wantsPlayRef.current = false;
      void audio.play().catch(() => {});
    }
  }, [curves, audioRef]);

  // Decode whenever the audio src changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    let lastSrc = "";

    const handle = async () => {
      const src = audio.currentSrc || audio.src;
      if (!src || src === lastSrc) return;
      lastSrc = src;
      setCurves(null);
      const c = await decodeSongCurves(src);
      if (!cancelled) setCurves(c);
    };

    // Kick off decode as early as possible — don't wait for the audio
    // element to finish buffering. decodeSongCurves does its own fetch
    // so curves are typically ready before the user hits play.
    void handle();

    // Poll briefly in case src is set after mount; stops once captured.
    const poll = window.setInterval(() => {
      const src = audio.currentSrc || audio.src;
      if (src) {
        window.clearInterval(poll);
        void handle();
      }
    }, 100);
    audio.addEventListener("loadstart",  handle);
    audio.addEventListener("loadeddata", handle);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      audio.removeEventListener("loadstart",  handle);
      audio.removeEventListener("loadeddata", handle);
    };
  }, [audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const draw = () => {
      const canvas = canvasRef.current;
      const wrap   = wrapRef.current;
      if (canvas && wrap) {
        const dpr     = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        const cssW    = wrap.clientWidth;
        const cssH    = height;
        const targetW = Math.round(cssW * dpr);
        const targetH = Math.round(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width        = targetW;
          canvas.height       = targetH;
          canvas.style.width  = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
        }
        renderFrame(canvas, curvesRef.current, audio, dpr);
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioRef, height]);

  // Map a click X position on the canvas to a time in the song.
  //
  // The wave visually scrolls a ~4.5s window centered on the playhead, so
  // mapping clicks to "what you can see" only allows ±2.25s nudges — useless
  // for navigating a full song. Instead we treat the canvas like a standard
  // waveform scrubber: full width = full song duration. Click 25% in → 25%
  // of the song. The visual content under the cursor isn't where you'll
  // land (it's still showing ±2.25s of the current playhead), but the
  // playhead immediately seeks there and the wave re-centers on impact —
  // which matches how every other audio scrub bar behaves.
  const handleSeekClick = (clientX: number) => {
    if (!onSeek) return;
    const audio = audioRef.current;
    const wrap  = wrapRef.current;
    if (!audio || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cssW = rect.width;
    if (cssW <= 0) return;
    const padXcss   = 16;                // matches renderFrame padX (in CSS px)
    const usableW   = Math.max(1, cssW - padXcss * 2);
    const xInUsable = Math.max(0, Math.min(usableW, clientX - rect.left - padXcss));
    const dur       = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (dur <= 0) return;
    const seekTo = (xInUsable / usableW) * dur;
    onSeek(Math.max(0, Math.min(dur, seekTo)));
  };

  // Click + drag scrubbing. Pointer down starts a scrub, pointer move
  // continues seeking while the button is held (or finger is down on
  // touch), pointer up ends. Capturing the pointer means we keep getting
  // move events even if the cursor leaves the canvas — standard scrubber
  // UX. Marking a revision moment is a separate gesture (Enter/Space on
  // the focused canvas) so artists can scrub freely without dropping a
  // marker every time they click.
  const draggingRef = useRef(false);
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    handleSeekClick(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    handleSeekClick(e.clientX);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const isInteractive = !!(onTap || onSeek);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        role={isInteractive ? "button" : "img"}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={onTap
          ? "Click anywhere on the wave to seek. Press Enter to mark this moment for revision feedback."
          : (onSeek
            ? "Click anywhere on the wave to seek to that moment"
            : "Three step-function energy lines scrolling at song pace — mix, vocals, beat")}
        onPointerDown={isInteractive ? handlePointerDown : undefined}
        onPointerMove={isInteractive ? handlePointerMove : undefined}
        onPointerUp={isInteractive ? handlePointerUp : undefined}
        onPointerCancel={isInteractive ? handlePointerUp : undefined}
        onKeyDown={onTap ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap(audioRef.current?.currentTime ?? 0);
          }
        } : undefined}
        className={isInteractive ? "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0B09] rounded" : undefined}
        style={{
          display: "block",
          width:   "100%",
          height,
          cursor:  isInteractive ? "pointer" : "default",
          touchAction: isInteractive ? "none" : undefined,
        }}
      />
    </div>
  );
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function renderFrame(
  canvas: HTMLCanvasElement,
  curves: SongCurves | null,
  audio:  HTMLAudioElement,
  dpr:    number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padX     = 16 * dpr;
  const padTop   = 8  * dpr;
  const padBot   = 8  * dpr;
  const usableW  = W - padX * 2;
  const usableH  = H - padTop - padBot;
  // All three lines share the same drawing region with small vertical
  // offsets between baselines so they cluster together like the reference
  // (yellow on top, blue middle, red bottom — but overlapping ranges).
  const laneAmpl = usableH * 0.55; // each line's vertical travel
  const laneOffset = usableH * 0.16; // offset between line baselines

  const cur = audio.currentTime || 0;

  // Window centered on `cur` — line scrolls past, dot sits at the middle
  // attached to the line value at `cur`.
  const halfWin = WINDOW_SECONDS / 2;
  const tLeft   = cur - halfWin;
  const tRight  = cur + halfWin;
  const secToX  = (t: number) => padX + ((t - tLeft) / WINDOW_SECONDS) * usableW;
  const dotX    = padX + usableW / 2; // center

  for (let lane = 0; lane < LANE_ORDER.length; lane++) {
    const role  = LANE_ORDER[lane];
    const color = COLORS[role];
    const arr   = curves ? curves[role] : null;

    // Cluster all three lines around the canvas vertical center, with a
    // small per-line offset (gold highest, coral middle, purple lowest).
    const centerY = padTop + usableH / 2;
    const laneCenterY = centerY + (lane - 1) * laneOffset;
    const yFor = (v: number) => laneCenterY - (Math.max(0, Math.min(1, v)) - 0.5) * laneAmpl;

    if (!curves || !arr) {
      // Idle — flat baseline + center dot
      const y = yFor(IDLE_BASE);
      ctx.beginPath();
      ctx.lineWidth   = 2 * dpr;
      ctx.lineCap     = "round";
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 6 * dpr;
      ctx.moveTo(padX, y);
      ctx.lineTo(W - padX, y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      drawPlayhead(ctx, color, dotX, y, dpr);
      continue;
    }

    const stepSec = curves.stepSec;
    const N       = arr.length;

    const iLeft  = Math.max(0, Math.floor(tLeft  / stepSec) - 1);
    const iRight = Math.min(N - 1, Math.ceil (tRight / stepSec) + 1);

    // Smooth curve through each window's value, anchored at the window
    // center. Quadratic mid-point smoothing — no flat plateaus, no sharp
    // 90° corners.
    ctx.beginPath();
    ctx.lineWidth   = 2 * dpr;
    ctx.lineJoin    = "round";
    ctx.lineCap     = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6 * dpr;

    const pts: Array<[number, number]> = [];
    for (let i = iLeft; i <= iRight; i++) {
      const segCenterT = (i + 0.5) * stepSec;
      const v = i >= 0 && i < N ? arr[i] : IDLE_BASE;
      pts.push([secToX(segCenterT), yFor(v)]);
    }
    if (pts.length > 0) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1];
        const [x1, y1] = pts[k];
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        ctx.quadraticCurveTo(x0, y0, mx, my);
        if (k === pts.length - 1) ctx.lineTo(x1, y1);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Playhead at canvas center. Y is computed with the SAME quadratic
    // bezier midpoint smoothing the line uses, so the dot sits exactly on
    // the line rather than drifting near it.
    //
    // Segment math: at time `cur`, let i = floor(cur/stepSec). The active
    // bezier segment spans time [i*stepSec, (i+1)*stepSec] with:
    //   start   = midpoint(arr[i-1], arr[i])   at t=i*stepSec
    //   control = arr[i]                       at t=(i+0.5)*stepSec
    //   end     = midpoint(arr[i], arr[i+1])   at t=(i+1)*stepSec
    // Bezier parameter = (cur - i*stepSec) / stepSec.
    const wf      = cur / stepSec;
    const i       = Math.max(0, Math.min(N - 1, Math.floor(wf)));
    const tf      = Math.max(0, Math.min(1, wf - i));
    const aPrev   = arr[Math.max(0, i - 1)];
    const aCur    = arr[i];
    const aNext   = arr[Math.min(N - 1, i + 1)];
    const vStart  = (aPrev + aCur) / 2;
    const vCtrl   = aCur;
    const vEnd    = (aCur + aNext) / 2;
    const omt     = 1 - tf;
    const vCur    = omt * omt * vStart + 2 * omt * tf * vCtrl + tf * tf * vEnd;
    const curY    = yFor(vCur);
    drawPlayhead(ctx, color, dotX, curY, dpr);
  }
}

function drawPlayhead(
  ctx:   CanvasRenderingContext2D,
  color: string,
  x:     number,
  y:     number,
  dpr:   number,
) {
  // Outer glow halo
  ctx.globalAlpha = 0.20;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.arc(x, y, 14 * dpr, 0, Math.PI * 2);
  ctx.fill();
  // Mid halo
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2);
  ctx.fill();
  // Solid core dot
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
  ctx.fill();
}
