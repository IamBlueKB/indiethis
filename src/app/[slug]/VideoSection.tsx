"use client";

import { useState, useEffect } from "react";
import { Play, Video } from "lucide-react";
import { parseVideoUrl } from "@/lib/video-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type VideoItem = {
  id:    string;
  url:   string;
  title: string | null;
};

// ─── Vimeo thumbnail fetcher ──────────────────────────────────────────────────
// Fetches the thumbnail URL from Vimeo's oEmbed API client-side.

function useVimeoThumb(videoId: string | null) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}&width=480`)
      .then((r) => r.json())
      .then((d) => { if (d.thumbnail_url) setThumb(d.thumbnail_url); })
      .catch(() => {/* silent fail — placeholder shown */});
  }, [videoId]);

  return thumb;
}

// ─── Single video tile ────────────────────────────────────────────────────────

function VideoTile({ video }: { video: VideoItem }) {
  const [active, setActive] = useState(false);
  const parsed = parseVideoUrl(video.url);

  // Vimeo thumbnails fetched client-side; YouTube thumbnails are static URLs.
  const vimeoThumb  = useVimeoThumb(
    parsed?.type === "vimeo" ? (parsed.videoId ?? null) : null,
  );

  const thumbnailUrl =
    parsed?.thumbnailUrl ??
    (parsed?.type === "vimeo" ? vimeoThumb : null);

  const displayTitle = video.title || (parsed ? labelForType(parsed.type) : "Video");

  if (!parsed) return null;

  // ── Active: show iframe / native video ────────────────────────────────────
  if (active) {
    return (
      <div className="rounded-xl overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
        {parsed.type === "direct" ? (
          // Native video element for direct files
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={parsed.embedUrl}
            controls
            autoPlay
            className="w-full h-full object-cover bg-black"
          />
        ) : (
          // iframe for YouTube / Vimeo
          <iframe
            src={parsed.embedUrl}
            title={displayTitle}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: "none" }}
          />
        )}
      </div>
    );
  }

  // ── Inactive: thumbnail + play overlay ───────────────────────────────────
  return (
    <button
      onClick={() => setActive(true)}
      className="group relative w-full overflow-hidden rounded-xl text-left focus:outline-none"
      style={{ aspectRatio: "16/9" }}
      aria-label={`Play ${displayTitle}`}
    >
      {/* Thumbnail */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(212,168,67,0.06)" }}
        >
          <Video size={32} style={{ color: "rgba(212,168,67,0.3)" }} />
        </div>
      )}

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0 transition-opacity group-hover:opacity-80"
        style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full transition-transform group-hover:scale-110"
          style={{
            width:           52,
            height:          52,
            backgroundColor: "rgba(212,168,67,0.9)",
            color:           "#0A0A0A",
          }}
        >
          <Play size={20} style={{ marginLeft: 3 }} />
        </div>
      </div>

      {/* Title bar */}
      <div
        className="absolute bottom-0 inset-x-0 px-3 py-2"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        }}
      >
        <p className="text-xs font-semibold text-white/90 truncate">{displayTitle}</p>
      </div>
    </button>
  );
}

function labelForType(type: "youtube" | "vimeo" | "direct") {
  if (type === "youtube") return "YouTube Video";
  if (type === "vimeo")   return "Vimeo Video";
  return "Video";
}

// ─── VideoSection ─────────────────────────────────────────────────────────────

export default function VideoSection({ videos }: { videos: VideoItem[] }) {
  // Filter out any URLs that can't be parsed (safety net)
  const valid = videos.filter((v) => !!parseVideoUrl(v.url)).slice(0, 6);

  if (!valid.length) return null;

  return (
    <section className="space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Videos</h2>

      {/* 1-col on mobile, 2-col on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {valid.map((video) => (
          <VideoTile key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}
