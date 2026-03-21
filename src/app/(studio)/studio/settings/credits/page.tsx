"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Users, ExternalLink } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { ArtistSearchInput } from "@/components/studio/ArtistSearchInput";

type StudioCredit = {
  id: string;
  artistName: string;
  artistPhotoUrl: string | null;
  projectName: string | null;
  artistSlug: string | null;
  sortOrder: number;
};

const INPUT = "w-full rounded-xl border px-4 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40";

function PhotoUploadBtn({ value, onUpload }: { value: string; onUpload: (url: string) => void }) {
  const { startUpload, isUploading } = useUploadThing("studioImages");
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await startUpload([file]);
    if (res?.[0]?.url) onUpload(res[0].url);
  }
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img src={value} alt="photo" className="w-10 h-10 rounded-full object-cover border" style={{ borderColor: "var(--border)" }} />
      ) : (
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
          <Users size={14} style={{ color: "#D4A843" }} />
        </div>
      )}
      <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
        {isUploading ? "Uploading…" : value ? "Change photo" : "Add photo (optional)"}
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isUploading} />
      </label>
      {value && <button onClick={() => onUpload("")} className="text-xs text-muted-foreground hover:text-red-400">Remove</button>}
    </div>
  );
}

export default function CreditsSettingsPage() {
  const [credits, setCredits] = useState<StudioCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ artistName: "", artistPhotoUrl: "", projectName: "", artistSlug: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/studio/credits")
      .then((r) => r.json())
      .then((d) => { setCredits(d.credits ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!form.artistName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: form.artistName,
          artistPhotoUrl: form.artistPhotoUrl || null,
          projectName: form.projectName || null,
          artistSlug: form.artistSlug || null,
          sortOrder: credits.length,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCredits((c) => [...c, data.credit]);
        setForm({ artistName: "", artistPhotoUrl: "", projectName: "", artistSlug: "" });
        setAdding(false);
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/studio/credits/${id}`, { method: "DELETE" });
    setCredits((c) => c.filter((x) => x.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Notable Artists</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Artists who record at your studio — shown in the "Who Records Here" section. Max 12.</p>
        </div>
        {credits.length < 12 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add Artist
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold text-foreground">New Credit</h3>
          <ArtistSearchInput
            className={INPUT}
            style={{ borderColor: "var(--border)" }}
            placeholder="Artist name *"
            required
            name={form.artistName}
            slug={form.artistSlug}
            onChange={(name, slug) => setForm((f) => ({ ...f, artistName: name, artistSlug: slug ?? "" }))}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photo</label>
            <PhotoUploadBtn value={form.artistPhotoUrl} onUpload={(url) => setForm((f) => ({ ...f, artistPhotoUrl: url }))} />
          </div>
          <input className={INPUT} placeholder="Project / album name (optional)" value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} style={{ borderColor: "var(--border)" }} />
          <div className="flex items-center gap-3">
            <button onClick={handleAdd} disabled={saving || !form.artistName}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
              {saving ? "Saving…" : "Save Artist"}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {credits.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <Users size={24} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No artist credits yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add artists who have recorded at your studio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {credits.map((c) => (
            <div key={c.id} className="relative rounded-xl border p-3 flex flex-col items-center gap-2 text-center group"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <button onClick={() => handleDelete(c.id)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={12} />
              </button>
              {c.artistPhotoUrl ? (
                <img src={c.artistPhotoUrl} alt={c.artistName} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#D4A843" }}>{c.artistName.charAt(0)}</span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-0.5 justify-center">
                  <p className="text-xs font-semibold text-foreground">{c.artistName}</p>
                  {c.artistSlug && <ExternalLink size={9} className="text-accent" />}
                </div>
                {c.projectName && <p className="text-[10px] text-muted-foreground">{c.projectName}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
