"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAudioStore } from "@/store/audio";

interface Props {
  /** IDs of every published track on this artist's page — gates display to this artist only */
  artistTrackIds: string[];
}

/**
 * Auto-scrolling lyrics panel shown in the left column below HeroCanvasDisplay.
 *
 * Content priority: lyrics → description → hidden
 * Scroll sync: position derived from currentTime / duration × total line count.
 * - Current line: white
 * - Past lines: #444
 * - Upcoming lines: #666
 *
 * User scroll pauses auto-sync for 5 s, then resumes.
 * Paused playback freezes scroll at the current position.
 * Track changes cross-fade in 500 ms.
 * Top and bottom edges dissolve with gradient overlays.
 */
export default function LyricsDisplay({ artistTrackIds }: Props) {
  const currentTrack = useAudioStore((s) => s.currentTrack);
  const currentTime  = useAudioStore((s) => s.currentTime);
  const duration     = useAudioStore((s) => s.duration);
  const isPlaying    = useAudioStore((s) => s.isPlaying);

  // Only show lyrics for tracks belonging to this artist's page
  const isThisArtist =
    currentTrack !== null && artistTrackIds.includes(currentTrack.id);

  // Content: lyrics > description > null
  const rawText = isThisArtist
    ? (currentTrack!.lyrics ?? currentTrack!.description ?? null)
    : null;

  const lines = rawText ? rawText.split("\n").filter((l) => l.trim() !== "") : [];

  // Which line is "current" based on playback position
  const currentLineIndex =
    duration > 0 && lines.length > 0
      ? Math.min(
          Math.floor((currentTime / duration) * lines.length),
          lines.length - 1,
        )
      : 0;

  // Refs
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const userScrollingRef  = useRef(false);
  const scrollTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track user scroll — pause auto-sync for 5 s
  const handleScroll = useCallback(() => {
    userScrollingRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 5000);
  }, []);

  // Auto-scroll to keep current line centred in the container
  useEffect(() => {
    if (userScrollingRef.current || !isPlaying) return;
    const el = lineRefs.current[currentLineIndex];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentLineIndex, isPlaying]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    },
    [],
  );

  // AnimatePresence key — changes when the content source changes
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
        {/* Top dissolve — text fades in from the dark background */}
        <div
          style={{
            position:      "absolute",
            top:           0,
            left:          0,
            right:         0,
            height:        48,
            background:    "linear-gradient(to bottom, #0A0A0A 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex:        2,
          }}
        />

        {/* Scrollable lyrics container */}
        <div
          onScroll={handleScroll}
          style={{
            maxHeight:          300,
            overflowY:          "auto",
            scrollbarWidth:     "none",
            msOverflowStyle:    "none" as React.CSSProperties["msOverflowStyle"],
          }}
        >
          {/* Top pad so first line clears the fade overlay */}
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
                  i === currentLineIndex
                    ? "#FFFFFF"
                    : i < currentLineIndex
                      ? "#444444"
                      : "#666666",
                transition: "color 0.3s ease",
              }}
            >
              {line}
            </p>
          ))}

          {/* Bottom pad so last line clears the fade overlay */}
          <div style={{ height: 24 }} />
        </div>

        {/* Bottom dissolve — text fades into the dark background */}
        <div
          style={{
            position:      "absolute",
            bottom:        0,
            left:          0,
            right:         0,
            height:        48,
            background:    "linear-gradient(to top, #0A0A0A 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex:        2,
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
