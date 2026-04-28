/**
 * StemWaveform — horizontal waveform for a single stem with playhead.
 *
 * Uses a canvas so the redraw is cheap. The played portion is drawn in the
 * stem's role color, the unplayed portion in a dim gray. A 1px gold playhead
 * sits at the current time. Click/drag scrubs via `onSeek` (seconds).
 *
 * Props:
 *   getPeaks    — pulled from the audio hook; returns null until decoded.
 *   bins        — how many vertical lines to draw. ~80 looks good in 80px width.
 *   currentTime — playback head in seconds (drives the gold marker).
 *   duration    — total duration in seconds (for scrub math).
 *   color       — role color (gold, coral, etc.) for the played portion.
 *   onSeek      — called when the user clicks/drags on the waveform.
 */

"use client";

import { useEffect, useMemo, useRef } from "react";

interface StemWaveformProps {
  getPeaks:     (bins: number) => Float32Array | null;
  bins?:        number;
  currentTime:  number;
  duration:     number;
  color:        string;
  onSeek?:      (seconds: number) => void;
}

export function StemWaveform({
  getPeaks,
  bins = 72,
  currentTime,
  duration,
  color,
  onSeek,
}: StemWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pull peaks once per render — hook caches inside.
  const peaks = useMemo(() => getPeaks(bins), [getPeaks, bins]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const w   = c.clientWidth;
    const h   = c.clientHeight;
    if (w === 0 || h === 0) return;
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width  = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!peaks || peaks.length === 0) {
      // Loading shimmer — flat gold line.
      ctx.fillStyle = "rgba(212,168,67,0.12)";
      ctx.fillRect(0, h / 2 - 0.5, w, 1);
      return;
    }

    const N        = peaks.length;
    const barW     = w / N;
    const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const playedPx = w * progress;

    for (let i = 0; i < N; i++) {
      const x    = i * barW;
      const amp  = Math.max(0.04, peaks[i]);
      const barH = amp * (h * 0.92);
      const y    = (h - barH) / 2;
      ctx.fillStyle = x + barW <= playedPx ? color : "rgba(255,255,255,0.16)";
      ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
    }

    // Playhead.
    if (duration > 0) {
      ctx.fillStyle = "#D4A843";
      ctx.fillRect(Math.min(w - 1, playedPx), 0, 1, h);
    }
  }, [peaks, currentTime, duration, color]);

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
  );
}
