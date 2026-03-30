"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Music2, Trash2, Loader2, Save, Users, UserPlus, X,
  Check, ChevronDown,
} from "lucide-react";

type CrateDetail = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  djProfileId: string;
};

type CrateItemTrack = {
  id: string;
  trackId: string;
  notes: string | null;
  addedAt: string;
  track: {
    id: string;
    title: string;
    coverArtUrl: string | null;
    fileUrl: string;
    genre: string | null;
    bpm: number | null;
    musicalKey: string | null;
    artist: {
      id: string;
      name: string;
      artistName: string | null;
      artistSlug: string | null;
      artistSite: { isPublished: boolean } | null;
    };
  };
};

type Collaborator = {
  djProfileId: string;
  djProfile: { slug: string; user: { name: string; photo: string | null } };
};

const MUSICAL_KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm",
  "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm",
];

type SortKey = "addedAt" | "bpmAsc" | "bpmDesc" | "key" | "artist";

export default function CrateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [crate, setCrate] = useState<CrateDetail | null>(null);
  const [items, setItems] = useState<CrateItemTrack[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("addedAt");
  const [filterBpmMin, setFilterBpmMin] = useState("");
  const [filterBpmMax, setFilterBpmMax] = useState("");
  const [filterKey, setFilterKey] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSlug, setInviteSlug] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/dashboard/dj/crates/${id}/items`).then(r => r.json()),
      fetch(`/api/dashboard/dj/crates/${id}/collaborators`).then(r => r.json()).catch(() => ({ collaborators: [] })),
    ]).then(([itemsData, collabData]) => {
      const d = itemsData as { items?: CrateItemTrack[]; crate?: CrateDetail };
      setItems(d.items ?? []);
      if (d.crate) setCrate(d.crate);
      setCollaborators((collabData as { collaborators?: Collaborator[] }).collaborators ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function handleRemove(trackId: string) {
    setRemovingId(trackId);
    await fetch(`/api/dashboard/dj/crates/${id}/items/${trackId}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.trackId !== trackId));
    setRemovingId(null);
  }

  async function handleSaveNotes(trackId: string) {
    setSavingNotes(trackId);
    const notes = editingNotes[trackId] ?? "";
    await fetch(`/api/dashboard/dj/crates/${id}/items/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null }),
    });
    setItems(prev => prev.map(i => i.trackId === trackId ? { ...i, notes: notes || null } : i));
    setSavingNotes(null);
  }

  async function handleInvite() {
    if (!inviteSlug.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    const res = await fetch(`/api/dj/crates/${id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ djSlug: inviteSlug.trim() }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { setInviteMsg(data.error ?? "Failed to send invite."); }
    else { setInviteMsg("Invite sent!"); setInviteSlug(""); }
    setInviting(false);
    setTimeout(() => setInviteMsg(null), 3000);
  }

  // Filter
  const filtered = items.filter(item => {
    const bpm = item.track.bpm;
    const key = item.track.musicalKey;
    const genre = item.track.genre;
    if (filterBpmMin && bpm !== null && bpm < parseInt(filterBpmMin)) return false;
    if (filterBpmMax && bpm !== null && bpm > parseInt(filterBpmMax)) return false;
    if (filterKey && key !== filterKey) return false;
    if (filterGenre && genre?.toLowerCase() !== filterGenre.toLowerCase()) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "bpmAsc":  return (a.track.bpm ?? 0) - (b.track.bpm ?? 0);
      case "bpmDesc": return (b.track.bpm ?? 0) - (a.track.bpm ?? 0);
      case "key":     return (a.track.musicalKey ?? "").localeCompare(b.track.musicalKey ?? "");
      case "artist":  return (a.track.artist.artistName ?? a.track.artist.name).localeCompare(b.track.artist.artistName ?? b.track.artist.name);
      default:        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} />
      </div>
    );
  }

  const genres = Array.from(new Set(items.map(i => i.track.genre).filter(Boolean))) as string[];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link href="/dashboard/dj/crates" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Back to Crates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{crate?.name ?? "Crate"}</h1>
          {crate?.description && <p className="text-sm text-muted-foreground mt-0.5">{crate.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">{items.length} track{items.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-accent/10"
          style={{ borderColor: "rgba(212,168,67,0.4)", color: "#D4A843" }}
        >
          <UserPlus size={13} /> Invite Collaborator
        </button>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Invite a DJ</p>
          <div className="flex gap-2">
            <input
              value={inviteSlug}
              onChange={e => setInviteSlug(e.target.value)}
              placeholder="DJ slug (e.g. dj-nova)"
              className="flex-1 rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteSlug.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {inviting ? <Loader2 size={13} className="animate-spin" /> : "Send"}
            </button>
          </div>
          {inviteMsg && (
            <p className="text-xs" style={{ color: inviteMsg.includes("!") ? "#34C759" : "#ef4444" }}>{inviteMsg}</p>
          )}
        </div>
      )}

      {/* Collaborators */}
      {collaborators.length > 0 && (
        <div className="flex items-center gap-2">
          <Users size={13} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Collaborators:</p>
          {collaborators.map(c => (
            <span key={c.djProfileId} className="text-xs font-semibold text-foreground">{c.djProfile.user.name}</span>
          ))}
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sort</label>
          <div className="relative">
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="rounded-xl border px-3 py-2 text-xs bg-transparent text-foreground outline-none appearance-none pr-6 cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="addedAt">Date Added</option>
              <option value="bpmAsc">BPM ↑</option>
              <option value="bpmDesc">BPM ↓</option>
              <option value="key">Key</option>
              <option value="artist">Artist</option>
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BPM Range</label>
          <div className="flex items-center gap-1">
            <input
              value={filterBpmMin}
              onChange={e => setFilterBpmMin(e.target.value)}
              placeholder="Min"
              type="number"
              className="w-16 rounded-xl border px-2 py-2 text-xs bg-transparent text-foreground outline-none"
              style={{ borderColor: "var(--border)" }}
            />
            <span className="text-muted-foreground text-xs">–</span>
            <input
              value={filterBpmMax}
              onChange={e => setFilterBpmMax(e.target.value)}
              placeholder="Max"
              type="number"
              className="w-16 rounded-xl border px-2 py-2 text-xs bg-transparent text-foreground outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Key</label>
          <div className="relative">
            <select
              value={filterKey}
              onChange={e => setFilterKey(e.target.value)}
              className="rounded-xl border px-3 py-2 text-xs bg-transparent text-foreground outline-none appearance-none pr-6 cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">Any</option>
              {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {genres.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Genre</label>
            <div className="relative">
              <select
                value={filterGenre}
                onChange={e => setFilterGenre(e.target.value)}
                className="rounded-xl border px-3 py-2 text-xs bg-transparent text-foreground outline-none appearance-none pr-6 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">Any</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Track list */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Music2 size={32} className="mx-auto text-muted-foreground opacity-20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "No tracks in this crate yet." : "No tracks match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => {
            const artist = item.track.artist;
            const artistName = artist.artistName ?? artist.name;
            const artistSlug = artist.artistSite?.isPublished ? artist.artistSlug : null;
            const isEditingNotes = editingNotes[item.trackId] !== undefined;
            const notesValue = isEditingNotes ? editingNotes[item.trackId] : (item.notes ?? "");

            return (
              <div
                key={item.id}
                className="rounded-xl border p-3 space-y-2"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  {/* Cover art */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "var(--background)" }}>
                    {item.track.coverArtUrl
                      ? <img src={item.track.coverArtUrl} alt={item.track.title} className="w-full h-full object-cover" />
                      : <Music2 size={16} className="m-auto text-muted-foreground opacity-40" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.track.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {artistSlug
                        ? <Link href={`/${artistSlug}`} className="text-xs text-muted-foreground hover:underline truncate">{artistName}</Link>
                        : <span className="text-xs text-muted-foreground truncate">{artistName}</span>
                      }
                      {item.track.bpm && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                          {item.track.bpm} BPM
                        </span>
                      )}
                      {item.track.musicalKey && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--background)", color: "var(--muted-foreground)" }}>
                          {item.track.musicalKey}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(item.trackId)}
                    disabled={removingId === item.trackId}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 disabled:opacity-50 shrink-0"
                  >
                    {removingId === item.trackId
                      ? <Loader2 size={12} className="animate-spin text-red-400" />
                      : <Trash2 size={12} style={{ color: "#ef4444" }} />
                    }
                  </button>
                </div>

                {/* DJ Notes */}
                <div className="flex items-start gap-2">
                  <textarea
                    value={notesValue}
                    onChange={e => setEditingNotes(prev => ({ ...prev, [item.trackId]: e.target.value }))}
                    onFocus={() => {
                      if (!isEditingNotes) setEditingNotes(prev => ({ ...prev, [item.trackId]: item.notes ?? "" }));
                    }}
                    rows={1}
                    placeholder="Add private notes for this track…"
                    className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs bg-transparent text-foreground outline-none resize-none focus:ring-1 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                  {isEditingNotes && (
                    <div className="flex gap-1 mt-0.5">
                      <button
                        onClick={() => {
                          const n = { ...editingNotes };
                          delete n[item.trackId];
                          setEditingNotes(n);
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5"
                      >
                        <X size={11} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleSaveNotes(item.trackId)}
                        disabled={savingNotes === item.trackId}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-accent/10 disabled:opacity-50"
                      >
                        {savingNotes === item.trackId
                          ? <Loader2 size={11} className="animate-spin" style={{ color: "#D4A843" }} />
                          : <Save size={11} style={{ color: "#D4A843" }} />
                        }
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
