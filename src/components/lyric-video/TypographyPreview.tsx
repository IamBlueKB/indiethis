"use client";

/**
 * src/components/lyric-video/TypographyPreview.tsx
 *
 * Animated preview for a TypographyStyle — loops every 5 seconds.
 * Renders the artist's actual lyrics (or a fallback phrase) with the
 * animation style encoded in `style.remotionConfig` / `style.previewCss`.
 *
 * No API calls — all data passed via props.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypographyStyleData {
  id:             string;
  name:           string;
  displayName:    string;
  description:    string;
  previewCss:     Record<string, string | number>;
  remotionConfig: Record<string, unknown>;
}

interface Props {
  style:       TypographyStyleData;
  lyrics?:     string | null;  // artist's actual lyric line (optional)
  isSelected?: boolean;
  onClick?:    () => void;
  compact?:    boolean;         // smaller card for grid display
}

// ─── Fallback phrases (used when no lyrics provided) ──────────────────────────

const FALLBACK_LINES = [
  "Feel the music",
  "This is my story",
  "Echoes in the dark",
  "Burning like a flame",
  "Rise above it all",
];

function pickFallback(styleName: string): string {
  const idx = ["KARAOKE","KINETIC_BOUNCE","SMOOTH_FADE","GLITCH","HANDWRITTEN"].indexOf(styleName);
  return FALLBACK_LINES[idx >= 0 ? idx : 0];
}

// ─── Per-style animation components ──────────────────────────────────────────

function KaraokePreview({ words, css }: { words: string[]; css: Record<string, string | number> }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setActiveIdx(-1);
    let i = -1;
    intervalRef.current = setInterval(() => {
      i++;
      if (i >= words.length) {
        clearInterval(intervalRef.current!);
      } else {
        setActiveIdx(i);
      }
    }, 380);
    return () => clearInterval(intervalRef.current!);
  }, [words]);

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center items-center">
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            fontFamily:    css.fontFamily as string,
            fontWeight:    css.fontWeight,
            fontSize:      "1.5rem",
            color:         i <= activeIdx
              ? (css.activeColor as string)
              : (css.inactiveColor as string),
            textShadow:    i === activeIdx ? (css.textShadow as string) : "none",
            transform:     i === activeIdx ? "scale(1.08)" : "scale(1)",
            transition:    "color 0.15s ease, transform 0.15s ease, text-shadow 0.15s ease",
            letterSpacing: css.letterSpacing as string,
            display:       "inline-block",
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

function KineticBouncePreview({ words, css }: { words: string[]; css: Record<string, string | number> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [words]);

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center items-center overflow-hidden">
      <AnimatePresence>
        {visible && words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            initial={{ y: 40, opacity: 0, scale: 0.7 }}
            animate={{ y: 0,  opacity: 1, scale: 1 }}
            transition={{
              type:      "spring",
              mass:       0.6,
              stiffness: 280,
              damping:   18,
              delay:     i * 0.055,
            }}
            style={{
              fontFamily:    css.fontFamily as string,
              fontWeight:    css.fontWeight,
              fontSize:      "1.4rem",
              color:         "#FFFFFF",
              textShadow:    "0 4px 16px rgba(0,0,0,0.8)",
              letterSpacing: css.letterSpacing as string,
              textTransform: "uppercase" as const,
              display:       "inline-block",
            }}
          >
            {word}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SmoothFadePreview({ line, css }: { line: string; css: Record<string, string | number> }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(true);
    const t1 = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t1);
  }, [line]);

  return (
    <div className="flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {show && (
          <motion.p
            key="line"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{
              fontFamily:    css.fontFamily as string,
              fontWeight:    css.fontWeight,
              fontSize:      "1.5rem",
              color:         css.color as string,
              fontStyle:     "italic",
              letterSpacing: css.letterSpacing as string,
              lineHeight:    css.lineHeight as string,
              textAlign:     "center",
              margin:        0,
            }}
          >
            {line}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function GlitchPreview({ line, css }: { line: string; css: Record<string, string | number> }) {
  const [glitching, setGlitching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function pulse() {
      setGlitching(true);
      timerRef.current = setTimeout(() => {
        setGlitching(false);
        timerRef.current = setTimeout(pulse, 900 + Math.random() * 700);
      }, 180);
    }
    pulse();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative flex items-center justify-center overflow-hidden">
      {/* base text */}
      <p
        style={{
          fontFamily:    css.fontFamily as string,
          fontWeight:    css.fontWeight,
          fontSize:      "1.4rem",
          color:         "#FFFFFF",
          textTransform: "uppercase" as const,
          letterSpacing: css.letterSpacing as string,
          textAlign:     "center",
          margin:        0,
          position:      "relative",
        }}
      >
        {line}
        {/* chromatic red layer */}
        <span
          aria-hidden
          style={{
            position:   "absolute",
            left:       glitching ? "-3px" : "0",
            top:        0,
            color:      "#FF3860",
            opacity:    glitching ? 0.6 : 0,
            mixBlendMode: "screen" as const,
            transition: "left 0.05s, opacity 0.05s",
            pointerEvents: "none",
            display:    "block",
          }}
        >
          {line}
        </span>
        {/* chromatic cyan layer */}
        <span
          aria-hidden
          style={{
            position:   "absolute",
            left:       glitching ? "3px" : "0",
            top:        0,
            color:      "#00D1FF",
            opacity:    glitching ? 0.6 : 0,
            mixBlendMode: "screen" as const,
            transition: "left 0.05s, opacity 0.05s",
            pointerEvents: "none",
            display:    "block",
          }}
        >
          {line}
        </span>
      </p>
    </div>
  );
}

function HandwrittenPreview({ line, css }: { line: string; css: Record<string, string | number> }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, [line]);

  const chars = line.split("");

  return (
    <div className="flex flex-wrap justify-center items-center gap-0 overflow-hidden">
      {chars.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
          style={{
            fontFamily:    css.fontFamily as string,
            fontWeight:    css.fontWeight,
            fontSize:      "1.8rem",
            color:         css.color as string,
            letterSpacing: char === " " ? "0.3em" : (css.letterSpacing as string),
            display:       "inline-block",
            whiteSpace:    "pre",
            lineHeight:    css.lineHeight as string,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function TypographyPreview({ style, lyrics, isSelected, onClick, compact }: Props) {
  const [loopKey, setLoopKey] = useState(0);

  const line = lyrics
    ? lyrics.split("\n").find(l => l.trim().length > 2)?.trim() ?? pickFallback(style.name)
    : pickFallback(style.name);

  const words = line.split(/\s+/).slice(0, 7); // max 7 words for preview

  // Loop every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setLoopKey(k => k + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const css = style.previewCss;
  const name = style.name;

  function renderAnimation() {
    switch (name) {
      case "KARAOKE":        return <KaraokePreview       key={loopKey} words={words} css={css} />;
      case "KINETIC_BOUNCE": return <KineticBouncePreview key={loopKey} words={words} css={css} />;
      case "SMOOTH_FADE":    return <SmoothFadePreview    key={loopKey} line={line}   css={css} />;
      case "GLITCH":         return <GlitchPreview        key={loopKey} line={line}   css={css} />;
      case "HANDWRITTEN":    return <HandwrittenPreview   key={loopKey} line={line}   css={css} />;
      default:               return <p style={{ color: "#fff", fontSize: "1.5rem" }}>{line}</p>;
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl overflow-hidden transition-all"
      style={{
        border:          isSelected ? "2px solid #D4A843" : "2px solid #2A2A2A",
        backgroundColor: isSelected ? "rgba(212,168,67,0.06)" : "#111",
        cursor:          onClick ? "pointer" : "default",
      }}
    >
      {/* Animation canvas */}
      <div
        className="relative flex items-center justify-center"
        style={{
          height:          compact ? "72px" : "96px",
          backgroundColor: "#0A0A0A",
          padding:         "12px 16px",
          overflow:        "hidden",
        }}
      >
        {renderAnimation()}
      </div>

      {/* Label */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div>
          <p
            className="text-xs font-bold"
            style={{ color: isSelected ? "#D4A843" : "#F0F0F0" }}
          >
            {style.displayName}
          </p>
          {!compact && (
            <p className="text-[11px] mt-0.5" style={{ color: "#666" }}>
              {style.description}
            </p>
          )}
        </div>
        {isSelected && (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#D4A843" }}
          >
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3L3.5 5.5L8 1" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
