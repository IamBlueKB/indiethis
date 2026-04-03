"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAudioStore } from "@/store/audio";

const LINE_H      = 14 * 1.8;  // font-size × line-height = 25.2 px
const CONTAINER_H = 300;
const PAD         = 32;        // top and bottom breathing room

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

  // Translate the inner div upward so the current line stays centred
  const lineTop   = PAD + currentLineIndex * LINE_H;
  const rawY      = -(lineTop - CONTAINER_H / 2 + LINE_H / 2);
  const totalH    = PAD + lines.length * LINE_H + PAD;
  const translateY = Math.min(0, Math.max(-(totalH - CONTAINER_H), rawY));

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
        style={{ position: "relative", width: "100%", height: CONTAINER_H, overflow: "hidden" }}
      >
        {/* Top dissolve */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 56,
          background: "linear-gradient(to bottom, #0A0A0A 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 2,
        }} />

        {/* Moving lyrics strip */}
        <div style={{
          transform:  `translateY(${translateY}px)`,
          transition: isPlaying ? "transform 0.6s linear" : "none",
          willChange: "transform",
        }}>
          <div style={{ height: PAD }} />
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
          <div style={{ height: PAD }} />
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
