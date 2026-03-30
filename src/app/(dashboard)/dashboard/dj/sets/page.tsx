"use client";

import { useEffect, useState } from "react";
import { Video, Plus, Edit3, Trash2, Loader2, X, Clock, MapPin, Calendar } from "lucide-react";

type DJSet = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  venue: string | null;
  date: string | null;
  createdAt: string;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function getThumbnail(set: DJSet): string | null {
  if (set.thumbnailUrl) return set.thumbnailUrl;
  const ytId = getYouTubeId(set.videoUrl);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
  return null;
}

type FormState = {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  venue: string;
  date: string;
  duration: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  videoUrl: "",
  thumbnailUrl: "",
  venue: "",
  date: "",
  duration: "",
};

function SetModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: FormState;
  onClose: () => void;
  onSave: (form: FormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function set(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{initial.title ? "Edit Set" : "Upload Set"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Title *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="Summer Vibes Set 2025"
              value={form.title}
              onChange={e => set("title", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Video URL *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="https://youtube.com/watch?v=..."
              value={form.videoUrl}
              onChange={e => set("videoUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Thumbnail URL (optional)</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="https://..."
              value={form.thumbnailUrl}
              onChange={e => set("thumbnailUrl", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Venue (optional)</label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                placeholder="Club XYZ"
                value={form.venue}
                onChange={e => set("venue", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Date (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
                style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
                value={form.date}
                onChange={e => set("date", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#888" }}>Duration in seconds (optional)</label>
            <input
              type="number"
              className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none focus:border-[#D4A843] transition-colors"
              style={{ backgroundColor: "#1a1a1a", borderColor: "#333" }}
              placeholder="3600"
              value={form.duration}
              onChange={e => set("duration", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ borderColor: "#333", color: "#888" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim() || !form.videoUrl.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : (initial.title ? "Save Changes" : "Upload Set")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DJSetsPage() {
  const [sets, setSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSet, setEditingSet] = useState<DJSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/dj/sets")
      .then(r => r.json())
      .then((d: { sets?: DJSet[]; error?: string }) => {
        if (d.error) setError(d.error);
        else setSets(d.sets ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(form: FormState) {
    setSaving(true);
    const payload = {
      title: form.title,
      videoUrl: form.videoUrl,
      thumbnailUrl: form.thumbnailUrl || null,
      venue: form.venue || null,
      date: form.date || null,
      duration: form.duration ? parseInt(form.duration, 10) : null,
    };

    if (editingSet) {
      const res = await fetch(`/api/dashboard/dj/sets/${editingSet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { set?: DJSet; error?: string };
      if (data.set) {
        setSets(prev => prev.map(s => s.id === editingSet.id ? data.set! : s));
        setEditingSet(null);
        setShowModal(false);
      }
    } else {
      const res = await fetch("/api/dashboard/dj/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { set?: DJSet; error?: string };
      if (data.set) {
        setSets(prev => [data.set!, ...prev]);
        setShowModal(false);
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this set? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/dashboard/dj/sets/${id}`, { method: "DELETE" });
    setSets(prev => prev.filter(s => s.id !== id));
    setDeletingId(null);
  }

  function openEdit(set: DJSet) {
    setEditingSet(set);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingSet(null);
  }

  const modalInitial: FormState = editingSet
    ? {
        title: editingSet.title,
        videoUrl: editingSet.videoUrl,
        thumbnailUrl: editingSet.thumbnailUrl ?? "",
        venue: editingSet.venue ?? "",
        date: editingSet.date ? editingSet.date.split("T")[0] : "",
        duration: editingSet.duration != null ? String(editingSet.duration) : "",
      }
    : EMPTY_FORM;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: "#D4A843" }}>DJ</p>
          <h1 className="text-2xl font-bold text-white">Sets</h1>
          <p className="text-sm mt-1" style={{ color: "#888" }}>Your recorded sets and mixes</p>
        </div>
        <button
          onClick={() => { setEditingSet(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} />
          Upload Set
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border text-sm" style={{ backgroundColor: "#1a0a0a", borderColor: "#3a1a1a", color: "#f87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      ) : sets.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl" style={{ borderColor: "#2a2a2a" }}>
          <Video size={40} className="mx-auto mb-4" style={{ color: "#333" }} />
          <p className="text-white font-semibold mb-2">No sets yet</p>
          <p className="text-sm mb-6" style={{ color: "#666" }}>Upload your first recorded set or mix.</p>
          <button
            onClick={() => { setEditingSet(null); setShowModal(true); }}
            className="px-5 py-2.5 rounded-lg text-sm font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Upload Set
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map(set => {
            const thumb = getThumbnail(set);
            return (
              <div
                key={set.id}
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: "#141414", borderColor: "#2a2a2a" }}
              >
                <div className="relative w-full aspect-video" style={{ backgroundColor: "#1a1a1a" }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={set.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video size={28} style={{ color: "#444" }} />
                    </div>
                  )}
                  {set.duration != null && (
                    <span
                      className="absolute bottom-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: "rgba(0,0,0,0.8)", color: "#fff" }}
                    >
                      {formatDuration(set.duration)}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-white truncate mb-1">{set.title}</p>
                  <div className="flex flex-col gap-0.5 mb-3">
                    {set.venue && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} style={{ color: "#555" }} />
                        <span className="text-[11px] truncate" style={{ color: "#888" }}>{set.venue}</span>
                      </div>
                    )}
                    {set.date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} style={{ color: "#555" }} />
                        <span className="text-[11px]" style={{ color: "#888" }}>
                          {new Date(set.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}
                    {set.duration != null && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} style={{ color: "#555" }} />
                        <span className="text-[11px]" style={{ color: "#888" }}>{formatDuration(set.duration)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(set)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-[#D4A843] hover:text-[#D4A843]"
                      style={{ borderColor: "#333", color: "#888" }}
                    >
                      <Edit3 size={11} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(set.id)}
                      disabled={deletingId === set.id}
                      className="flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-red-500 hover:text-red-500"
                      style={{ borderColor: "#333", color: "#888" }}
                    >
                      {deletingId === set.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <SetModal
          initial={modalInitial}
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
