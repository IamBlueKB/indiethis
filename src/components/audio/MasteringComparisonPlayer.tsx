"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Download, Loader2 } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MasteringVersion {
  /** Display label: "Warm" | "Punchy" | "Broadcast Ready" */
  label: string;
  /** Audio URL — streamed by WaveSurfer and used as the download href. */
  url: string;
}

export interface MasteringComparisonPlayerProps {
  /** Mastered versions to compare — typically the three Auphonic profiles. */
  versions: MasteringVersion[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Shared WaveSurfer visual config (applied to every instance)
const WS_CONFIG = {
  waveColor:     "rgba(212,168,67,0.30)",
  progressColor: "#E85D4A",
  cursorColor:   "rgba(212,168,67,0.6)",
  cursorWidth:   1,
  barWidth:      3,
  barGap:        2,
  barRadius:     4,
  height:        88,
  normalize:     true,
} as const;

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * MasteringComparisonPlayer
 *
 * Three WaveSurfer instances are mounted simultaneously on page load — all
 * stacked in the same DOM region, only the active one visible. All three
 * decode their audio in parallel so the switch is truly instant:
 *
 *   pause(active) → seekTo(pos / nextDuration, next) → play(next)
 *
 * No reload, no gap, no restart. Manages its own playback state; does NOT
 * interact with the global Zustand audio store or MiniPlayer.
 */
export default function MasteringComparisonPlayer({
  versions,
}: MasteringComparisonPlayerProps) {
  // Refs for WaveSurfer container divs (one per version)
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  // WaveSurfer instance per version
  const wsRefs        = useRef<(WaveSurfer | null)[]>([]);

  // Which version is currently displayed / playing
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [durations,    setDurations]    = useState<number[]>(() => versions.map(() => 0));
  const [loaded,       setLoaded]       = useState<boolean[]>(() => versions.map(() => false));

  // Mutable refs to keep event handlers free of stale state
  const activeIdxRef  = useRef(0);
  const isPlayingRef  = useRef(false);
  // If the user switches to a not-yet-loaded version while playing, we park
  // the intent here and fire play() inside that version's "ready" handler.
  const pendingPlayRef = useRef(false);

  // Keep refs in sync with state (runs after each render, before next paint)
  useEffect(() => { activeIdxRef.current  = activeIdx;  }, [activeIdx]);
  useEffect(() => { isPlayingRef.current  = isPlaying;  }, [isPlaying]);

  // ── Initialise all WaveSurfer instances on mount ──────────────────────────
  useEffect(() => {
    versions.forEach((version, i) => {
      const container = containerRefs.current[i];
      if (!container || wsRefs.current[i]) return; // already initialised

      const ws = WaveSurfer.create({
        container,
        ...WS_CONFIG,
        url: version.url,
      });

      wsRefs.current[i] = ws;

      // ── ready: audio decoded, waveform drawn ──
      ws.on("ready", () => {
        const dur = ws.getDuration();

        setLoaded(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });

        setDurations(prev => {
          const next = [...prev];
          next[i] = dur;
          return next;
        });

        // If the user switched to this version while it was still loading and
        // playback was in progress, fire play() now that we're ready.
        if (i === activeIdxRef.current && pendingPlayRef.current) {
          pendingPlayRef.current = false;
          ws.play().catch(() => {});
        }
      });

      // ── timeupdate: feed current position to state for the active instance ──
      ws.on("timeupdate", (t) => {
        if (i === activeIdxRef.current) setCurrentTime(t);
      });

      // ── finish: track ended naturally ──
      ws.on("finish", () => {
        if (i === activeIdxRef.current) {
          setIsPlaying(false);
          isPlayingRef.current  = false;
          pendingPlayRef.current = false;
          setCurrentTime(0);
        }
      });
    });

    // Cleanup: destroy all instances when component unmounts
    return () => {
      wsRefs.current.forEach((ws) => ws?.destroy());
      wsRefs.current = [];
    };
    // Intentionally empty — run once on mount, capture versions via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch to a different version ────────────────────────────────────────
  function switchVersion(nextIdx: number) {
    if (nextIdx === activeIdx) return;

    const activeWs = wsRefs.current[activeIdx];
    const nextWs   = wsRefs.current[nextIdx];
    if (!nextWs) return;

    // Snapshot playback position from the active WaveSurfer (most accurate)
    const pos = activeWs?.getCurrentTime() ?? currentTime;

    // Pause the currently active instance
    activeWs?.pause();

    // Seek the incoming instance to the same position (ratio 0–1)
    const nextDur = durations[nextIdx];
    if (nextDur > 0) {
      nextWs.seekTo(Math.min(1, pos / nextDur));
    }

    // Flip the active index immediately — before React batches the render
    activeIdxRef.current = nextIdx;
    setActiveIdx(nextIdx);
    setCurrentTime(pos); // optimistic — timeupdate will correct it

    // Resume playback on the new instance if we were playing
    if (isPlayingRef.current) {
      if (loaded[nextIdx]) {
        nextWs.play().catch(() => {});
      } else {
        // Not loaded yet — park the play intent for the "ready" handler
        pendingPlayRef.current = true;
      }
    }
  }

  // ── Toggle play / pause ───────────────────────────────────────────────────
  function togglePlay() {
    const ws = wsRefs.current[activeIdx];
    if (!ws || !loaded[activeIdx]) return;

    if (isPlaying) {
      ws.pause();
      setIsPlaying(false);
      isPlayingRef.current  = false;
      pendingPlayRef.current = false;
    } else {
      ws.play().catch(() => {});
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  }

  const activeDuration  = durations[activeIdx] ?? 0;
  const isActiveLoaded  = loaded[activeIdx];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >

      {/* ── Header row: active label + play/pause + time ─────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Active version label */}
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#E85D4A" }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {versions[activeIdx]?.label ?? "—"}
          </span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {isActiveLoaded ? "ready" : "loading…"}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!isActiveLoaded}
            className="w-8 h-8 rounded-full flex items-center justify-center
                       transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying
              ? <Pause size={14} />
              : <Play  size={14} style={{ marginLeft: 1 }} />
            }
          </button>
          <span
            className="text-[11px] tabular-nums select-none"
            style={{ color: "var(--muted-foreground)", minWidth: 76 }}
          >
            {fmtTime(currentTime)}&nbsp;/&nbsp;{fmtTime(activeDuration)}
          </span>
        </div>
      </div>

      {/* ── Waveform region ──────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        {/*
          All three WaveSurfer containers live here simultaneously.
          They are stacked via position:absolute inside a relative wrapper.
          Only the active one has opacity:1 + pointer-events:auto.
          Inactive instances are invisible but remain fully rendered so
          WaveSurfer keeps their decoded audio ready for instant switching.
        */}
        <div className="relative" style={{ height: 88 }}>

          {/* Loading spinner — shown until the active version is decoded */}
          {!isActiveLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 10 }}
            >
              <div className="flex items-center gap-2">
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--muted-foreground)" }}
                />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Analyzing audio…
                </span>
              </div>
            </div>
          )}

          {versions.map((v, i) => (
            <div
              key={v.label}
              ref={(el) => { containerRefs.current[i] = el; }}
              style={{
                position:      "absolute",
                inset:         0,
                opacity:       i === activeIdx ? (isActiveLoaded ? 1 : 0.25) : 0,
                pointerEvents: i === activeIdx ? "auto" : "none",
                transition:    "opacity 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Version selector + download buttons ──────────────────────── */}
      <div
        className="flex items-center gap-2 px-5 pb-4 flex-wrap border-t pt-3"
        style={{ borderColor: "var(--border)" }}
      >
        {versions.map((v, i) => {
          const isActive = i === activeIdx;
          const isLoaded = loaded[i];

          return (
            <div key={v.label} className="flex items-center gap-1">

              {/* Version selector button */}
              <button
                onClick={() => switchVersion(i)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full
                           text-xs font-semibold border transition-all"
                style={
                  isActive
                    ? {
                        backgroundColor: "#E85D4A",
                        borderColor:     "#E85D4A",
                        color:           "#fff",
                      }
                    : {
                        backgroundColor: "transparent",
                        borderColor:     "var(--border)",
                        color:           "var(--muted-foreground)",
                      }
                }
                aria-pressed={isActive}
              >
                {/* Per-button loading spinner when that version isn't decoded yet */}
                {!isLoaded && (
                  <Loader2
                    size={10}
                    className="animate-spin shrink-0"
                    style={{ opacity: 0.6 }}
                  />
                )}
                {v.label}
              </button>

              {/* Download link */}
              <a
                href={v.url}
                download
                className="w-7 h-7 rounded-full flex items-center justify-center
                           border transition-colors hover:bg-white/5"
                style={{
                  borderColor: "var(--border)",
                  color:       "var(--muted-foreground)",
                }}
                aria-label={`Download ${v.label}`}
                title={`Download ${v.label}`}
              >
                <Download size={12} />
              </a>

            </div>
          );
        })}
      </div>

    </div>
  );
}
