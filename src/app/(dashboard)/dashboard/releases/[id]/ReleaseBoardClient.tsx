"use client";

/**
 * ReleaseBoardClient — visual workspace for a single release.
 *
 * Shows:
 *   - Editable title + release date
 *   - Horizontal scrollable track row
 *   - 5 asset cards (Cover Art, Music Video, Lyric Video, Mastered Track, Canvas Video)
 *
 * Design rules:
 *   - No red Xs, no "Missing" labels, no progress bars
 *   - Empty asset cards show a subtle placeholder + small secondary CTA
 *   - Linked assets show the content prominently with action buttons
 */

import { useState, useRef }  from "react";
import { useRouter }         from "next/navigation";
import {
  ArrowLeft, Calendar, Music2, Film, FileText, Disc3, Layers,
  Check, Pencil, Trash2, ChevronLeft, ChevronRight, Play, Download, ExternalLink,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrackBasic {
  id:            string;
  title:         string;
  coverArtUrl:   string | null;
  fileUrl:       string;
  canvasVideoUrl: string | null;
}

interface ReleaseData {
  id:              string;
  title:           string;
  releaseDate:     string | null;
  trackIds:        string[];
  coverArtJobId:   string | null;
  musicVideoId:    string | null;
  lyricVideoId:    string | null;
  canvasVideoId:   string | null;
  masteredTrackId: string | null;
}

interface CoverArtJobData {
  id:           string;
  status:       string;
  selectedUrl:  string | null;
  variationUrls: unknown;
}

interface MusicVideoData {
  id:            string;
  status:        string;
  finalVideoUrl: string | null;
  thumbnailUrl:  string | null;
}

interface LyricVideoData {
  id:            string;
  status:        string;
  finalVideoUrl: string | null;
}

interface Props {
  release:       ReleaseData;
  tracks:        TrackBasic[];
  coverArtJob:   CoverArtJobData | null;
  musicVideo:    MusicVideoData  | null;
  lyricVideo:    LyricVideoData  | null;
  canvasVideoUrl: string | null;
  firstTrackId:  string | null;
}

// ─── Inline title editor ──────────────────────────────────────────────────────

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);

  function handleBlur() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === "Enter") handleBlur(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="text-2xl font-black text-white bg-transparent border-b outline-none w-full"
        style={{ borderColor: "#D4A843" }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 group"
    >
      <h1 className="text-2xl font-black text-white">{value}</h1>
      <Pencil size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#555" }} />
    </button>
  );
}

// ─── Asset card wrapper ───────────────────────────────────────────────────────

function AssetCard({
  icon: Icon,
  label,
  hasContent,
  children,
}: {
  icon: React.ElementType;
  label: string;
  hasContent: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{
        backgroundColor: "#0F0F0F",
        border:           `1px solid ${hasContent ? "#1E1E1E" : "#161616"}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: hasContent ? "#D4A843" : "#333" }} />
        <p className="text-xs font-semibold" style={{ color: hasContent ? "#888" : "#444" }}>{label}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Individual asset cards ───────────────────────────────────────────────────

function CoverArtCard({ job, firstTrackId }: { job: CoverArtJobData | null; firstTrackId: string | null }) {
  const href = "/dashboard/ai/cover-art" + (firstTrackId ? `?trackId=${firstTrackId}` : "");

  if (!job || job.status !== "COMPLETE" || !job.selectedUrl) {
    return (
      <AssetCard icon={Layers} label="Cover Art" hasContent={false}>
        <div
          className="aspect-square rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "#111" }}
        >
          <Layers size={32} style={{ color: "#1E1E1E" }} />
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#555" }}
        >
          Create Cover Art <ExternalLink size={10} />
        </a>
      </AssetCard>
    );
  }

  return (
    <AssetCard icon={Layers} label="Cover Art" hasContent>
      <img
        src={job.selectedUrl}
        alt="Cover Art"
        className="w-full aspect-square rounded-xl object-cover"
      />
      <div className="flex gap-2">
        <a
          href={job.selectedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: "#2A2A2A", color: "#888" }}
        >
          <ExternalLink size={10} /> View
        </a>
        <a
          href={href}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: "#2A2A2A", color: "#888" }}
        >
          <Pencil size={10} /> Change
        </a>
      </div>
    </AssetCard>
  );
}

function MusicVideoCard({ video, firstTrackId }: { video: MusicVideoData | null; firstTrackId: string | null }) {
  const href = "/dashboard/ai/video" + (firstTrackId ? `?trackId=${firstTrackId}` : "");

  if (!video || video.status !== "COMPLETE" || !video.finalVideoUrl) {
    return (
      <AssetCard icon={Film} label="Music Video" hasContent={false}>
        <div
          className="aspect-video rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "#111" }}
        >
          <Film size={28} style={{ color: "#1E1E1E" }} />
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#555" }}
        >
          Create Music Video <ExternalLink size={10} />
        </a>
      </AssetCard>
    );
  }

  return (
    <AssetCard icon={Film} label="Music Video" hasContent>
      <div className="relative aspect-video rounded-xl overflow-hidden" style={{ backgroundColor: "#111" }}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="Music Video" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={24} style={{ color: "#333" }} />
          </div>
        )}
        <a
          href={`/video-studio/${video.id}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <Play size={16} className="ml-0.5" style={{ color: "#fff" }} />
          </div>
        </a>
      </div>
      <div className="flex gap-2">
        <a
          href={`/video-studio/${video.id}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: "#2A2A2A", color: "#888" }}
        >
          <Play size={10} /> Watch
        </a>
        <a
          href={href}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: "#2A2A2A", color: "#888" }}
        >
          <Pencil size={10} /> Change
        </a>
      </div>
    </AssetCard>
  );
}

function LyricVideoCard({ video, firstTrackId }: { video: LyricVideoData | null; firstTrackId: string | null }) {
  const href = "/lyric-video" + (firstTrackId ? `?trackId=${firstTrackId}` : "");

  if (!video || video.status !== "COMPLETE" || !video.finalVideoUrl) {
    return (
      <AssetCard icon={FileText} label="Lyric Video" hasContent={false}>
        <div
          className="aspect-video rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "#111" }}
        >
          <FileText size={28} style={{ color: "#1E1E1E" }} />
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#555" }}
        >
          Create Lyric Video <ExternalLink size={10} />
        </a>
      </AssetCard>
    );
  }

  return (
    <AssetCard icon={FileText} label="Lyric Video" hasContent>
      <div className="aspect-video rounded-xl overflow-hidden" style={{ backgroundColor: "#111" }}>
        <video
          src={video.finalVideoUrl}
          controls
          className="w-full h-full object-contain"
          style={{ backgroundColor: "#000" }}
        />
      </div>
      <div className="flex gap-2">
        <a
          href={video.finalVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: "#2A2A2A", color: "#888" }}
        >
          <Download size={10} /> Download
        </a>
        <a
          href={href}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: "#2A2A2A", color: "#888" }}
        >
          <Pencil size={10} /> Change
        </a>
      </div>
    </AssetCard>
  );
}

function MasteredTrackCard({ masteredTrackId, firstTrackId }: { masteredTrackId: string | null; firstTrackId: string | null }) {
  const href = "/dashboard/ai/mastering" + (firstTrackId ? `?trackId=${firstTrackId}` : "");

  if (!masteredTrackId) {
    return (
      <AssetCard icon={Disc3} label="Mastered Track" hasContent={false}>
        <div
          className="h-16 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "#111" }}
        >
          <Disc3 size={28} style={{ color: "#1E1E1E" }} />
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#555" }}
        >
          Master This Track <ExternalLink size={10} />
        </a>
      </AssetCard>
    );
  }

  return (
    <AssetCard icon={Disc3} label="Mastered Track" hasContent>
      <div
        className="h-16 rounded-xl flex items-center justify-center gap-3"
        style={{ backgroundColor: "#111" }}
      >
        <Disc3 size={20} style={{ color: "#D4A843" }} />
        <span className="text-xs font-semibold" style={{ color: "#D4A843" }}>Mastered ✓</span>
      </div>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
        style={{ borderColor: "#2A2A2A", color: "#888" }}
      >
        <ExternalLink size={10} /> Open Mastering
      </a>
    </AssetCard>
  );
}

function CanvasVideoCard({ canvasVideoUrl, firstTrackId }: { canvasVideoUrl: string | null; firstTrackId: string | null }) {
  const href = "/dashboard/ai/canvas" + (firstTrackId ? `?trackId=${firstTrackId}` : "");

  if (!canvasVideoUrl) {
    return (
      <AssetCard icon={Music2} label="Canvas Video" hasContent={false}>
        <div
          className="aspect-video rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "#111" }}
        >
          <Music2 size={28} style={{ color: "#1E1E1E" }} />
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "#555" }}
        >
          Create Canvas Video <ExternalLink size={10} />
        </a>
      </AssetCard>
    );
  }

  return (
    <AssetCard icon={Music2} label="Canvas Video" hasContent>
      <div className="aspect-video rounded-xl overflow-hidden" style={{ backgroundColor: "#111" }}>
        <video
          src={canvasVideoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
        style={{ borderColor: "#2A2A2A", color: "#888" }}
      >
        <ExternalLink size={10} /> View
      </a>
    </AssetCard>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReleaseBoardClient({
  release: initialRelease,
  tracks,
  coverArtJob,
  musicVideo,
  lyricVideo,
  canvasVideoUrl,
  firstTrackId,
}: Props) {
  const router = useRouter();
  const [release,  setRelease]  = useState(initialRelease);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const trackRowRef = useRef<HTMLDivElement>(null);

  async function patchRelease(data: Partial<ReleaseData>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/releases/${release.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (res.ok) {
        const { release: updated } = await res.json() as { release: ReleaseData };
        setRelease(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${release.title}"? This won't delete your tracks or creative assets.`)) return;
    setDeleting(true);
    await fetch(`/api/dashboard/releases/${release.id}`, { method: "DELETE" });
    router.push("/dashboard/releases");
  }

  function scrollTracks(dir: "left" | "right") {
    const el = trackRowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  }

  const activeFirstTrackId = tracks[0]?.id ?? firstTrackId;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Back + header */}
      <div className="space-y-4">
        <button
          onClick={() => router.push("/dashboard/releases")}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "#555" }}
        >
          <ArrowLeft size={14} /> All Releases
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <EditableTitle
              value={release.title}
              onSave={title => patchRelease({ title })}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: "#555" }}>
                {release.trackIds.length} track{release.trackIds.length !== 1 ? "s" : ""}
              </span>
              {saving && <Loader2 size={12} className="animate-spin" style={{ color: "#555" }} />}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Release date picker */}
            <div className="relative">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border" style={{ borderColor: "#2A2A2A" }}>
                <Calendar size={12} style={{ color: "#555" }} />
                <input
                  type="date"
                  defaultValue={release.releaseDate ? release.releaseDate.slice(0, 10) : ""}
                  onChange={e => patchRelease({ releaseDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="text-xs bg-transparent outline-none"
                  style={{ color: release.releaseDate ? "#888" : "#444", colorScheme: "dark" }}
                />
              </div>
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg border transition"
              style={{ borderColor: "#2A2A2A", color: "#555" }}
              title="Delete release"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Track list — horizontal scroll */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#444" }}>
          Tracks
        </p>
        <div className="relative">
          {tracks.length > 3 && (
            <>
              <button
                onClick={() => scrollTracks("left")}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #333" }}
              >
                <ChevronLeft size={14} style={{ color: "#888" }} />
              </button>
              <button
                onClick={() => scrollTracks("right")}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #333" }}
              >
                <ChevronRight size={14} style={{ color: "#888" }} />
              </button>
            </>
          )}
          <div
            ref={trackRowRef}
            className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
            style={{ scrollbarWidth: "none" }}
          >
            {tracks.map(track => (
              <div
                key={track.id}
                className="shrink-0 w-36 rounded-xl overflow-hidden"
                style={{ backgroundColor: "#0F0F0F", border: "1px solid #1E1E1E" }}
              >
                {track.coverArtUrl ? (
                  <img src={track.coverArtUrl} alt={track.title} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center" style={{ backgroundColor: "#111" }}>
                    <Music2 size={20} style={{ color: "#222" }} />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                  {track.fileUrl && (
                    <audio src={track.fileUrl} controls className="w-full mt-1" style={{ height: "24px" }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Creative Assets grid */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#444" }}>
          Creative Assets
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CoverArtCard   job={coverArtJob}  firstTrackId={activeFirstTrackId} />
          <MusicVideoCard video={musicVideo} firstTrackId={activeFirstTrackId} />
          <LyricVideoCard video={lyricVideo} firstTrackId={activeFirstTrackId} />
          <MasteredTrackCard masteredTrackId={release.masteredTrackId} firstTrackId={activeFirstTrackId} />
          <CanvasVideoCard   canvasVideoUrl={canvasVideoUrl}            firstTrackId={activeFirstTrackId} />
        </div>
      </div>

    </div>
  );
}
