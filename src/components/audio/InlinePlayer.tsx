"use client";

import { Play } from "lucide-react";
import { useAudioStore } from "@/store";
import type { AudioTrack } from "@/store";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/**
 * Generates deterministic bar heights from a seed string.
 * Same track ID always produces the same waveform shape.
 * Returns values in the range 18–87 (percentage of bar container height).
 */
function seededBars(seed: string, count = 60): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    out.push(18 + (Math.abs(h) % 70)); // 18–87
  }
  return out;
}

// ─── Waveform SVG ──────────────────────────────────────────────────────────────

/**
 * SVG-based waveform visualization.
 * preserveAspectRatio="none" makes bars stretch to fill any container width.
 * Bars to the left of the progress point are coral; unplayed bars are gold.
 */
function WaveformBars({
  bars,
  progress,
  height = 32,
}: {
  bars: number[];
  progress: number;
  height?: number;
}) {
  const playedCount = Math.round(progress * bars.length);
  const n = bars.length;
  return (
    <svg
      viewBox={`0 0 ${n} 100`}
      preserveAspectRatio="none"
      width="100%"
      style={{ height, display: "block" }}
      aria-hidden
    >
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i + 0.15}
          y={(100 - h) / 2}
          width={0.7}
          height={h}
          rx={0.4}
          fill={i < playedCount ? "#E85D4A" : "rgba(212,168,67,0.30)"}
        />
      ))}
    </svg>
  );
}

// ─── Now-playing animated bars ──────────────────────────────────────────────────

/**
 * Three vertically bouncing bars — the "now playing" indicator.
 * Rendered inside the play button when this track is actively playing.
 * Uses a CSS keyframe animation injected inline (deduplicated by the browser).
 */
function NowPlayingBars() {
  return (
    <div
      className="flex items-end gap-[2px]"
      style={{ width: 13, height: 13 }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: "100%",
            borderRadius: 2,
            backgroundColor: "currentColor",
            transformOrigin: "bottom",
            animation: "inlineNpBar 0.75s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── InlinePlayer ──────────────────────────────────────────────────────────────

export interface InlinePlayerProps {
  /** Track metadata + source URL — passed directly from the parent. */
  track: AudioTrack;
  /**
   * Optional callback fired when this track is loaded into the store for the
   * first time (i.e. the user presses play and it wasn't already the active
   * track). Useful for side-effects like marking a preview as "listened".
   */
  onPlay?: () => void;
  className?: string;
}

/**
 * InlinePlayer — compact single-row waveform player.
 *
 * Does NOT play audio itself. Clicking the play button calls
 * `useAudioStore.play(track)`, which loads the track into the global
 * audio store and the persistent MiniPlayer takes over playback.
 *
 * Shows a pulsing "now playing" animation inside the play button when
 * this track is the currently active track in the store and is playing.
 *
 * Layout:  [▶ / ~~~] [══ SVG waveform ══] [0:00]
 */
export default function InlinePlayer({ track, onPlay, className = "" }: InlinePlayerProps) {
  const currentTrackId = useAudioStore((s) => s.currentTrack?.id);
  const isPlaying      = useAudioStore((s) => s.isPlaying);
  const currentTime    = useAudioStore((s) => s.currentTime);
  const storeDuration  = useAudioStore((s) => s.duration);
  const play           = useAudioStore((s) => s.play);
  const pause          = useAudioStore((s) => s.pause);
  const resume         = useAudioStore((s) => s.resume);

  const isCurrentTrack = currentTrackId === track.id;
  const isThisPlaying  = isCurrentTrack && isPlaying;

  // Progress 0–1; only meaningful when this track is active.
  const progress = isCurrentTrack && storeDuration > 0
    ? Math.min(1, currentTime / storeDuration)
    : 0;

  // Show elapsed time when active, total duration otherwise.
  const displayTime = isCurrentTrack ? currentTime : (track.duration ?? 0);

  // Stable bar heights derived from the track ID — same shape every render.
  const bars = seededBars(track.id);

  function handleToggle() {
    if (!isCurrentTrack) {
      play(track);    // load into MiniPlayer
      onPlay?.();     // notify parent (e.g. mark as listened)
    } else if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>

      {/* Keyframe definition — identical across all instances; browser deduplicates. */}
      <style>{`
        @keyframes inlineNpBar {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1); }
        }
      `}</style>

      {/* ── Play / pause / now-playing button ─────────────────────────── */}
      <button
        onClick={handleToggle}
        className="shrink-0 flex items-center justify-center rounded-full
                   transition-opacity hover:opacity-75"
        style={{
          width:           28,
          height:          28,
          backgroundColor: isCurrentTrack ? "#D4A843" : "rgba(212,168,67,0.12)",
          color:           isCurrentTrack ? "#0A0A0A" : "#D4A843",
        }}
        aria-label={isThisPlaying ? "Pause" : "Play"}
      >
        {isThisPlaying
          ? <NowPlayingBars />
          : <Play size={11} style={{ marginLeft: 1 }} />
        }
      </button>

      {/* ── Waveform ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <WaveformBars bars={bars} progress={progress} height={32} />
      </div>

      {/* ── Time ─────────────────────────────────────────────────────── */}
      <span
        className="text-[10px] tabular-nums shrink-0 select-none"
        style={{ color: "var(--muted-foreground)", minWidth: 32 }}
      >
        {fmtTime(displayTime)}
      </span>

    </div>
  );
}
