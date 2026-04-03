"use client";

import { useAudioStore } from "@/store/audio";

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
 * - Playing track (this artist) with canvas video → looping muted video
 * - Playing track (this artist) without canvas video → static cover art
 * - Nothing playing / different artist → latest release cover art (or canvas if available)
 * - Artist has zero tracks → renders nothing
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

  const showVideo = !!videoSrc;
  const showImage = !showVideo && !!imageSrc;

  // Nothing to show — artist has no tracks at all
  if (!showVideo && !showImage) return null;

  return (
    <div
      style={{
        position:     "relative",
        width:        280,
        maxWidth:     "100%",
        aspectRatio:  "9 / 16",
        borderRadius: 12,
        overflow:     "hidden",
        flexShrink:   0,
      }}
    >
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
          }}
        />
      )}
    </div>
  );
}
