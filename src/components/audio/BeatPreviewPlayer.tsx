"use client";

import { useEffect, useRef } from "react";
import { Play, Lock, CheckCircle2 } from "lucide-react";
import { useAudioStore } from "@/store";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BeatPreviewPlayerProps {
  /** Track.id — used as the Zustand store track ID for identity checks. */
  trackId: string;
  /** Track.title */
  title: string;
  /** Producer / artist display name */
  producerName: string;
  /**
   * Track.fileUrl — the full-quality audio file.
   * Used as the source when the current user owns the beat.
   */
  fileUrl: string;
  /**
   * Optional separate 128kbps / lower-quality preview URL.
   * Falls back to `fileUrl` when not provided (watermark still applied).
   */
  previewUrl?: string;
  /** Track.coverArtUrl */
  coverArtUrl?: string;
  /**
   * Whether the current user has a BeatLicense for this track.
   * When true: full quality, no watermark.
   * When false: preview source, speech watermark every 30 s.
   */
  isOwned: boolean;
  /** Known track duration in seconds (optional; used for display before playback). */
  duration?: number;
  /**
   * Optional callback fired the first time the user presses play on this track
   * (i.e. when it wasn't already the active store track).
   * Useful for side-effects like marking a preview as "listened".
   */
  onPlay?: () => void;
  className?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Deterministic bar heights from a seed string (18–87 range). */
function seededBars(seed: string, count = 60): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    out.push(18 + (Math.abs(h) % 70));
  }
  return out;
}

// ─── Waveform SVG ──────────────────────────────────────────────────────────────

function WaveformBars({
  bars,
  progress,
  muted = false,
  height = 32,
}: {
  bars: number[];
  progress: number;
  muted?: boolean;
  height?: number;
}) {
  const playedCount = Math.round(progress * bars.length);
  const n = bars.length;
  return (
    <svg
      viewBox={`0 0 ${n} 100`}
      preserveAspectRatio="none"
      width="100%"
      style={{ height, display: "block", opacity: muted ? 0.45 : 1 }}
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

function NowPlayingBars() {
  return (
    <div className="flex items-end gap-[2px]" style={{ width: 13, height: 13 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:           3,
            height:          "100%",
            borderRadius:    2,
            backgroundColor: "currentColor",
            transformOrigin: "bottom",
            animation:       "inlineNpBar 0.75s ease-in-out infinite",
            animationDelay:  `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Audio watermark ────────────────────────────────────────────────────────────

/**
 * Speaks "IndieThis" via SpeechSynthesis.
 * Cancels any queued utterance first so announcements never pile up.
 * Called at every 30-second mark when a non-owned preview is playing.
 */
function speakWatermark(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter      = new SpeechSynthesisUtterance("IndieThis");
  utter.volume     = 0.35;
  utter.rate       = 0.85;
  utter.pitch      = 1.1;
  window.speechSynthesis.speak(utter);
}

// ─── BeatPreviewPlayer ─────────────────────────────────────────────────────────

/**
 * BeatPreviewPlayer — compact single-row beat player with ownership awareness.
 *
 * Before purchase (`isOwned = false`):
 *   - Uses `previewUrl` (or `fileUrl` if no preview variant is provided)
 *   - Overlays a spoken "IndieThis" announcement via the Web Speech API
 *     at every 30-second mark while the track is actively playing
 *   - Shows a coral "Preview" lock badge
 *
 * After purchase (`isOwned = true`):
 *   - Uses `fileUrl` (full quality)
 *   - No watermark
 *   - Shows a green "Owned" badge
 *
 * Like InlinePlayer, this component does NOT play audio directly. Clicking
 * the play button calls `useAudioStore.play(track)` and the persistent
 * MiniPlayer takes over playback. The watermark effect is driven by
 * `currentTime` from the store, so it fires correctly regardless of
 * whether the user seeks or the MiniPlayer's controls are used.
 */
export default function BeatPreviewPlayer({
  trackId,
  title,
  producerName,
  fileUrl,
  previewUrl,
  coverArtUrl,
  isOwned,
  duration,
  onPlay,
  className = "",
}: BeatPreviewPlayerProps) {
  // ── Store subscriptions ─────────────────────────────────────────────────────
  const currentTrackId = useAudioStore((s) => s.currentTrack?.id);
  const isPlaying      = useAudioStore((s) => s.isPlaying);
  const currentTime    = useAudioStore((s) => s.currentTime);
  const storeDuration  = useAudioStore((s) => s.duration);
  const play           = useAudioStore((s) => s.play);
  const pause          = useAudioStore((s) => s.pause);
  const resume         = useAudioStore((s) => s.resume);

  const isCurrentTrack = currentTrackId === trackId;
  const isThisPlaying  = isCurrentTrack && isPlaying;

  const progress    = isCurrentTrack && storeDuration > 0
    ? Math.min(1, currentTime / storeDuration)
    : 0;
  const displayTime = isCurrentTrack ? currentTime : (duration ?? 0);

  const bars = seededBars(trackId);

  // ── Watermark: fire at each 30-second slot boundary ─────────────────────────
  //
  // slot = Math.floor(currentTime / 30):
  //   t = 0–29  → slot 0  (no fire — slot < 1)
  //   t = 30–59 → slot 1  (fire once)
  //   t = 60–89 → slot 2  (fire once)
  //   …and so on
  //
  // lastWatermarkSlotRef prevents duplicate fires within the same window
  // (currentTime updates ~10 times/second; we only want one fire per slot).
  // Reset to -1 whenever this track is not the active one.
  const lastWatermarkSlotRef = useRef(-1);

  useEffect(() => {
    if (!isCurrentTrack) {
      // Track became inactive — reset slot counter and cancel any pending speech
      lastWatermarkSlotRef.current = -1;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    if (!isPlaying || isOwned) return;

    const slot = Math.floor(currentTime / 30);
    if (slot >= 1 && slot > lastWatermarkSlotRef.current) {
      lastWatermarkSlotRef.current = slot;
      speakWatermark();
    }
  }, [currentTime, isCurrentTrack, isPlaying, isOwned]);

  // ── Cancel speech on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Toggle play / pause / resume ─────────────────────────────────────────────
  function handleToggle() {
    if (!isCurrentTrack) {
      // Load into MiniPlayer — source is determined by ownership at click time
      play({
        id:       trackId,
        title,
        artist:   producerName,
        src:      isOwned ? fileUrl : (previewUrl ?? fileUrl),
        coverArt: coverArtUrl ?? undefined,
        duration,
      });
      onPlay?.();   // notify parent (e.g. mark as listened)
    } else if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={`flex items-center gap-2 ${className}`}>

      {/* Keyframe shared with InlinePlayer — browser deduplicates same-name rules */}
      <style>{`
        @keyframes inlineNpBar {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1); }
        }
      `}</style>

      {/* ── Play / pause / now-playing button ──────────────────────────── */}
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

      {/* ── Waveform ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Slightly muted appearance for un-purchased previews */}
        <WaveformBars
          bars={bars}
          progress={progress}
          height={32}
          muted={!isOwned}
        />
      </div>

      {/* ── Elapsed / total time ────────────────────────────────────────── */}
      <span
        className="text-[10px] tabular-nums shrink-0 select-none"
        style={{ color: "var(--muted-foreground)", minWidth: 32 }}
      >
        {fmtTime(displayTime)}
      </span>

      {/* ── Ownership badge ─────────────────────────────────────────────── */}
      {isOwned ? (
        <div
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full
                     text-[10px] font-semibold select-none"
          style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
        >
          <CheckCircle2 size={9} />
          Owned
        </div>
      ) : (
        <div
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full
                     text-[10px] font-semibold select-none"
          style={{ backgroundColor: "rgba(232,93,74,0.10)", color: "#E85D4A" }}
          title="IndieThis watermark plays every 30 seconds"
        >
          <Lock size={9} />
          Preview
        </div>
      )}

    </div>
  );
}
