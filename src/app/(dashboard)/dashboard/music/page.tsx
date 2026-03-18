"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Music2, Link2, X, FolderOpen, Tag, Youtube, Plus, Loader2,
  Upload, Trash2, Globe, Lock, DollarSign, CheckCircle2, ImagePlus, Pencil,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import InlinePlayer from "@/components/audio/InlinePlayer";

// ─── Types ────────────────────────────────────────────────────────────────────

type Track = {
  id: string;
  title: string;
  fileUrl: string;
  coverArtUrl: string | null;
  price: number | null;
  status: "DRAFT" | "PUBLISHED";
  projectName: string | null;
  description: string | null;
  plays: number;
  downloads: number;
  createdAt: string;
};

type YTRef = {
  id: string;
  url: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  authorName: string | null;
  projectTag: string | null;
  folder: string | null;
  createdAt: string;
};

type OEmbedResult = {
  title: string;
  thumbnailUrl: string;
  authorName: string;
  videoId: string;
  url: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, authorName: data.author_name, videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  } catch { return null; }
}

// ─── My Tracks Tab ────────────────────────────────────────────────────────────

function TrackCard({ track, onDelete, onToggleStatus, onUpdate }: {
  track: Track;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: "DRAFT" | "PUBLISHED") => void;
  onUpdate: (updated: Track) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title);
  const [editProject, setEditProject] = useState(track.projectName ?? "");
  const [editPrice, setEditPrice] = useState(track.price != null ? String(track.price) : "");
  const [editStatus, setEditStatus] = useState<"DRAFT" | "PUBLISHED">(track.status);
  const [editCoverArt, setEditCoverArt] = useState<string | null>(track.coverArtUrl);
  const [editSaving, setEditSaving] = useState(false);

  const { startUpload: uploadCoverArt, isUploading: coverArtUploading } = useUploadThing("trackCoverArt", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setEditCoverArt(url);
    },
  });

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/dashboard/tracks/${track.id}`, { method: "DELETE" });
    onDelete(track.id);
  }

  async function handleToggle() {
    const next = track.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await fetch(`/api/dashboard/tracks/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    onToggleStatus(track.id, next);
  }

  function startEdit() {
    setEditTitle(track.title);
    setEditProject(track.projectName ?? "");
    setEditPrice(track.price != null ? String(track.price) : "");
    setEditStatus(track.status);
    setEditCoverArt(track.coverArtUrl);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/dashboard/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          projectName: editProject.trim() || null,
          price: editPrice ? parseFloat(editPrice) : null,
          status: editStatus,
          coverArtUrl: editCoverArt,
        }),
      });
      if (res.ok) {
        onUpdate({
          ...track,
          title: editTitle.trim(),
          projectName: editProject.trim() || null,
          price: editPrice ? parseFloat(editPrice) : null,
          status: editStatus,
          coverArtUrl: editCoverArt,
        });
        setEditing(false);
      }
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Edit mode ── */
  if (editing) {
    return (
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: "var(--card)", borderColor: "#D4A843" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Editing track</p>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title <span style={{ color: "#E85D4A" }}>*</span></label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="w-full rounded-lg border px-2.5 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Project / Album</label>
            <input value={editProject} onChange={e => setEditProject(e.target.value)} placeholder="e.g. EP Vol. 1"
              className="w-full rounded-lg border px-2.5 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price</label>
            <div className="relative">
              <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01"
                className="w-full rounded-lg border px-2.5 py-2 pl-7 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
            <div className="flex gap-1.5">
              {(["DRAFT", "PUBLISHED"] as const).map(s => (
                <button key={s} onClick={() => setEditStatus(s)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{
                    backgroundColor: editStatus === s ? (s === "PUBLISHED" ? "rgba(52,199,89,0.15)" : "var(--border)") : "transparent",
                    color: editStatus === s ? (s === "PUBLISHED" ? "#34C759" : "var(--foreground)") : "var(--muted-foreground)",
                    border: `1px solid ${editStatus === s ? "transparent" : "var(--border)"}`,
                  }}>
                  {s === "PUBLISHED" ? "Published" : "Draft"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cover Art */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
          >
            {editCoverArt
              ? <img src={editCoverArt} alt="Cover" className="w-full h-full object-cover" />
              : <Music2 size={14} className="text-muted-foreground opacity-40" />
            }
          </div>
          <label
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {coverArtUploading
              ? <><Loader2 size={11} className="animate-spin" /> Uploading…</>
              : <><ImagePlus size={11} /> {editCoverArt ? "Replace Art" : "Add Art"}</>}
            <input type="file" accept="image/*" className="sr-only" disabled={coverArtUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCoverArt([f]); e.target.value = ""; }} />
          </label>
          {editCoverArt && (
            <button onClick={() => setEditCoverArt(null)} className="text-muted-foreground hover:text-foreground" title="Remove art">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSaveEdit}
            disabled={editSaving || coverArtUploading || !editTitle.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {editSaving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : "Save Changes"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground"
            style={{ backgroundColor: "var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* ── Normal view ── */
  return (
    <div
      className="rounded-2xl border overflow-hidden flex items-center gap-4 px-5 py-4 group"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Cover art / placeholder */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
        style={{ backgroundColor: "var(--border)" }}
      >
        {track.coverArtUrl
          ? <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
          : <Music2 size={18} className="text-muted-foreground" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {track.projectName && (
            <span className="text-[11px] text-muted-foreground">{track.projectName}</span>
          )}
          {track.price != null && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <DollarSign size={9} />{track.price.toFixed(2)}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{track.plays} plays</span>
        </div>
      </div>

      {/* Status badge */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
        style={
          track.status === "PUBLISHED"
            ? { backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }
            : { backgroundColor: "var(--border)", color: "var(--muted-foreground)" }
        }
      >
        {track.status === "PUBLISHED" ? <><Globe size={10} /> Published</> : <><Lock size={10} /> Draft</>}
      </button>

      {/* Inline waveform player — delegates to persistent MiniPlayer */}
      <InlinePlayer
        track={{
          id:       track.id,
          title:    track.title,
          artist:   "",
          src:      track.fileUrl,
          coverArt: track.coverArtUrl ?? undefined,
        }}
        className="w-44 shrink-0"
      />

      {/* Edit */}
      <button
        onClick={startEdit}
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-all"
        style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
        title="Edit"
      >
        <Pencil size={12} />
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-all"
        style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
        title="Delete"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </div>
  );
}

function MyTracksTab() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingCoverArt, setPendingCoverArt] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [saving, setSaving] = useState(false);

  const { startUpload: uploadCoverArt, isUploading: coverArtUploading } = useUploadThing("trackCoverArt", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setPendingCoverArt(url);
    },
  });

  const { startUpload } = useUploadThing("artistTrack", {
    onUploadProgress: (p) => setUploadProgress(p),
  });

  useEffect(() => {
    fetch("/api/dashboard/tracks")
      .then(r => r.json())
      .then(d => { setTracks(d.tracks ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await startUpload([file]);
      if (res?.[0]?.url) {
        setPendingUrl(res[0].url);
        setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
        setShowForm(true);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [startUpload]);

  async function handleSave() {
    if (!pendingUrl || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          fileUrl: pendingUrl,
          coverArtUrl: pendingCoverArt ?? null,
          projectName: projectName.trim() || null,
          price: price ? parseFloat(price) : null,
          status,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { track: Track };
        setTracks(prev => [data.track, ...prev]);
        setPendingUrl(null); setPendingCoverArt(null); setTitle(""); setProjectName(""); setPrice(""); setStatus("DRAFT"); setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    setTracks(prev => prev.filter(t => t.id !== id));
  }

  function handleToggleStatus(id: string, newStatus: "DRAFT" | "PUBLISHED") {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  }

  function handleUpdate(updated: Track) {
    setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!showForm && (
        <label
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 cursor-pointer transition-colors hover:border-accent/60"
          style={{ borderColor: "var(--border)" }}
        >
          {uploading ? (
            <>
              <Loader2 size={28} className="text-accent animate-spin" />
              <p className="text-sm font-semibold text-foreground">Uploading… {uploadProgress}%</p>
              <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <Upload size={20} style={{ color: "#D4A843" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Drop an audio file or click to browse</p>
                <p className="text-xs text-muted-foreground mt-0.5">MP3, WAV, FLAC, AAC — up to 256MB</p>
              </div>
            </>
          )}
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      )}

      {/* Track details form after upload */}
      {showForm && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">Track uploaded — add details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title <span style={{ color: "#E85D4A" }}>*</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track title"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project / Album</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. EP Vol. 1"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price (optional)</label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01"
                  className="w-full rounded-xl border px-3 py-2.5 pl-8 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visibility</label>
              <div className="flex gap-2">
                {(["DRAFT", "PUBLISHED"] as const).map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: status === s ? (s === "PUBLISHED" ? "rgba(52,199,89,0.15)" : "var(--border)") : "transparent",
                      color: status === s ? (s === "PUBLISHED" ? "#34C759" : "var(--foreground)") : "var(--muted-foreground)",
                      border: `1px solid ${status === s ? "transparent" : "var(--border)"}`,
                    }}>
                    {s === "PUBLISHED" ? "Published" : "Draft"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cover Art */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover Art (optional)</label>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              >
                {pendingCoverArt
                  ? <img src={pendingCoverArt} alt="Cover" className="w-full h-full object-cover" />
                  : <Music2 size={18} className="text-muted-foreground opacity-40" />
                }
              </div>
              <label
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {coverArtUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : <><ImagePlus size={12} /> {pendingCoverArt ? "Replace" : "Upload Art"}</>}
                <input type="file" accept="image/*" className="sr-only" disabled={coverArtUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCoverArt([f]); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || coverArtUploading || !title.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : coverArtUploading ? "Uploading art…" : <><Music2 size={14} /> Save Track</>}
            </button>
            <button onClick={() => { setShowForm(false); setPendingUrl(null); setPendingCoverArt(null); }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground"
              style={{ backgroundColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Track list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : tracks.length === 0 && !showForm ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Music2 size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No tracks uploaded yet</p>
          <p className="text-xs text-muted-foreground">Upload your first track above to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map(track => (
            <TrackCard key={track.id} track={track} onDelete={handleDelete} onToggleStatus={handleToggleStatus} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── References Tab ───────────────────────────────────────────────────────────

function ReferencesTab() {
  const [refs, setRefs] = useState<YTRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OEmbedResult | null>(null);
  const [projectTag, setProjectTag] = useState("");
  const [folder, setFolder] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/references")
      .then(r => r.json())
      .then(d => { setRefs(d.references ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleInputChange(val: string) {
    setInput(val); setFetchError(null); setPreview(null);
    const videoId = extractVideoId(val.trim());
    if (!videoId) return;
    setFetching(true);
    const result = await fetchOEmbed(val.trim());
    setFetching(false);
    if (result) setPreview(result);
    else setFetchError("Couldn't load video info. Check the URL and try again.");
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...preview, projectTag: projectTag || null, folder: folder || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setRefs(prev => [data.reference, ...prev]);
        setInput(""); setPreview(null); setProjectTag(""); setFolder("");
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/dashboard/references/${id}`, { method: "DELETE" });
    setRefs(prev => prev.filter(r => r.id !== id));
  }

  const folders = Array.from(new Set(refs.map(r => r.folder).filter(Boolean))) as string[];
  const displayed = activeFolder ? refs.filter(r => r.folder === activeFolder) : refs;

  return (
    <div className="space-y-5">
      {/* Add reference */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Youtube size={15} className="text-red-400" />
          <h2 className="text-sm font-semibold text-foreground">Add Reference</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">YouTube URL</label>
          <div className="relative">
            <input value={input} onChange={e => handleInputChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 pr-10"
              style={{ borderColor: "var(--border)" }} />
            {fetching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
            {input && !fetching && (
              <button onClick={() => { setInput(""); setPreview(null); setFetchError(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}
        </div>

        {preview && (
          <div className="rounded-xl border overflow-hidden flex" style={{ borderColor: "var(--border)" }}>
            <img src={preview.thumbnailUrl} alt={preview.title} className="w-32 h-20 object-cover shrink-0" />
            <div className="px-4 py-3 flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{preview.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{preview.authorName}</p>
            </div>
          </div>
        )}

        {preview && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Tag size={11} /> Project Tag</label>
              <input value={projectTag} onChange={e => setProjectTag(e.target.value)} placeholder="e.g. EP Vol.1"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><FolderOpen size={11} /> Folder</label>
              <input value={folder} onChange={e => setFolder(e.target.value)} placeholder="e.g. Vibes, Trap" list="folders"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
              <datalist id="folders">{folders.map(f => <option key={f} value={f} />)}</datalist>
            </div>
          </div>
        )}

        {preview && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            <Plus size={14} />{saving ? "Saving…" : "Save Reference"}
          </button>
        )}
      </div>

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveFolder(null)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={activeFolder === null ? { backgroundColor: "var(--accent)", color: "var(--background)" } : { backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            All ({refs.length})
          </button>
          {folders.map(f => (
            <button key={f} onClick={() => setActiveFolder(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={activeFolder === f ? { backgroundColor: "var(--accent)", color: "var(--background)" } : { backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              {f} ({refs.filter(r => r.folder === f).length})
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl border py-14 text-center space-y-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Youtube size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No references yet</p>
          <p className="text-xs text-muted-foreground">Paste a YouTube URL above to save your first reference.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {displayed.map(ref => (
            <div key={ref.id} className="rounded-2xl border overflow-hidden group" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="relative">
                <a href={ref.url} target="_blank" rel="noopener noreferrer">
                  <img src={ref.thumbnailUrl} alt={ref.title} className="w-full aspect-video object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                      <Youtube size={20} className="text-white" />
                    </div>
                  </div>
                </a>
                <button onClick={() => handleDelete(ref.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/80">
                  <X size={13} />
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{ref.title}</p>
                {ref.authorName && <p className="text-xs text-muted-foreground">{ref.authorName}</p>}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {ref.projectTag && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--background)" }}>
                      <Tag size={9} /> {ref.projectTag}
                    </span>
                  )}
                  {ref.folder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                      <FolderOpen size={9} /> {ref.folder}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MusicPage() {
  const [tab, setTab] = useState<"tracks" | "references">("tracks");

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Music</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload and manage your tracks</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl border w-fit" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {([
          { key: "tracks",     label: "My Tracks",  icon: Music2 },
          { key: "references", label: "References", icon: Link2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === key
              ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
              : { color: "var(--muted-foreground)" }
            }
          >
            <Icon size={14} strokeWidth={tab === key ? 2.25 : 1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === "tracks" ? <MyTracksTab /> : <ReferencesTab />}
    </div>
  );
}
