"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAudioStore } from "@/store/audio";

interface DominantColor {
  r: number;
  g: number;
  b: number;
}

interface MediaState {
  /** Unique key — changes when the displayed media changes, triggering cross-fade */
  key:       string;
  videoSrc:  string | null;
  imageSrc:  string | null;
  colorSrc:  string | null;
}

interface Props {
  /** IDs of every published track on this artist's page — used to gate display to this artist only */
  artistTrackIds: string[];
  /** Cover art URL of the most recent published track — static fallback when nothing is playing */
  latestCoverArt: string | null;
  /** Canvas video URL of the most recent published track — animated fallback when nothing is playing */
  latestCanvasVideo: string | null;
}

/**
 * Ambient canvas video / cover art panel shown on the artist public page
 * below the Listen Now button.
 *
 * Reacts to the MiniPlayer in real time:
 * - Playing track (this artist) with canvas video → looping muted video at 0.6 opacity
 * - Playing track (this artist) without canvas video → static cover art at 0.6 opacity
 * - Nothing playing / different artist → latest release cover art (or canvas if available)
 * - Artist has zero tracks → renders nothing
 *
 * Track changes trigger a 500ms AnimatePresence cross-fade.
 * All four edges dissolve into the #0A0A0A background via gradient overlays.
 * A dominant-color radial glow transitions smoothly (1s ease) when the track changes.
 */
export default function HeroCanvasDisplay({
  artistTrackIds,
  latestCoverArt,
  latestCanvasVideo,
}: Props) {
  const currentTrack = useAudioStore((s) => s.currentTrack);

  // Only mirror tracks that belong to this artist's page.
  // If the user is playing a track from another page, show this artist's latest release instead.
  const isThisArtist =
    currentTrack !== null && artistTrackIds.includes(currentTrack.id);

  const videoSrc = isThisArtist
    ? (currentTrack!.canvasVideoUrl ?? null)
    : latestCanvasVideo;
  const imageSrc = isThisArtist
    ? (currentTrack!.coverArt ?? null)
    : latestCoverArt;
  const colorSrc = isThisArtist
    ? (currentTrack!.coverArt ?? latestCoverArt)
    : latestCoverArt;

  // Stable media key — changes only when the displayed media URL changes so
  // AnimatePresence knows when to run exit/enter transitions.
  const mediaSrc = videoSrc ?? imageSrc ?? null;
  const mediaKey = mediaSrc ?? "empty";

  // Packaged state passed into the animated layer (captured at key-change time)
  const [media, setMedia] = useState<MediaState>({
    key:      mediaKey,
    videoSrc,
    imageSrc,
    colorSrc,
  });

  useEffect(() => {
    setMedia({ key: mediaKey, videoSrc, imageSrc, colorSrc });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey]);

  // Dominant color for the ambient glow
  const [dominantColor, setDominantColor] = useState<DominantColor>({ r: 80, g: 60, b: 40 });
  const colorUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!colorSrc || colorSrc === colorUrlRef.current) return;
    colorUrlRef.current = colorSrc;

    import("fast-average-color").then(({ FastAverageColor }) => {
      const fac = new FastAverageColor();
      fac
        .getColorAsync(colorSrc, { crossOrigin: "anonymous" })
        .then((color) => {
          setDominantColor({ r: color.value[0], g: color.value[1], b: color.value[2] });
        })
        .catch(() => {
          // Silently fall back to default warm color — CORS or load error
        });
    });
  }, [colorSrc]);

  // Nothing to show — artist has no tracks at all
  if (!videoSrc && !imageSrc) return null;

  const { r, g, b } = dominantColor;
  const glowColor = `rgba(${r}, ${g}, ${b}, 0.15)`;

  return (
    // Outer wrapper: fills the parent column; the column in page.tsx controls the 280px desktop width
    <div style={{ position: "relative", width: "100%" }}>

      {/* Ambient glow — dominant color wash, transitions when track changes */}
      <div
        style={{
          position:      "absolute",
          top:           "-20%",
          left:          "-20%",
          width:         "140%",
          height:        "140%",
          background:    `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
          pointerEvents: "none",
          zIndex:        0,
          transition:    "background 1s ease",
        }}
      />

      {/* Video / image container — mobile: capped at 240px tall; desktop: full 9:16 ratio */}
      <div
        className="max-h-[240px] md:max-h-none"
        style={{
          position:     "relative",
          width:        "100%",
          aspectRatio:  "9 / 16",
          borderRadius: 12,
          overflow:     "hidden",
          flexShrink:   0,
          zIndex:       1,
        }}
      >
        {/* Cross-fading media layer */}
        <AnimatePresence mode="wait">
          <motion.div
            key={media.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset:    0,
            }}
          >
            {media.videoSrc ? (
              <video
                src={media.videoSrc}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width:     "100%",
                  height:    "100%",
                  objectFit: "cover",
                  display:   "block",
                }}
              />
            ) : media.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.imageSrc}
                alt=""
                aria-hidden
                style={{
                  width:     "100%",
                  height:    "100%",
                  objectFit: "cover",
                  display:   "block",
                }}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlays — dissolve all four edges into the #0A0A0A background */}

        {/* Bottom gradient */}
        <div
          style={{
            position:      "absolute",
            bottom:        0,
            left:          0,
            right:         0,
            height:        "40%",
            background:    "linear-gradient(to bottom, transparent 0%, #0A0A0A 100%)",
            pointerEvents: "none",
            zIndex:        2,
          }}
        />

        {/* Top gradient */}
        <div
          style={{
            position:      "absolute",
            top:           0,
            left:          0,
            right:         0,
            height:        "20%",
            background:    "linear-gradient(to top, transparent 0%, rgba(0,0,0,0.3) 100%)",
            pointerEvents: "none",
            zIndex:        2,
          }}
        />

        {/* Left gradient */}
        <div
          style={{
            position:      "absolute",
            top:           0,
            bottom:        0,
            left:          0,
            width:         "20%",
            background:    "linear-gradient(to left, transparent 0%, #0A0A0A 100%)",
            pointerEvents: "none",
            zIndex:        2,
          }}
        />

        {/* Right gradient */}
        <div
          style={{
            position:      "absolute",
            top:           0,
            bottom:        0,
            right:         0,
            width:         "20%",
            background:    "linear-gradient(to right, transparent 0%, #0A0A0A 100%)",
            pointerEvents: "none",
            zIndex:        2,
          }}
        />
      </div>
    </div>
  );
}
