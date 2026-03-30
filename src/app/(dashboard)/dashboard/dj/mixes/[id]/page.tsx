"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";

interface TrackItem {
  id: string;
  position: number;
  startTime: number | null;
  title: string | null;
  artist: string | null;
  trackId: string | null;
  track: {
    id: string;
    title: string;
    user: { name: string | null; artistSlug: string | null };
  } | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTime(mmss: string): number {
  const [m, s] = mmss.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

export default function MixTracklistPage() {
  const { id } = useParams<{ id: string }>();
  const [tracklist, setTracklist]   = useState<TrackItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [identifying, setIdentifying] = useState(false);
  const [identifyMsg, setIdentifyMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [editItem, setEditItem]     = useState<TrackItem | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  // Form
  const [pos, setPos]       = useState("");
  const [timeStr, setTime]  = useState("");
  const [titleF, setTitleF] = useState("");
  const [artistF, setArtistF] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTracklist(); }, [id]);

  async function loadTracklist() {
    setLoading(true);
    const res = await fetch(`/api/dashboard/dj/mixes/${id}/tracklist`);
    if (res.ok) {
      const d = await res.json() as { tracklist: TrackItem[] };
      setTracklist(d.tracklist ?? []);
    }
    setLoading(false);
  }

  async function handleIdentify() {
    setIdentifying(true);
    setIdentifyMsg(null);
    const res = await fetch(`/api/dashboard/dj/mixes/${id}/identify`, { method: "POST" });
    if (res.ok) {
      const d = await res.json() as { identified: number };
      setIdentifyMsg(`Identified ${d.identified} tracks.`);
      loadTracklist();
    } else {
      setIdentifyMsg("Identification failed — try again later.");
    }
    setIdentifying(false);
  }

  function openAdd() {
    setEditItem(null);
    setPos(String(tracklist.length + 1));
    setTime(""); setTitleF(""); setArtistF("");
    setShowAdd(true);
  }

  function openEdit(item: TrackItem) {
    setEditItem(item);
    setPos(String(item.position));
    setTime(item.startTime != null ? formatTime(item.startTime) : "");
    setTitleF(item.title ?? "");
    setArtistF(item.artist ?? "");
    setShowAdd(true);
  }

  async function handleSave() {
    setSaving(true);
    const body = {
      position:  parseInt(pos) || 1,
      startTime: timeStr ? parseTime(timeStr) : undefined,
      title:     titleF.trim() || undefined,
      artist:    artistF.trim() || undefined,
    };

    if (editItem) {
      await fetch(`/api/dashboard/dj/mixes/${id}/tracklist/${editItem.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`/api/dashboard/dj/mixes/${id}/tracklist`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setSaving(false);
    setShowAdd(false);
    loadTracklist();
  }

  async function handleDelete(itemId: string) {
    setDeleting(itemId);
    await fetch(`/api/dashboard/dj/mixes/${id}/tracklist/${itemId}`, { method: "DELETE" });
    setDeleting(null);
    setTracklist(prev => prev.filter(t => t.id !== itemId));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/dj/mixes" className="p-1.5 rounded-lg hover:bg-zinc-800">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">Tracklist Editor</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{tracklist.length} tracks</p>
        <div className="flex gap-2">
          <button
            onClick={handleIdentify}
            disabled={identifying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
            style={{ borderColor: "var(--border)" }}
          >
            <RefreshCw className={`w-3 h-3 ${identifying ? "animate-spin" : ""}`} />
            {identifying ? "Identifying…" : "Re-run Auto-ID"}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "#D4A843", color: "#0A0A0A" }}
          >
            <Plus className="w-3 h-3" /> Add Track
          </button>
        </div>
      </div>

      {identifyMsg && (
        <div className="mb-3 p-2 rounded-lg text-xs border" style={{ borderColor: "#D4A843", background: "rgba(212,168,67,0.08)" }}>
          {identifyMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tracklist.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No tracks yet. Click &quot;Add Track&quot; or &quot;Re-run Auto-ID&quot;.
        </p>
      ) : (
        <div className="space-y-2">
          {tracklist.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs text-muted-foreground w-6 text-right">{item.position}</span>
              <span className="text-xs font-mono text-muted-foreground w-12">
                {item.startTime != null ? formatTime(item.startTime) : "—"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.track?.title ?? item.title ?? "Unknown"}
                  {item.trackId && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 align-middle" title="IndieThis track" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.artist ?? item.track?.user?.name ?? "Unknown Artist"}
                  {item.track?.user?.artistSlug && (
                    <Link
                      href={`/${item.track.user.artistSlug}`}
                      className="ml-1.5 inline-flex items-center gap-0.5 hover:underline"
                      style={{ color: "#D4A843" }}
                      target="_blank"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </p>
              </div>
              <button onClick={() => openEdit(item)} className="p-1 hover:bg-zinc-800 rounded">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deleting === item.id}
                className="p-1 hover:bg-zinc-800 rounded"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm space-y-3">
            <h2 className="text-base font-semibold">{editItem ? "Edit Track" : "Add Track"}</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Position</label>
              <input value={pos} onChange={e => setPos(e.target.value)} type="number"
                className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Time (MM:SS)</label>
              <input value={timeStr} onChange={e => setTime(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700"
                placeholder="23:45" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Title</label>
              <input value={titleF} onChange={e => setTitleF(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Artist</label>
              <input value={artistF} onChange={e => setArtistF(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "#D4A843", color: "#0A0A0A" }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
