"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { useAudioStore } from "@/store";
import { getSharedMedia } from "@/lib/audio-unlock";

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
  const readyRef     = useRef(false);

  const currentTrack    = useAudioStore((s) => s.currentTrack);
  const isPlaying       = useAudioStore((s) => s.isPlaying);
  const volume          = useAudioStore((s) => s.volume);
  const isMuted         = useAudioStore((s) => s.isMuted);
  const currentTime      = useAudioStore((s) => s.currentTime);
  const duration         = useAudioStore((s) => s.duration);
  const pendingSeek      = useAudioStore((s) => s.pendingSeek);
  const setCurrentTime   = useAudioStore((s) => s.setCurrentTime);
  const setDuration      = useAudioStore((s) => s.setDuration);
  const clearPendingSeek = useAudioStore((s) => s.clearPendingSeek);
  const pause            = useAudioStore((s) => s.pause);

  // ── Spawn a new WaveSurfer instance when the track changes ──────────────────
  useEffect(() => {
    if (!containerRef.current || !currentTrack) return;

    // Destroy any existing instance
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
    readyRef.current = false;

    // Pass the shared media element that was pre-activated synchronously in
    // the user gesture handler (store.play()). WaveSurfer's setSrc() will see
    // the src is already set and skip resetting the element, so audio that
    // started playing on the user tap continues uninterrupted on mobile.
    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     "rgba(212,168,67,0.30)",
      progressColor: "#E85D4A",
      cursorColor:   "rgba(212,168,67,0.6)",
      cursorWidth:   1,
      barWidth:      2,
      barGap:        1,
      barRadius:     3,
      height:        44,
      normalize:     true,
      url:           currentTrack.src,
      media:         getSharedMedia(),
    });

    wsRef.current = ws;

    ws.on("ready", () => {
      readyRef.current = true;
      setDuration(ws.getDuration());
      // Auto-play if the store says we should be playing
      if (useAudioStore.getState().isPlaying) {
        ws.play().catch(() => {
          // Autoplay was blocked by browser (common on mobile).
          // Reset store to paused so the user can tap Play manually.
          useAudioStore.getState().pause();
        });
      }
    });

    ws.on("timeupdate", (t) => setCurrentTime(t));

    ws.on("finish", () => {
      // Seek WaveSurfer back to start so replay works correctly.
      ws.seekTo(0);
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
  // Guard with readyRef: if WaveSurfer isn't ready yet, skip — the "ready"
  // handler will call play() once decoding is complete. Without this guard,
  // ws.play() rejects (audio not loaded), which triggers pause() and leaves
  // isPlaying=false by the time "ready" fires.
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !readyRef.current) return;
    if (isPlaying && !ws.isPlaying()) {
      ws.play().catch(() => {
        useAudioStore.getState().pause();
      });
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying]);

  // ── Sync volume/mute state → WaveSurfer ─────────────────────────────────────
  useEffect(() => {
    wsRef.current?.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // ── Handle external seek requests (e.g. ±10s buttons in MiniPlayer) ─────────
  useEffect(() => {
    const ws = wsRef.current;
    if (pendingSeek === null || !ws) return;
    const dur = ws.getDuration();
    if (dur > 0) {
      ws.seekTo(Math.max(0, Math.min(pendingSeek / dur, 1)));
    }
    clearPendingSeek();
  }, [pendingSeek, clearPendingSeek]);

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
