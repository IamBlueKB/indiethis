"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { Music, Plus, Pencil, Trash2, Clock, List, Upload, Sparkles, X, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing-client";

interface Mix {
  id: string;
  title: string;
  audioUrl: string;
  coverArtUrl: string | null;
  canvasVideoUrl: string | null;
  duration: number | null;
  description: string | null;
  createdAt: string;
  _count: { tracklist: number };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Canvas section (upload + generate + preview) ─────────────────────────────

interface CanvasSectionProps {
  mix: Mix;
  onCanvasChange: (mixId: string, url: string | null) => void;
}

function CanvasSection({ mix, onCanvasChange }: CanvasSectionProps) {
  const [canvasUrl, setCanvasUrl] = useState<string | null>(mix.canvasVideoUrl);
  const [showReplaceMenu, setShowReplaceMenu] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [generatingCheckout, setGeneratingCheckout] = useState(false);
  const replaceRef = useRef<HTMLDivElement>(null);

  // Close replace menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (replaceRef.current && !replaceRef.current.contains(e.target as Node)) {
        setShowReplaceMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { startUpload, isUploading } = useUploadThing("trackCanvas", {
    onClientUploadComplete: async (res) => {
      const url = res[0]?.url;
      if (!url) return;
      await fetch("/api/dashboard/dj/mixes/canvas/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mixId: mix.id, videoUrl: url }),
      });
      setCanvasUrl(url);
      onCanvasChange(mix.id, url);
      setShowReplaceMenu(false);
    },
  });

  async function handleGenerate() {
    setGeneratingCheckout(true);
    try {
      const res = await fetch("/api/dashboard/dj/mixes/canvas/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mixId: mix.id }),
      });
      if (res.ok) {
        const d = await res.json() as { checkoutUrl: string };
        window.location.href = d.checkoutUrl;
      }
    } finally {
      setGeneratingCheckout(false);
      setShowReplaceMenu(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    await fetch(`/api/dashboard/dj/mixes/canvas/${mix.id}`, { method: "DELETE" });
    setCanvasUrl(null);
    onCanvasChange(mix.id, null);
    setRemoving(false);
  }

  function triggerUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) startUpload([file]);
    };
    input.click();
  }

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      {/* Section label */}
      <p className="text-xs font-semibold tracking-wider mb-2" style={{ color: "#D4A843" }}>
        CANVAS
      </p>

      {canvasUrl ? (
        /* ── Canvas exists ── */
        <div className="space-y-2">
          <video
            src={canvasUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full rounded-lg object-cover"
            style={{ maxHeight: 120 }}
          />
          <div className="flex items-center gap-2">
            {/* Replace dropdown */}
            <div className="relative" ref={replaceRef}>
              <button
                onClick={() => setShowReplaceMenu(v => !v)}
                disabled={isUploading || generatingCheckout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                style={{ borderColor: "#D4A843", color: "#D4A843", background: "transparent" }}
              >
                Replace <ChevronDown className="w-3 h-3" />
              </button>
              {showReplaceMenu && (
                <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-xl border bg-zinc-900 shadow-xl overflow-hidden"
                  style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                  <button
                    onClick={triggerUpload}
                    disabled={isUploading}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-zinc-800 text-left"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploading ? "Uploading…" : "Upload Video"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generatingCheckout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-zinc-800 text-left"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingCheckout ? "Redirecting…" : "Generate Canvas  $1.99"}
                  </button>
                </div>
              )}
            </div>

            {/* Remove */}
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-400/30 hover:bg-red-400/10"
            >
              <X className="w-3 h-3" />
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        /* ── No canvas ── */
        <div className="flex items-center gap-2">
          <button
            onClick={triggerUpload}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
            style={{ borderColor: "#D4A843", color: "#D4A843", background: "rgba(212,168,67,0.06)" }}
          >
            <Upload className="w-3.5 h-3.5" />
            {isUploading ? "Uploading…" : "Upload Video"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generatingCheckout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: "#E85D4A" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generatingCheckout ? "Redirecting…" : "Generate Canvas  $1.99"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Paid-return handler (reads ?paid=1&mixId= and auto-generates) ─────────────

interface PaidReturnHandlerProps {
  onGenerateComplete: (mixId: string, url: string) => void;
}

function PaidReturnHandler({ onGenerateComplete }: PaidReturnHandlerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [generatingMixId, setGeneratingMixId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const paid = searchParams.get("paid");
    const mixId = searchParams.get("mixId");
    if (paid !== "1" || !mixId || ranRef.current) return;
    ranRef.current = true;

    setGenerating(true);
    setGeneratingMixId(mixId);

    fetch("/api/dashboard/dj/mixes/canvas/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mixId }),
    })
      .then(async (res) => {
        if (res.ok) {
          const d = await res.json() as { canvasVideoUrl: string };
          onGenerateComplete(mixId, d.canvasVideoUrl);
        } else {
          const d = await res.json() as { error?: string };
          setError(d.error ?? "Canvas generation failed.");
        }
      })
      .catch(() => setError("Canvas generation failed."))
      .finally(() => {
        setGenerating(false);
        // Strip query params from URL without navigation
        router.replace("/dashboard/dj/mixes", { scroll: false });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!generating && !error) return null;

  return (
    <div
      className="mb-4 p-3 rounded-lg border text-sm flex items-center gap-2"
      style={{
        borderColor: error ? "rgba(232,93,74,0.4)" : "#D4A843",
        background: error ? "rgba(232,93,74,0.08)" : "rgba(212,168,67,0.08)",
      }}
    >
      {generating && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "#D4A843" }} />}
      {generating
        ? `Generating canvas for mix${generatingMixId ? "" : ""}… this may take a minute.`
        : error}
      {error && (
        <button className="ml-auto text-xs underline" onClick={() => setError(null)}>
          Dismiss
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DJMixesPage() {
  const [mixes, setMixes]       = useState<Mix[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMix, setEditMix]   = useState<Mix | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedCanvas, setExpandedCanvas] = useState<Set<string>>(new Set());

  // Form state
  const [title, setTitle]           = useState("");
  const [audioUrl, setAudioUrl]     = useState("");
  const [coverArtUrl, setCoverArt]  = useState("");
  const [durationMin, setDurMin]    = useState("");
  const [description, setDesc]      = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [identifying, setIdentifying] = useState<string | null>(null);

  useEffect(() => { loadMixes(); }, []);

  async function loadMixes() {
    setLoading(true);
    const res = await fetch("/api/dashboard/dj/mixes");
    if (res.ok) {
      const d = await res.json() as { mixes: Mix[] };
      setMixes(d.mixes ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditMix(null);
    setTitle(""); setAudioUrl(""); setCoverArt(""); setDurMin(""); setDesc("");
    setError(null);
    setShowModal(true);
  }

  function openEdit(mix: Mix) {
    setEditMix(mix);
    setTitle(mix.title);
    setAudioUrl(mix.audioUrl);
    setCoverArt(mix.coverArtUrl ?? "");
    setDurMin(mix.duration ? String(Math.round(mix.duration / 60)) : "");
    setDesc(mix.description ?? "");
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!title.trim() || !audioUrl.trim()) {
      setError("Title and audio URL are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      title:       title.trim(),
      audioUrl:    audioUrl.trim(),
      coverArtUrl: coverArtUrl.trim() || undefined,
      duration:    durationMin ? parseInt(durationMin) * 60 : undefined,
      description: description.trim() || undefined,
    };

    if (editMix) {
      const res = await fetch(`/api/dashboard/dj/mixes/${editMix.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("Failed to update mix."); setSaving(false); return; }
    } else {
      const res = await fetch("/api/dashboard/dj/mixes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("Failed to create mix."); setSaving(false); return; }
      const d = await res.json() as { mixId: string };
      setIdentifying(d.mixId);
    }

    setSaving(false);
    setShowModal(false);
    loadMixes();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this mix?")) return;
    setDeleting(id);
    await fetch(`/api/dashboard/dj/mixes/${id}`, { method: "DELETE" });
    setDeleting(null);
    setMixes(prev => prev.filter(m => m.id !== id));
  }

  function handleCanvasChange(mixId: string, url: string | null) {
    setMixes(prev =>
      prev.map(m => m.id === mixId ? { ...m, canvasVideoUrl: url } : m)
    );
  }

  function handleGenerateComplete(mixId: string, url: string) {
    handleCanvasChange(mixId, url);
    // Auto-expand canvas for that mix
    setExpandedCanvas(prev => new Set([...prev, mixId]));
  }

  function toggleCanvasExpand(mixId: string) {
    setExpandedCanvas(prev => {
      const next = new Set(prev);
      if (next.has(mixId)) next.delete(mixId);
      else next.add(mixId);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mixes</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage your DJ mixes</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus className="w-4 h-4" /> Upload Mix
        </button>
      </div>

      {/* Paid-return auto-generate handler */}
      <Suspense>
        <PaidReturnHandler onGenerateComplete={handleGenerateComplete} />
      </Suspense>

      {identifying && (
        <div className="mb-4 p-3 rounded-lg border text-sm" style={{ borderColor: "#D4A843", background: "rgba(212,168,67,0.08)" }}>
          Mix uploaded. Identifying tracks in the background — check back in a few minutes.
          <button className="ml-2 underline text-xs" onClick={() => setIdentifying(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading mixes…</div>
      ) : mixes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No mixes yet. Upload your first mix.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mixes.map(mix => (
            <div key={mix.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* Mix row */}
              <div className="flex items-center gap-4 p-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                  {mix.coverArtUrl
                    ? <img src={mix.coverArtUrl} alt={mix.title} className="w-full h-full object-cover" />
                    : <Music className="w-6 h-6 opacity-30" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{mix.title}</p>
                  {mix.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{mix.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {mix.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(mix.duration)}</span>}
                    <span className="flex items-center gap-1"><List className="w-3 h-3" />{mix._count.tracklist} tracks</span>
                    {mix.canvasVideoUrl && (
                      <span className="flex items-center gap-1 font-medium" style={{ color: "#D4A843" }}>
                        Canvas
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Canvas toggle */}
                  <button
                    onClick={() => toggleCanvasExpand(mix.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs border flex items-center gap-1"
                    style={{
                      borderColor: mix.canvasVideoUrl ? "#D4A843" : "var(--border)",
                      color: mix.canvasVideoUrl ? "#D4A843" : undefined,
                    }}
                    title="Canvas"
                  >
                    <Sparkles className="w-3 h-3" />
                    Canvas
                  </button>
                  <Link
                    href={`/dashboard/dj/mixes/${mix.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Tracklist
                  </Link>
                  <button onClick={() => openEdit(mix)} className="p-1.5 rounded-lg hover:bg-zinc-800">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(mix.id)}
                    disabled={deleting === mix.id}
                    className="p-1.5 rounded-lg hover:bg-zinc-800"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Canvas panel — inline below each row */}
              {expandedCanvas.has(mix.id) && (
                <div className="px-4 pb-4">
                  <CanvasSection mix={mix} onCanvasChange={handleCanvasChange} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">{editMix ? "Edit Mix" : "Upload Mix"}</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700"
                  placeholder="Summer Sessions Vol. 1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Audio URL *</label>
                <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cover Art URL</label>
                <input value={coverArtUrl} onChange={e => setCoverArt(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Duration (minutes)</label>
                <input value={durationMin} onChange={e => setDurMin(e.target.value)} type="number" min="1"
                  className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700"
                  placeholder="60" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 resize-none"
                  placeholder="Describe your mix…" />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            {!editMix && (
              <p className="text-xs text-muted-foreground">
                After uploading, tracks will be automatically identified in the background.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "#D4A843", color: "#0A0A0A" }}>
                {saving ? "Saving…" : editMix ? "Save Changes" : "Upload Mix"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
