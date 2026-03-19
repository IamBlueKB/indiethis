"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Loader2, Video, ExternalLink, AlertCircle } from "lucide-react";
import { parseVideoUrl, videoPlatformLabel } from "@/lib/video-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ArtistVideo = {
  id:        string;
  url:       string;
  title:     string | null;
  sortOrder: number;
  createdAt: string;
};

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function VideoThumbnail({ url }: { url: string }) {
  const parsed = parseVideoUrl(url);

  if (parsed?.type === "youtube" && parsed.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={parsed.thumbnailUrl}
        alt=""
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Video size={24} style={{ color: "rgba(212,168,67,0.4)" }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VideosPage() {
  const [videos,  setVideos]  = useState<ArtistVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [urlInput,   setUrlInput]   = useState("");
  const [titleInput, setTitleInput] = useState("");
  const urlRef = useRef<HTMLInputElement>(null);

  // ── Load existing videos ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/videos")
      .then((r) => r.json())
      .then(({ videos }) => setVideos(videos ?? []))
      .finally(() => setLoading(false));
  }, []);

  // ── Live URL validation ─────────────────────────────────────────────────────
  const parsed     = urlInput.trim() ? parseVideoUrl(urlInput.trim()) : null;
  const urlIsValid = !!parsed;
  const platform   = parsed ? videoPlatformLabel(parsed.type) : null;

  // ── Add video ───────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!urlIsValid || adding) return;
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/dashboard/videos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: urlInput.trim(), title: titleInput.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add video"); return; }
      setVideos((prev) => [...prev, data.video]);
      setUrlInput("");
      setTitleInput("");
      urlRef.current?.focus();
    } catch {
      setError("Network error — please try again");
    } finally {
      setAdding(false);
    }
  }

  // ── Delete video ────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    await fetch(`/api/dashboard/videos/${id}`, { method: "DELETE" });
  }

  const atLimit = videos.length >= 6;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Videos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add up to 6 videos to your public artist page. Supports YouTube, Vimeo, and direct video files.
        </p>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl border p-5 space-y-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold text-foreground">Add a Video</h2>

        {/* URL input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Video URL
          </label>
          <div className="relative">
            <input
              ref={urlRef}
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
              placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
              className="w-full px-3 py-2.5 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
              style={{
                borderColor: urlInput && !urlIsValid ? "#E85D4A" : "var(--border)",
              }}
              disabled={atLimit}
            />
            {/* Platform badge */}
            {urlIsValid && platform && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
              >
                {platform}
              </span>
            )}
          </div>
          {urlInput && !urlIsValid && (
            <p className="text-xs" style={{ color: "#E85D4A" }}>
              Unrecognised URL — paste a YouTube, Vimeo, or direct .mp4/.webm link
            </p>
          )}
        </div>

        {/* Title input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Title <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="e.g. Official Music Video"
            maxLength={80}
            className="w-full px-3 py-2.5 rounded-lg border text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1"
            style={{ borderColor: "var(--border)" }}
            disabled={atLimit}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#E85D4A" }}>
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        {/* Limit notice */}
        {atLimit && (
          <p className="text-xs text-muted-foreground">
            You&apos;ve reached the 6-video limit. Remove a video to add another.
          </p>
        )}

        <button
          type="submit"
          disabled={!urlIsValid || adding || atLimit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Video
        </button>
      </form>

      {/* Video list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : videos.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed flex flex-col items-center justify-center py-12 gap-3"
          style={{ borderColor: "var(--border)" }}
        >
          <Video size={28} className="text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No videos yet</p>
          <p className="text-xs text-muted-foreground opacity-60">
            Add a YouTube or Vimeo link above to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">
            {videos.length} / 6 videos
          </p>
          {videos.map((video) => {
            const p = parseVideoUrl(video.url);
            return (
              <div
                key={video.id}
                className="flex items-center gap-4 rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {/* Thumbnail */}
                <div
                  className="w-20 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: "rgba(212,168,67,0.06)" }}
                >
                  <VideoThumbnail url={video.url} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {video.title || (p ? videoPlatformLabel(p.type) + " Video" : "Video")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {video.url}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    title="Open video"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => handleDelete(video.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Remove video"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
