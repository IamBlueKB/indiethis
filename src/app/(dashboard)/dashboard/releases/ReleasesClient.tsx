"use client";

/**
 * ReleasesClient — Release Board list page.
 * Shows all releases with cover art thumbnail, asset status icons, and a
 * create modal. Navigates to /dashboard/releases/[id] for the board view.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter }  from "next/navigation";
import {
  Package, Plus, Music2, Film, FileText, Disc3, Layers,
  Calendar, Loader2, ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrackBasic {
  id:          string;
  title:       string;
  coverArtUrl: string | null;
  fileUrl:     string;
}

interface ReleaseCard {
  id:              string;
  title:           string;
  trackIds:        string[];
  releaseDate:     string | null;
  coverArtJobId:   string | null;
  musicVideoId:    string | null;
  lyricVideoId:    string | null;
  canvasVideoId:   string | null;
  masteredTrackId: string | null;
  tracks:          TrackBasic[];
  coverArtJob:     { id: string; status: string; selectedUrl: string | null } | null;
  musicVideo:      { id: string; status: string; finalVideoUrl: string | null; thumbnailUrl: string | null } | null;
  lyricVideo:      { id: string; status: string; finalVideoUrl: string | null } | null;
  canvasVideoUrl:  string | null;
}

// ─── Asset icon helper ────────────────────────────────────────────────────────

function AssetDots({ release }: { release: ReleaseCard }) {
  const assets = [
    { icon: Layers, has: !!release.coverArtJob,     label: "Cover Art" },
    { icon: Film,   has: !!release.musicVideo,       label: "Music Video" },
    { icon: FileText, has: !!release.lyricVideo,     label: "Lyric Video" },
    { icon: Disc3,  has: !!release.masteredTrackId,  label: "Mastered Track" },
    { icon: Music2, has: !!release.canvasVideoUrl,   label: "Canvas Video" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {assets.map(({ icon: Icon, has, label }) => (
        <span
          key={label}
          title={label}
          style={{ color: has ? "#D4A843" : "#333" }}
        >
          <Icon size={12} />
        </span>
      ))}
    </div>
  );
}

// ─── Create Release Modal ─────────────────────────────────────────────────────

interface CreateModalProps {
  onClose:  () => void;
  onCreate: (title: string, trackIds: string[]) => Promise<void>;
}

function CreateReleaseModal({ onClose, onCreate }: CreateModalProps) {
  const [title,     setTitle]     = useState("");
  const [tracks,    setTracks]    = useState<TrackBasic[]>([]);
  const [selected,  setSelected]  = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/dashboard/music")
      .then(r => r.json())
      .then((d: { tracks?: TrackBasic[] }) => setTracks(d.tracks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleTrack(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (selected.length === 0) { setError("Select at least one track"); return; }
    setSubmitting(true);
    try {
      await onCreate(title.trim(), selected);
      onClose();
    } catch {
      setError("Failed to create release. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ backgroundColor: "#111", border: "1px solid #222" }}
      >
        <div>
          <h2 className="text-base font-bold text-white">New Release</h2>
          <p className="text-xs mt-0.5" style={{ color: "#666" }}>
            Group tracks with their creative assets in one workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white block mb-1.5">
              Release Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Elevation EP, Summer Nights"
              className="w-full px-3 py-2 rounded-lg text-sm text-white"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #2A2A2A" }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-white block mb-1.5">
              Tracks
            </label>
            {loading ? (
              <div className="flex items-center gap-2 py-3" style={{ color: "#555" }}>
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading tracks…</span>
              </div>
            ) : tracks.length === 0 ? (
              <p className="text-xs py-2" style={{ color: "#555" }}>
                No tracks found. Upload a track first.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {tracks.map(track => {
                  const isSelected = selected.includes(track.id);
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => toggleTrack(track.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all"
                      style={{
                        backgroundColor: isSelected ? "rgba(212,168,67,0.08)" : "transparent",
                        border: `1px solid ${isSelected ? "#D4A843" : "#1E1E1E"}`,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isSelected ? "#D4A843" : "#1A1A1A",
                          border: `1px solid ${isSelected ? "#D4A843" : "#333"}`,
                        }}
                      >
                        {isSelected && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {track.coverArtUrl ? (
                        <img src={track.coverArtUrl} alt={track.title} className="w-7 h-7 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded shrink-0 flex items-center justify-center" style={{ backgroundColor: "#1A1A1A" }}>
                          <Music2 size={12} style={{ color: "#444" }} />
                        </div>
                      )}
                      <span className="text-xs text-white truncate">{track.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: "#1A1A1A", color: "#888" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReleasesClient() {
  const router = useRouter();
  const [releases,   setReleases]   = useState<ReleaseCard[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchReleases = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard/releases")
      .then(r => r.json())
      .then((d: { releases?: ReleaseCard[] }) => setReleases(d.releases ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchReleases(); }, [fetchReleases]);

  async function handleCreate(title: string, trackIds: string[]) {
    const res = await fetch("/api/dashboard/releases", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title, trackIds }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Failed to create release");
    }
    const { release } = await res.json() as { release: ReleaseCard };
    // Navigate directly to the new release board
    router.push(`/dashboard/releases/${release.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} />
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (releases.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
        >
          <Package size={28} style={{ color: "#D4A843" }} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Organize your music into releases</h1>
        <p className="text-sm mb-8" style={{ color: "#666" }}>
          Group your tracks with their cover art, videos, and mastered files — all in one place.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} /> Create Your First Release
        </button>

        {showCreate && (
          <CreateReleaseModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </div>
    );
  }

  // ── Release grid ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Releases</h1>
          <p className="text-sm mt-0.5" style={{ color: "#666" }}>
            {releases.length} release{releases.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> New Release
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {releases.map(release => {
          const thumb =
            release.coverArtJob?.selectedUrl ??
            release.tracks[0]?.coverArtUrl ??
            null;

          const dateStr = release.releaseDate
            ? new Date(release.releaseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null;

          return (
            <button
              key={release.id}
              onClick={() => router.push(`/dashboard/releases/${release.id}`)}
              className="group text-left rounded-2xl overflow-hidden transition-all hover:opacity-90"
              style={{ backgroundColor: "#0F0F0F", border: "1px solid #1E1E1E" }}
            >
              {/* Thumbnail */}
              <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: "#111" }}>
                {thumb ? (
                  <img src={thumb} alt={release.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={32} style={{ color: "#222" }} />
                  </div>
                )}
                {/* track count badge */}
                <div
                  className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "#888" }}
                >
                  {release.trackIds.length} track{release.trackIds.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Info */}
              <div className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-white leading-tight">{release.title}</p>
                  <ChevronRight size={14} className="shrink-0 mt-0.5" style={{ color: "#444" }} />
                </div>

                <AssetDots release={release} />

                <div className="flex items-center gap-1" style={{ color: "#555" }}>
                  <Calendar size={10} />
                  <span className="text-[10px]">{dateStr ?? "No date set"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showCreate && (
        <CreateReleaseModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
