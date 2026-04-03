"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioStore } from "@/store/audio";

interface DominantColor {
  r: number;
  g: number;
  b: number;
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
 * - Playing track (this artist) with canvas video → looping muted video at 0.6 opacity
 * - Playing track (this artist) without canvas video → static cover art at 0.6 opacity
 * - Nothing playing / different artist → latest release cover art (or canvas if available)
 * - Artist has zero tracks → renders nothing
 *
 * All four edges dissolve into the #0A0A0A background via gradient overlays.
 * A dominant-color radial glow bleeds outward behind the container for ambient mood.
 */
export default function HeroCanvasDisplay({
  artistTrackIds,
  latestCoverArt,
  latestCanvasVideo,
}: Props) {
  const currentTrack = useAudioStore((s) => s.currentTrack);

  // Only mirror tracks that belong to this artist's page.
  const isThisArtist =
    currentTrack !== null && artistTrackIds.includes(currentTrack.id);

  const videoSrc = isThisArtist
    ? (currentTrack!.canvasVideoUrl ?? null)
    : latestCanvasVideo;
  const imageSrc = isThisArtist
    ? (currentTrack!.coverArt ?? null)
    : latestCoverArt;

  // The image URL used for dominant color extraction (always from cover art, even when showing video)
  const colorSourceUrl = isThisArtist
    ? (currentTrack!.coverArt ?? latestCoverArt)
    : latestCoverArt;

  const showVideo = !!videoSrc;
  const showImage = !showVideo && !!imageSrc;

  // Dominant color for the ambient glow behind the container
  const [dominantColor, setDominantColor] = useState<DominantColor>({ r: 80, g: 60, b: 40 });
  const colorUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!colorSourceUrl || colorSourceUrl === colorUrlRef.current) return;
    colorUrlRef.current = colorSourceUrl;

    // Dynamically import fast-average-color (client only)
    import("fast-average-color").then(({ FastAverageColor }) => {
      const fac = new FastAverageColor();
      fac
        .getColorAsync(colorSourceUrl, { crossOrigin: "anonymous" })
        .then((color) => {
          setDominantColor({ r: color.value[0], g: color.value[1], b: color.value[2] });
        })
        .catch(() => {
          // Silently fall back to default warm color — CORS or load error
        });
    });
  }, [colorSourceUrl]);

  // Nothing to show — artist has no tracks at all
  if (!showVideo && !showImage) return null;

  const { r, g, b } = dominantColor;
  const glowColor = `rgba(${r}, ${g}, ${b}, 0.15)`;

  return (
    // Outer wrapper: provides positioning context for the glow div that sits behind
    <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>

      {/* Ambient glow — dominant color wash bleeding outward behind the container */}
      <div
        style={{
          position:   "absolute",
          top:        "-20%",
          left:       "-20%",
          width:      "140%",
          height:     "140%",
          background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
          pointerEvents: "none",
          zIndex:     0,
          transition: "background 1s ease",
        }}
      />

      {/* Video / image container */}
      <div
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
        {/* Media — dimmed to 0.6 opacity for cinematic ambient feel */}
        {showVideo ? (
          <video
            key={videoSrc!}
            src={videoSrc!}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width:     "100%",
              height:    "100%",
              objectFit: "cover",
              display:   "block",
              opacity:   0.6,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc!}
            alt=""
            aria-hidden
            style={{
              width:     "100%",
              height:    "100%",
              objectFit: "cover",
              display:   "block",
              opacity:   0.6,
            }}
          />
        )}

        {/* Bottom gradient — fades into page background */}
        <div
          style={{
            position:   "absolute",
            bottom:     0,
            left:       0,
            right:      0,
            height:     "40%",
            background: "linear-gradient(to bottom, transparent 0%, #0A0A0A 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Top gradient — subtle top fade */}
        <div
          style={{
            position:   "absolute",
            top:        0,
            left:       0,
            right:      0,
            height:     "20%",
            background: "linear-gradient(to top, transparent 0%, rgba(0,0,0,0.3) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Left gradient — blends into left edge */}
        <div
          style={{
            position:   "absolute",
            top:        0,
            bottom:     0,
            left:       0,
            width:      "20%",
            background: "linear-gradient(to left, transparent 0%, #0A0A0A 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Right gradient — blends into right edge */}
        <div
          style={{
            position:   "absolute",
            top:        0,
            bottom:     0,
            right:      0,
            width:      "20%",
            background: "linear-gradient(to right, transparent 0%, #0A0A0A 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
