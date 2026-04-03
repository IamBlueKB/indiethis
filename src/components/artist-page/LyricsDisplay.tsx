"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAudioStore } from "@/store/audio";

interface Props {
  /** IDs of every published track on this artist's page — gates display to this artist only */
  artistTrackIds: string[];
}

export default function LyricsDisplay({ artistTrackIds }: Props) {
  const currentTrack = useAudioStore((s) => s.currentTrack);
  const currentTime  = useAudioStore((s) => s.currentTime);
  const duration     = useAudioStore((s) => s.duration);
  const isPlaying    = useAudioStore((s) => s.isPlaying);

  const isThisArtist =
    currentTrack !== null && artistTrackIds.includes(currentTrack.id);

  const rawText = isThisArtist
    ? (currentTrack!.lyrics ?? currentTrack!.description ?? null)
    : null;

  const lines = rawText ? rawText.split("\n").filter((l) => l.trim() !== "") : [];

  const currentLineIndex =
    duration > 0 && lines.length > 0
      ? Math.min(Math.floor((currentTime / duration) * lines.length), lines.length - 1)
      : 0;

  // containerRef — must have position:relative so <p> elements use it as offsetParent,
  // making el.offsetTop correctly relative to the scroll container.
  const containerRef     = useRef<HTMLDivElement>(null);
  const lineRefs         = useRef<(HTMLParagraphElement | null)[]>([]);
  const userScrollingRef = useRef(false);
  const scrollTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    userScrollingRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 5000);
  }, []);

  useEffect(() => {
    if (userScrollingRef.current || !isPlaying) return;
    const container = containerRef.current;
    const el        = lineRefs.current[currentLineIndex];
    if (!container || !el) return;

    // el.offsetTop is relative to the container because it has position:relative.
    // Center the current line in the visible area.
    const target = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTop = Math.max(0, target);
  }, [currentLineIndex, isPlaying]);

  useEffect(() => () => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
  }, []);

  const contentKey = isThisArtist ? (currentTrack!.id ?? "none") : "none";

  if (lines.length === 0) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={contentKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        style={{ position: "relative", width: "100%" }}
      >
        {/* Top dissolve */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 48,
          background: "linear-gradient(to bottom, #0A0A0A 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />

        {/* Scroll container — position:relative makes it the offsetParent */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            position:        "relative",
            maxHeight:       300,
            overflowY:       "auto",
            scrollbarWidth:  "none",
            msOverflowStyle: "none" as React.CSSProperties["msOverflowStyle"],
          }}
        >
          <div style={{ height: 24 }} />

          {lines.map((line, i) => (
            <p
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize:   14,
                lineHeight: 1.8,
                margin:     0,
                padding:    "0 0 1px",
                color:
                  i === currentLineIndex ? "#FFFFFF"
                  : i < currentLineIndex ? "#444444"
                  : "#666666",
                transition: "color 0.3s ease",
              }}
            >
              {line}
            </p>
          ))}

          <div style={{ height: 24 }} />
        </div>

        {/* Bottom dissolve */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
          background: "linear-gradient(to top, #0A0A0A 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />
      </motion.div>
    </AnimatePresence>
  );
}
