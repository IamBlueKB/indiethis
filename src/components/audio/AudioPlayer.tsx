"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { useAudioStore } from "@/store";

const formatTime = (s: number): string => {
  if (!s || isNaN(s) || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * AudioPlayer — WaveSurfer-powered waveform component.
 * Reads the current track from the global audio store and renders
 * an interactive waveform with progress, time display, and seek support.
 * Play/pause and volume are driven by the store externally (via MiniPlayer).
 */
export default function AudioPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef        = useRef<WaveSurfer | null>(null);

  const currentTrack    = useAudioStore((s) => s.currentTrack);
  const isPlaying       = useAudioStore((s) => s.isPlaying);
  const volume          = useAudioStore((s) => s.volume);
  const isMuted         = useAudioStore((s) => s.isMuted);
  const currentTime     = useAudioStore((s) => s.currentTime);
  const duration        = useAudioStore((s) => s.duration);
  const setCurrentTime  = useAudioStore((s) => s.setCurrentTime);
  const setDuration     = useAudioStore((s) => s.setDuration);
  const pause           = useAudioStore((s) => s.pause);

  // ── Spawn a new WaveSurfer instance when the track changes ──────────────────
  useEffect(() => {
    if (!containerRef.current || !currentTrack) return;

    // Destroy any existing instance
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     "rgba(212,168,67,0.30)",
      progressColor: "#D4A843",
      cursorColor:   "rgba(212,168,67,0.6)",
      cursorWidth:   1,
      barWidth:      2,
      barGap:        1,
      barRadius:     3,
      height:        44,
      normalize:     true,
      url:           currentTrack.src,
    });

    wsRef.current = ws;

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      // Auto-play if the store says we should be playing
      if (useAudioStore.getState().isPlaying) {
        ws.play().catch(() => {});
      }
    });

    ws.on("timeupdate", (t) => setCurrentTime(t));

    ws.on("finish", () => {
      setCurrentTime(0);
      pause();
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // Only re-run when the source URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.src]);

  // ── Sync play/pause state → WaveSurfer ─────────────────────────────────────
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (isPlaying && !ws.isPlaying()) {
      ws.play().catch(() => {});
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying]);

  // ── Sync volume/mute state → WaveSurfer ─────────────────────────────────────
  useEffect(() => {
    wsRef.current?.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {/* Waveform container — always in DOM so the ref is stable */}
      <div
        className="relative flex-1 min-w-0 overflow-hidden"
        style={{ height: 44 }}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ opacity: currentTrack ? 1 : 0 }}
        />
      </div>

      {/* Time display */}
      <span
        className="text-[10px] tabular-nums shrink-0 select-none"
        style={{ color: "var(--muted-foreground)", minWidth: 72, textAlign: "right" }}
      >
        {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
      </span>
    </div>
  );
}
