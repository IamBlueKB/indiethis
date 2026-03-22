"use client";

import { useState } from "react";
import { Play, Video, X } from "lucide-react";
import { parseVideoUrl } from "@/lib/video-utils";
import type { VideoType, VideoCategory } from "@prisma/client";

type EmbedVideo = {
  id: string;
  url: string;
  title: string | null;
};

type UploadVideo = {
  id: string;
  title: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  category: VideoCategory | null;
  type: VideoType;
  embedUrl: string | null;
};

type Props = {
  videos?: EmbedVideo[];
  artistVideos?: UploadVideo[];
};

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  LIVE:      { bg: "rgba(232,93,74,0.85)",   color: "#fff" },
  SESSION:   { bg: "rgba(212,168,67,0.85)",  color: "#0A0A0A" },
  FREESTYLE: { bg: "rgba(255,255,255,0.85)", color: "#0A0A0A" },
  BTS:       { bg: "rgba(150,150,150,0.85)", color: "#fff" },
  ACOUSTIC:  { bg: "rgba(29,158,117,0.85)",  color: "#fff" },
  REHEARSAL: { bg: "rgba(127,119,221,0.85)", color: "#fff" },
};

// ─── Modal ────────────────────────────────────────────────────────────────────

function VideoModal({ video, onClose }: { video: UploadVideo; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 800 }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -40, right: 0,
            background: "none", border: "none", cursor: "pointer",
            color: "#fff", display: "flex", alignItems: "center", gap: 6, fontSize: 13,
          }}
        >
          <X size={18} /> Close
        </button>
        <div style={{ aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
          {video.type === "UPLOAD" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={video.videoUrl || ""}
              controls
              autoPlay
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <iframe
              src={video.embedUrl || ""}
              title={video.title}
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          )}
        </div>
        <div style={{ marginTop: 12, color: "#fff", fontSize: 14, fontWeight: 600 }}>{video.title}</div>
      </div>
    </div>
  );
}

// ─── Zone 1: Embed tile (YouTube/Vimeo) ──────────────────────────────────────

function EmbedTile({ video }: { video: EmbedVideo }) {
  const [active, setActive] = useState(false);
  const parsed = parseVideoUrl(video.url);
  if (!parsed) return null;

  const thumbnailUrl = parsed.thumbnailUrl ?? null;
  const displayTitle = video.title || "Video";

  if (active) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {parsed.type === "direct" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={parsed.embedUrl} controls autoPlay className="w-full h-full object-cover bg-black" />
        ) : (
          <iframe
            src={parsed.embedUrl}
            title={displayTitle}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: "none", position: "relative", width: "100%", height: "100%" }}
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setActive(true)}
      className="group relative w-full overflow-hidden rounded-xl text-left focus:outline-none"
      style={{ aspectRatio: "16/9", display: "block" }}
      aria-label={`Play ${displayTitle}`}
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.06)" }}>
          <Video size={32} style={{ color: "rgba(212,168,67,0.3)" }} />
        </div>
      )}
      <div className="absolute inset-0 transition-opacity group-hover:opacity-80" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center justify-center rounded-full transition-transform group-hover:scale-110"
          style={{ width: 52, height: 52, backgroundColor: "rgba(212,168,67,0.9)", color: "#0A0A0A" }}>
          <Play size={20} style={{ marginLeft: 3 }} />
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 px-3 py-2"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}>
        <p className="text-xs font-semibold text-white/90 truncate">{displayTitle}</p>
      </div>
    </button>
  );
}

// ─── Zone 2: Upload card (horizontal scroll) ──────────────────────────────────

function UploadCard({ video, onClick }: { video: UploadVideo; onClick: () => void }) {
  const catStyle = video.category ? CATEGORY_STYLES[video.category] : null;

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl text-left focus:outline-none shrink-0"
      style={{ width: 200, height: 130 }}
      aria-label={`Play ${video.title}`}
    >
      {/* Thumbnail */}
      {video.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: "#1a1a1a" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Play size={28} style={{ color: "rgba(212,168,67,0.3)" }} />
          </div>
        </div>
      )}

      {/* Dark gradient at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }} />

      {/* Hover overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(212,168,67,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Play size={14} style={{ color: "#0A0A0A", marginLeft: 2 }} />
        </div>
      </div>

      {/* Category badge */}
      {catStyle && video.category && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          backgroundColor: catStyle.bg, color: catStyle.color,
          fontSize: 8, fontWeight: 800, letterSpacing: "1px",
          padding: "3px 7px", borderRadius: 4, textTransform: "uppercase",
        }}>
          {video.category}
        </div>
      )}

      {/* Title */}
      <div style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {video.title}
        </p>
      </div>
    </button>
  );
}

// ─── Main VideoSection ────────────────────────────────────────────────────────

export default function VideoSection({ videos = [], artistVideos = [] }: Props) {
  const [activeModal, setActiveModal] = useState<UploadVideo | null>(null);

  // Zone 1: embed videos (YouTube/Vimeo) — max 4
  const embedVideos = videos.filter((v) => !!parseVideoUrl(v.url)).slice(0, 4);

  // Zone 2: upload videos — max 8
  const uploadVideos = artistVideos
    .filter((v) => (v as UploadVideo & { isPublished?: boolean }).isPublished !== false)
    .slice(0, 8);

  const hasEmbeds = embedVideos.length > 0;
  const hasUploads = uploadVideos.length > 0;

  if (!hasEmbeds && !hasUploads) return null;

  return (
    <section className="space-y-8">
      {/* Zone 1 — Official (embeds) */}
      {hasEmbeds && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase" style={{ color: "#D4A843", letterSpacing: "1.5px" }}>WATCH</p>
          <h2 className="text-[18px] font-semibold text-white leading-tight -mt-1">Videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {embedVideos.map((video) => (
              <EmbedTile key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}

      {/* Zone 2 — Live (uploads, horizontal scroll) */}
      {hasUploads && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase" style={{ color: "#D4A843", letterSpacing: "1.5px" }}>
            {hasEmbeds ? "LIVE" : "WATCH"}
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
              paddingBottom: 4,
              marginLeft: -4,
              paddingLeft: 4,
            }}
            className="hide-scrollbar"
          >
            {uploadVideos.map((video) => (
              <UploadCard key={video.id} video={video} onClick={() => setActiveModal(video)} />
            ))}
            {artistVideos.length > 8 && (
              <div style={{
                width: 120, height: 130, borderRadius: 12, flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 11, color: "#666" }}>See All</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {activeModal && (
        <VideoModal
          video={activeModal}
          onClose={() => setActiveModal(null)}
        />
      )}
    </section>
  );
}
