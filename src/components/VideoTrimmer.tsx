"use client";

import { useEffect, useRef, useState } from "react";

interface VideoTrimmerProps {
  videoUrl: string;
  /** Duration of the clip window in seconds. Defaults to 8. */
  clipDuration?: number;
  onSelect: (segment: { startTime: number; endTime: number }) => void;
  onClose?: () => void;
}

export function VideoTrimmer({ videoUrl, clipDuration = 8, onSelect, onClose }: VideoTrimmerProps) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const timelineRef     = useRef<HTMLDivElement>(null);
  const rafRef          = useRef<number>(0);
  const isDraggingRef   = useRef(false);

  const [duration, setDuration]           = useState(0);
  const [currentTime, setCurrentTime]     = useState(0);
  const [startTime, setStartTime]         = useState(0);
  const [isPreviewing, setIsPreviewing]   = useState(false);
  const [isLoaded, setIsLoaded]           = useState(false);

  const endTime = Math.min(startTime + clipDuration, duration);
  const windowPct = duration > 0 ? ((endTime - startTime) / duration) * 100 : 0;
  const startPct  = duration > 0 ? (startTime / duration) * 100 : 0;
  const playPct   = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Track playhead during preview
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onTimeUpdate() {
      if (!video) return;
      setCurrentTime(video.currentTime);

      // Loop the preview window
      if (isPreviewing && video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
    }

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [isPreviewing, startTime, endTime]);

  function handleLoaded() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsLoaded(true);
  }

  function startPreview() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    video.play().catch(() => {});
    setIsPreviewing(true);
  }

  function stopPreview() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPreviewing(false);
  }

  // Drag handle on timeline to set start position
  function getPositionFromEvent(e: React.MouseEvent | MouseEvent): number {
    const timeline = timelineRef.current;
    if (!timeline || duration === 0) return 0;
    const rect  = timeline.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // Clamp so the 8-second window doesn't exceed duration
    const maxStart = Math.max(0, duration - clipDuration);
    return Math.min(ratio * duration, maxStart);
  }

  function handleTimelineMouseDown(e: React.MouseEvent) {
    stopPreview();
    isDraggingRef.current = true;
    const t = getPositionFromEvent(e);
    setStartTime(t);
    seekTo(t);

    function onMove(ev: MouseEvent) {
      if (!isDraggingRef.current) return;
      const t2 = getPositionFromEvent(ev);
      setStartTime(t2);
      seekTo(t2);
    }
    function onUp() {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function seekTo(t: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div
      style={{
        backgroundColor: "#111111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        overflow: "hidden",
        width: "100%",
        maxWidth: 560,
        fontFamily: "inherit",
      }}
    >
      {/* Video preview */}
      <div style={{ position: "relative", backgroundColor: "#000", aspectRatio: "16/9" }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={handleLoaded}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          playsInline
          preload="metadata"
        />
        {!isLoaded && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#666", fontSize: 13,
          }}>
            Loading…
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: "16px 16px 20px" }}>
        {/* Label */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#aaa" }}>
            Select an 8-second clip to use as canvas
          </p>
          <span style={{ fontSize: 12, color: "#666" }}>
            {formatTime(startTime)} – {formatTime(endTime)}
            {duration > 0 && ` / ${formatTime(duration)}`}
          </span>
        </div>

        {/* Timeline scrubber */}
        <div
          ref={timelineRef}
          onMouseDown={handleTimelineMouseDown}
          style={{
            position: "relative",
            height: 36,
            backgroundColor: "#222",
            borderRadius: 6,
            cursor: "pointer",
            userSelect: "none",
            marginBottom: 14,
          }}
        >
          {/* Selected window */}
          <div style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${startPct}%`,
            width: `${windowPct}%`,
            backgroundColor: "rgba(212, 168, 67, 0.35)",
            borderLeft: "2px solid #D4A843",
            borderRight: "2px solid #D4A843",
            borderRadius: 4,
          }} />

          {/* Playhead */}
          {isLoaded && (
            <div style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${playPct}%`,
              width: 2,
              backgroundColor: "#fff",
              pointerEvents: "none",
            }} />
          )}

          {/* Drag handle (left edge of window) */}
          {isLoaded && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: `${startPct}%`,
              transform: "translate(-50%, -50%)",
              width: 12,
              height: 24,
              backgroundColor: "#D4A843",
              borderRadius: 3,
              cursor: "ew-resize",
              zIndex: 2,
            }} />
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* Preview toggle */}
          <button
            onClick={isPreviewing ? stopPreview : startPreview}
            disabled={!isLoaded}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 8,
              border: "1px solid rgba(212,168,67,0.4)",
              backgroundColor: "transparent",
              color: "#D4A843",
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoaded ? "pointer" : "default",
              opacity: isLoaded ? 1 : 0.4,
            }}
          >
            {isPreviewing ? "Stop Preview" : "Preview Clip"}
          </button>

          {/* Use this clip */}
          <button
            onClick={() => {
              stopPreview();
              onSelect({ startTime, endTime });
            }}
            disabled={!isLoaded}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#D4A843",
              color: "#0A0A0A",
              fontSize: 13,
              fontWeight: 700,
              cursor: isLoaded ? "pointer" : "default",
              opacity: isLoaded ? 1 : 0.4,
            }}
          >
            Use This Clip
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={() => { stopPreview(); onClose(); }}
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                backgroundColor: "transparent",
                color: "#666",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
