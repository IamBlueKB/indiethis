"use client";

import { useEffect, useState } from "react";
import { Music, Plus, Pencil, Trash2, Clock, List } from "lucide-react";
import Link from "next/link";

interface Mix {
  id: string;
  title: string;
  audioUrl: string;
  coverArtUrl: string | null;
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

export default function DJMixesPage() {
  const [mixes, setMixes]       = useState<Mix[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMix, setEditMix]   = useState<Mix | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
            <div key={mix.id} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
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
                </div>
              </div>
              <div className="flex items-center gap-2">
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
