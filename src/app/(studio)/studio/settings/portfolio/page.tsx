"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Music, ExternalLink } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { ArtistSearchInput } from "@/components/studio/ArtistSearchInput";

type PortfolioTrack = {
  id: string;
  title: string;
  artistName: string;
  audioUrl: string;
  coverUrl: string | null;
  description: string | null;
  artistSlug: string | null;
  sortOrder: number;
};

const INPUT = "w-full rounded-xl border px-4 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40";

function AudioUploadBtn({ value, onUpload }: { value: string; onUpload: (url: string) => void }) {
  const { startUpload, isUploading } = useUploadThing("studioAudio");
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await startUpload([file]);
    if (res?.[0]?.url) onUpload(res[0].url);
  }
  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Music size={14} className="text-accent shrink-0" />
        <span className="text-foreground truncate max-w-xs">Audio uploaded</span>
        <button onClick={() => onUpload("")} className="text-muted-foreground hover:text-red-400 text-xs">Remove</button>
      </div>
    );
  }
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
      <Music size={14} />
      {isUploading ? "Uploading…" : "Upload audio file"}
      <input type="file" accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a" className="sr-only" onChange={handleFile} disabled={isUploading} />
    </label>
  );
}

function ImageUploadBtn({ value, onUpload }: { value: string; onUpload: (url: string) => void }) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await startUpload([file]);
    if (res?.[0]?.url) onUpload(res[0].url);
  }
  return (
    <div className="flex items-center gap-3">
      {value && (
        <img src={value} alt="cover" className="w-12 h-12 rounded-lg object-cover border" style={{ borderColor: "var(--border)" }} />
      )}
      <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
        {isUploading ? "Uploading…" : value ? "Change cover" : "Add cover art (optional)"}
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isUploading} />
      </label>
    </div>
  );
}

export default function PortfolioSettingsPage() {
  const [tracks, setTracks] = useState<PortfolioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", artistName: "", audioUrl: "", coverUrl: "", description: "", artistSlug: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/studio/portfolio")
      .then((r) => r.json())
      .then((d) => { setTracks(d.tracks ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!form.title.trim() || !form.artistName.trim() || !form.audioUrl) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sortOrder: tracks.length,
          coverUrl: form.coverUrl || null,
          description: form.description || null,
          artistSlug: form.artistSlug || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTracks((t) => [...t, data.track]);
        setForm({ title: "", artistName: "", audioUrl: "", coverUrl: "", description: "", artistSlug: "" });
        setAdding(false);
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/studio/portfolio/${id}`, { method: "DELETE" });
    setTracks((t) => t.filter((x) => x.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Audio Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tracks mixed or mastered at your studio — shown in the "Hear Our Work" section. Max 6.</p>
        </div>
        {tracks.length < 6 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add Track
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold text-foreground">New Track</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={INPUT} placeholder="Track title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ borderColor: "var(--border)" }} />
            <ArtistSearchInput
              className={INPUT}
              style={{ borderColor: "var(--border)" }}
              placeholder="Artist name *"
              required
              name={form.artistName}
              slug={form.artistSlug}
              onChange={(name, slug) => setForm((f) => ({ ...f, artistName: name, artistSlug: slug ?? "" }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audio File *</label>
            <AudioUploadBtn value={form.audioUrl} onUpload={(url) => setForm((f) => ({ ...f, audioUrl: url }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover Art</label>
            <ImageUploadBtn value={form.coverUrl} onUpload={(url) => setForm((f) => ({ ...f, coverUrl: url }))} />
          </div>
          <textarea className={INPUT + " resize-none"} rows={2} placeholder="Short description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ borderColor: "var(--border)" }} />
          <div className="flex items-center gap-3">
            <button onClick={handleAdd} disabled={saving || !form.title || !form.artistName || !form.audioUrl}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
              {saving ? "Saving…" : "Save Track"}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Track list */}
      {tracks.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <Music size={24} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No portfolio tracks yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add tracks that were mixed or mastered at your studio.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <GripVertical size={14} className="text-muted-foreground shrink-0" />
              {t.coverUrl && <img src={t.coverUrl} alt={t.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {t.artistSlug ? (
                    <a href={`/${t.artistSlug}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-accent hover:opacity-80 transition-opacity flex items-center gap-0.5 no-underline">
                      {t.artistName} <ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t.artistName}</span>
                  )}
                  {t.description && <span className="text-xs text-muted-foreground">· {t.description}</span>}
                </div>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
