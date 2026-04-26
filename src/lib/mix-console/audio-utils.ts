/**
 * Mix-console audio utilities — shared between LogoPlayer, FrequencyVisualizer,
 * and the A/B / version controllers in MixResultsClient.
 *
 *   - useAudioController:  React hook wrapping a single <audio> element
 *   - lufsToVol:           dB → linear gain (clamped 0.01..1)
 *   - fmtTime:             seconds → "M:SS"
 *   - createAnalyserGraph: Web Audio API setup (AudioContext + AnalyserNode)
 *   - useViewportIsSmall:  matchMedia hook for sub-480px screens (Step 12)
 *
 * Step 3 uses useAudioController + fmtTime.
 * Step 4 uses createAnalyserGraph.
 * Step 5 uses lufsToVol for A/B volume matching.
 */

"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m     = Math.floor(total / 60);
  const s     = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function lufsToVol(gainDb: number): number {
  if (!Number.isFinite(gainDb)) return 1;
  return Math.min(1, Math.max(0.01, Math.pow(10, gainDb / 20)));
}

// ─── Audio controller hook ────────────────────────────────────────────────────

export interface AudioController {
  isPlaying:   boolean;
  currentTime: number;
  duration:    number;
  ready:       boolean;
  play:        () => void;
  pause:       () => void;
  toggle:      () => void;
  seek:        (sec: number) => void;
  setSrc:      (src: string, opts?: { keepTime?: boolean; autoplay?: boolean }) => void;
}

/**
 * React hook that wires a `<audio>` element ref to reactive state.
 * Single source of truth for play/pause + currentTime + duration.
 *
 * The audio element must be mounted by the caller (so it can be a real DOM
 * element with crossOrigin="anonymous" for the AnalyserNode in Step 4).
 */
export function useAudioController(
  audioRef: RefObject<HTMLAudioElement | null>,
): AudioController {
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [ready,       setReady]       = useState(false);

  // Subscribe to audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime  = () => setCurrentTime(audio.currentTime);
    const onMeta  = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(audio.currentTime); };
    const onCan   = () => setReady(true);

    audio.addEventListener("timeupdate",     onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play",           onPlay);
    audio.addEventListener("pause",          onPause);
    audio.addEventListener("ended",          onEnded);
    audio.addEventListener("canplay",        onCan);

    return () => {
      audio.removeEventListener("timeupdate",     onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("canplay",        onCan);
    };
  }, [audioRef]);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, [audioRef]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, [audioRef]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else              audio.pause();
  }, [audioRef]);

  const seek = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur  = Number.isFinite(audio.duration) ? audio.duration : 0;
    const safe = Math.max(0, Math.min(sec, dur || sec));
    audio.currentTime = safe;
    setCurrentTime(safe);
  }, [audioRef]);

  const setSrc = useCallback(
    (src: string, opts: { keepTime?: boolean; autoplay?: boolean } = {}) => {
      const audio = audioRef.current;
      if (!audio) return;
      const keep      = opts.keepTime ?? false;
      const wantPlay  = opts.autoplay ?? !audio.paused;
      const prevTime  = keep ? audio.currentTime : 0;
      audio.pause();
      if (audio.src !== src) {
        audio.src = src;
        audio.load();
      }
      if (keep) {
        // Some browsers won't accept currentTime until metadata loads
        const apply = () => {
          try { audio.currentTime = prevTime; } catch {}
          audio.removeEventListener("loadedmetadata", apply);
        };
        if (audio.readyState >= 1) apply();
        else audio.addEventListener("loadedmetadata", apply);
      }
      if (wantPlay) audio.play().catch(() => {});
    },
    [audioRef],
  );

  return { isPlaying, currentTime, duration, ready, play, pause, toggle, seek, setSrc };
}

// ─── Web Audio analyser graph (used by Step 4) ────────────────────────────────

export interface AnalyserGraph {
  ctx:      AudioContext;
  source:   MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  destroy:  () => void;
}

/**
 * Creates (or returns the cached) AudioContext + MediaElementAudioSourceNode
 * + AnalyserNode for the given audio element. Returns null if Web Audio API
 * is unavailable.
 *
 * IMPORTANT: an HTMLMediaElement can only be hooked to ONE
 * MediaElementAudioSourceNode in its lifetime — calling createMediaElement-
 * Source twice on the same element throws. We cache the graph per element
 * to survive React StrictMode double-mounts and remounts after src changes
 * (changing src does NOT invalidate the existing source node).
 */
const ANALYSER_CACHE: WeakMap<HTMLAudioElement, AnalyserGraph> = new WeakMap();

export function createAnalyserGraph(
  audio: HTMLAudioElement,
  fftSize = 2048,
): AnalyserGraph | null {
  const cached = ANALYSER_CACHE.get(audio);
  if (cached) return cached;

  try {
    type WindowWithWebkit = typeof globalThis & {
      AudioContext?:        typeof AudioContext;
      webkitAudioContext?:  typeof AudioContext;
    };
    const w  = globalThis as WindowWithWebkit;
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;

    const ctx      = new AC();
    const source   = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize               = fftSize;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const graph: AnalyserGraph = {
      ctx,
      source,
      analyser,
      destroy: () => {
        try { source.disconnect();   } catch {}
        try { analyser.disconnect(); } catch {}
        try { ctx.close();            } catch {}
        ANALYSER_CACHE.delete(audio);
      },
    };
    ANALYSER_CACHE.set(audio, graph);
    return graph;
  } catch {
    return null;
  }
}

/**
 * Resume a suspended AudioContext (browser autoplay policy requires this
 * after a user gesture). Safe no-op if already running.
 */
export async function ensureAudioContextRunning(graph: AnalyserGraph | null): Promise<void> {
  if (!graph) return;
  if (graph.ctx.state === "suspended") {
    try { await graph.ctx.resume(); } catch {}
  }
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

/**
 * useViewportIsSmall — true when the viewport is narrower than 480px.
 *
 * Used by the Mix Results page to shrink the LogoPlayer + visualizer height
 * on phones without re-implementing the breakpoint in three places. Tailwind
 * classes already handle layout breakpoints; this hook exists for the few
 * cases where we pass a numeric size as a prop instead of a CSS class.
 *
 * SSR-safe: the initial value is `false` (assume desktop), and the
 * matchMedia listener flips it on first client render. Hydration mismatches
 * are avoided because the affected components only render values that show
 * up after layout, not text content the server pre-rendered.
 */
export function useViewportIsSmall(maxWidthPx = 480): boolean {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx - 1}px)`);
    const onChange = () => setIsSmall(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [maxWidthPx]);

  return isSmall;
}
