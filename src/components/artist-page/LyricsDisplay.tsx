"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAudioStore } from "@/store/audio";

interface Props {
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

  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lyricsRef.current || !duration || duration === 0) return;
    const container = lyricsRef.current;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const progress = currentTime / duration;
    container.scrollTop = scrollHeight * progress;
  }, [currentTime, duration]);

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
          position: "absolute", top: 0, left: 0, right: 0, height: 56,
          background: "linear-gradient(to bottom, #0A0A0A 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />

        {/* Lyrics container — overflow-y: hidden, scrollTop driven by JS */}
        <div
          ref={lyricsRef}
          style={{
            position:   "relative",
            maxHeight:  300,
            overflowY:  "hidden",
          }}
        >
          <div style={{ height: 32 }} />
          {lines.map((line, i) => (
            <p
              key={i}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize:   14,
                lineHeight: 1.8,
                margin:     0,
                padding:    0,
                color:
                  i === currentLineIndex ? "#FFFFFF"
                  : i < currentLineIndex  ? "#444444"
                  : "#666666",
                transition: "color 0.3s ease",
              }}
            >
              {line}
            </p>
          ))}
          <div style={{ height: 32 }} />
        </div>

        {/* Bottom dissolve */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 56,
          background: "linear-gradient(to top, #0A0A0A 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />
      </motion.div>
    </AnimatePresence>
  );
}
