"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, UserCheck, ExternalLink } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { ArtistSearchInput } from "@/components/studio/ArtistSearchInput";

type StudioEngineer = {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  specialties: string[];
  bio: string | null;
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
        <img src={value} alt="photo" className="w-12 h-12 rounded-full object-cover border" style={{ borderColor: "var(--border)" }} />
      ) : (
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
          <UserCheck size={16} style={{ color: "#D4A843" }} />
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

function SpecialtiesInput({ specialties, onChange }: { specialties: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (!val || specialties.includes(val)) { setInput(""); return; }
    onChange([...specialties, val]);
    setInput("");
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input className={INPUT} placeholder="Add specialty (e.g. Hip-Hop, Mixing, Mastering)" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          style={{ borderColor: "var(--border)" }} />
        <button type="button" onClick={add}
          className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
          style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
          Add
        </button>
      </div>
      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {specialties.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
              {s}
              <button onClick={() => onChange(specialties.filter((_, j) => j !== i))} className="hover:opacity-60">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EngineersSettingsPage() {
  const [engineers, setEngineers] = useState<StudioEngineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", photoUrl: "", specialties: [] as string[], bio: "", artistSlug: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/studio/engineers")
      .then((r) => r.json())
      .then((d) => { setEngineers(d.engineers ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!form.name.trim() || !form.role.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/engineers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          photoUrl: form.photoUrl || null,
          specialties: form.specialties,
          bio: form.bio || null,
          artistSlug: form.artistSlug || null,
          sortOrder: engineers.length,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEngineers((e) => [...e, data.engineer]);
        setForm({ name: "", role: "", photoUrl: "", specialties: [], bio: "", artistSlug: "" });
        setAdding(false);
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/studio/engineers/${id}`, { method: "DELETE" });
    setEngineers((e) => e.filter((x) => x.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Engineers, producers, managers — shown in the "Our Team" section. Max 6.</p>
        </div>
        {engineers.length < 6 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
            <Plus size={14} /> Add Member
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold text-foreground">New Team Member</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <ArtistSearchInput
              className={INPUT}
              style={{ borderColor: "var(--border)" }}
              placeholder="Name *"
              required
              name={form.name}
              slug={form.artistSlug}
              onChange={(name, slug) => setForm((f) => ({ ...f, name, artistSlug: slug ?? "" }))}
            />
            <input className={INPUT} placeholder="Role * (e.g. Mix Engineer, Producer)" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ borderColor: "var(--border)" }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photo</label>
            <PhotoUploadBtn value={form.photoUrl} onUpload={(url) => setForm((f) => ({ ...f, photoUrl: url }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specialties</label>
            <SpecialtiesInput specialties={form.specialties} onChange={(v) => setForm((f) => ({ ...f, specialties: v }))} />
          </div>
          <textarea className={INPUT + " resize-none"} rows={2} placeholder="Short bio (optional)" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} style={{ borderColor: "var(--border)" }} />
          <div className="flex items-center gap-3">
            <button onClick={handleAdd} disabled={saving || !form.name || !form.role}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}>
              {saving ? "Saving…" : "Save Member"}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {engineers.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <UserCheck size={24} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No team members yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add engineers, producers, or managers to show who clients will be working with.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {engineers.map((eng) => (
            <div key={eng.id} className="relative rounded-xl border p-4 group" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <button onClick={() => handleDelete(eng.id)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
              <div className="flex items-start gap-3">
                {eng.photoUrl ? (
                  <img src={eng.photoUrl} alt={eng.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#D4A843" }}>{eng.name.charAt(0)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-foreground">{eng.name}</p>
                    {eng.artistSlug && <ExternalLink size={10} className="text-accent" />}
                  </div>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: "#D4A843" }}>{eng.role}</p>
                  {eng.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {eng.specialties.map((s, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>{s}</span>
                      ))}
                    </div>
                  )}
                  {eng.bio && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{eng.bio}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
