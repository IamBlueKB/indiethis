"use client";

import { useEffect, useState } from "react";
import {
  Music2, AlertTriangle, CheckCircle2, Plus, Pencil, Trash2,
  X, Loader2, ExternalLink, Upload, ShieldCheck, ShieldAlert,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type SampleLog = {
  id:               string;
  sampleSource:     string;
  sampleType:       string;
  isCleared:        boolean;
  clearanceMethod:  string | null;
  clearanceNotes:   string | null;
  clearanceDocUrl:  string | null;
  trackId:          string | null;
  track:            { id: string; title: string } | null;
  createdAt:        string;
  updatedAt:        string;
};

type TrackOption = { id: string; title: string };

type FormState = {
  sampleSource:    string;
  sampleType:      string;
  isCleared:       boolean;
  clearanceMethod: string;
  clearanceNotes:  string;
  clearanceDocUrl: string;
  trackId:         string;
};

const BLANK_FORM: FormState = {
  sampleSource:    "",
  sampleType:      "",
  isCleared:       false,
  clearanceMethod: "",
  clearanceNotes:  "",
  clearanceDocUrl: "",
  trackId:         "",
};

const SAMPLE_TYPES = [
  "Vocal chop",
  "Drum break",
  "Melody loop",
  "Interpolation",
  "Direct sample",
  "Sound effect",
  "Spoken word",
  "Other",
];

const CLEARANCE_METHODS = [
  "Royalty-free license",
  "Direct clearance from rights holder",
  "Fair use",
  "Public domain",
  "Created by me",
  "Sample pack license",
  "Other",
];

// ─── Modal ────────────────────────────────────────────────────────────────────

function SampleModal({
  initial,
  tracks,
  onSave,
  onClose,
}: {
  initial:  FormState & { id?: string };
  tracks:   TrackOption[];
  onSave:   (data: FormState & { id?: string }) => Promise<void>;
  onClose:  () => void;
}) {
  const [form,    setForm]    = useState<FormState>({ ...initial });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  function set(k: keyof FormState, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sampleSource.trim()) { setError("Sample source is required."); return; }
    if (!form.sampleType.trim())   { setError("Sample type is required.");   return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, id: initial.id });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border p-6 space-y-5 overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {initial.id ? "Edit Sample" : "Add Sample"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sample source */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Sample source <span className="text-red-400">*</span>
            </label>
            <input
              value={form.sampleSource}
              onChange={(e) => set("sampleSource", e.target.value)}
              placeholder="e.g. Amen Break, Splice loop name, artist name + track"
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50 focus:border-accent"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Sample type */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              value={form.sampleType}
              onChange={(e) => set("sampleType", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
            >
              <option value="">Select type…</option>
              {SAMPLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Track (optional) */}
          {tracks.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Track <span className="opacity-50">(optional)</span>
              </label>
              <select
                value={form.trackId}
                onChange={(e) => set("trackId", e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
              >
                <option value="">Not linked to a track</option>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          )}

          {/* Cleared toggle */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Clearance Status
            </label>
            <div className="flex gap-3">
              {[
                { val: false, label: "⚠️  Uncleared", color: "#E85D4A" },
                { val: true,  label: "✅  Cleared",   color: "#34C759" },
              ].map(({ val, label, color }) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => set("isCleared", val)}
                  className="flex-1 rounded-xl border py-2 text-sm font-semibold transition-all"
                  style={{
                    borderColor:     form.isCleared === val ? color           : "var(--border)",
                    backgroundColor: form.isCleared === val ? `${color}18`   : "transparent",
                    color:           form.isCleared === val ? color           : "var(--muted-foreground)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Clearance method (if cleared) */}
          {form.isCleared && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                How it was cleared
              </label>
              <select
                value={form.clearanceMethod}
                onChange={(e) => set("clearanceMethod", e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
              >
                <option value="">Select method…</option>
                {CLEARANCE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Notes <span className="opacity-50">(optional)</span>
            </label>
            <textarea
              value={form.clearanceNotes}
              onChange={(e) => set("clearanceNotes", e.target.value)}
              placeholder="Clearance details, contact info, license terms, to-do items…"
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 focus:border-accent"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Doc URL */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              License document URL <span className="opacity-50">(optional)</span>
            </label>
            <input
              value={form.clearanceDocUrl}
              onChange={(e) => set("clearanceDocUrl", e.target.value)}
              placeholder="https://…"
              type="url"
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50 focus:border-accent"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {initial.id ? "Save changes" : "Add sample"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sample row ───────────────────────────────────────────────────────────────

function SampleRow({
  sample,
  onEdit,
  onDelete,
}: {
  sample:   SampleLog;
  onEdit:   (s: SampleLog) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="grid items-center gap-3 px-4 py-3 border-b last:border-b-0 group"
      style={{
        gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 90px 80px",
        borderColor: "var(--border)",
      }}
    >
      {/* Source + type */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{sample.sampleSource}</p>
        <p className="text-[11px] text-muted-foreground">{sample.sampleType}</p>
      </div>

      {/* Track */}
      <div className="min-w-0">
        {sample.track ? (
          <Link
            href={`/dashboard/music`}
            className="text-xs text-accent hover:underline truncate flex items-center gap-1"
          >
            <Music2 size={11} />
            {sample.track.title}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Clearance method / notes */}
      <div className="min-w-0">
        {sample.isCleared ? (
          <p className="text-xs text-muted-foreground truncate">
            {sample.clearanceMethod || <span className="opacity-40">—</span>}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/50 truncate italic">
            {sample.clearanceNotes ? sample.clearanceNotes.slice(0, 40) : "No notes"}
          </p>
        )}
      </div>

      {/* Status badge */}
      <div>
        {sample.isCleared ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
          >
            <ShieldCheck size={9} /> Cleared
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
          >
            <ShieldAlert size={9} /> Pending
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {sample.clearanceDocUrl && (
          <a
            href={sample.clearanceDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="View document"
          >
            <ExternalLink size={13} className="text-muted-foreground" />
          </a>
        )}
        <button
          onClick={() => onEdit(sample)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Edit"
        >
          <Pencil size={13} className="text-muted-foreground" />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDelete(sample.id)}
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SampleTracker() {
  const [samples,       setSamples]       = useState<SampleLog[]>([]);
  const [tracks,        setTracks]        = useState<TrackOption[]>([]);
  const [unclearedCount,setUnclearedCount]= useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [showModal,     setShowModal]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<SampleLog | null>(null);

  // Filter
  const [filter, setFilter] = useState<"ALL" | "CLEARED" | "PENDING">("ALL");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/samples");
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setSamples(d.samples ?? []);
      setTracks(d.tracks ?? []);
      setUnclearedCount(d.unclearedCount ?? 0);
    } catch {
      setError("Failed to load samples.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: FormState & { id?: string }) {
    const method = data.id ? "PATCH" : "POST";
    const url    = data.id ? `/api/samples/${data.id}` : "/api/samples";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Save failed");
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/samples/${id}`, { method: "DELETE" });
    await load();
  }

  function openAdd() {
    setEditTarget(null);
    setShowModal(true);
  }

  function openEdit(s: SampleLog) {
    setEditTarget(s);
    setShowModal(true);
  }

  const displayed = samples.filter((s) => {
    if (filter === "CLEARED") return s.isCleared;
    if (filter === "PENDING") return !s.isCleared;
    return true;
  });

  const clearedCount = samples.filter((s) => s.isCleared).length;
  const totalCount   = samples.length;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div className="rounded-2xl border h-48 animate-pulse" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 pb-12">

      {/* ── Warning banner ───────────────────────────────────────────────────── */}
      {unclearedCount > 0 && (
        <div
          className="rounded-2xl border p-4 flex items-start gap-3"
          style={{ backgroundColor: "rgba(232,93,74,0.06)", borderColor: "rgba(232,93,74,0.25)" }}
        >
          <AlertTriangle size={18} style={{ color: "#E85D4A" }} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#E85D4A" }}>
              {unclearedCount} uncleared sample{unclearedCount !== 1 ? "s" : ""} need attention
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uncleared samples can block distribution and result in takedowns or legal claims.
              Clear them before releasing or distributing tracks that use them.
            </p>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(90,200,250,0.10)" }}
          >
            <Upload size={17} style={{ color: "#5AC8FA" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Sample Clearance Tracker</h1>
            <p className="text-xs text-muted-foreground">
              {totalCount === 0
                ? "Track every sample you use and its clearance status"
                : `${totalCount} sample${totalCount !== 1 ? "s" : ""} · ${clearedCount} cleared · ${unclearedCount} pending`}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
        >
          <Plus size={14} /> Add sample
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/05 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────────────── */}
      {totalCount > 0 && (
        <div className="flex gap-2">
          {(["ALL", "PENDING", "CLEARED"] as const).map((f) => {
            const count = f === "ALL" ? totalCount : f === "CLEARED" ? clearedCount : unclearedCount;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  backgroundColor: active ? (f === "PENDING" ? "rgba(232,93,74,0.12)" : f === "CLEARED" ? "rgba(52,199,89,0.12)" : "rgba(212,168,67,0.12)") : "transparent",
                  borderColor:     active ? (f === "PENDING" ? "#E85D4A"              : f === "CLEARED" ? "#34C759"              : "#D4A843")             : "var(--border)",
                  color:           active ? (f === "PENDING" ? "#E85D4A"              : f === "CLEARED" ? "#34C759"              : "#D4A843")             : "var(--muted-foreground)",
                }}
              >
                {f === "ALL" ? "All" : f === "CLEARED" ? "✅ Cleared" : "⚠️ Pending"} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header row */}
        {totalCount > 0 && (
          <div
            className="grid items-center gap-3 px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 90px 80px",
              borderColor:         "var(--border)",
              backgroundColor:     "rgba(255,255,255,0.02)",
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sample</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Track</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Method / Notes</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <span />
          </div>
        )}

        {/* Rows */}
        {displayed.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            {totalCount === 0 ? (
              <>
                <CheckCircle2 size={32} className="mx-auto" style={{ color: "rgba(255,255,255,0.08)" }} />
                <p className="text-sm text-muted-foreground">No samples logged yet</p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.20)" }}>
                  Track every sample, interpolation, or loop you use — cleared or not.
                  This protects you during distribution and licensing reviews.
                </p>
                <button
                  onClick={openAdd}
                  className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold mt-2"
                  style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                >
                  <Plus size={14} /> Log your first sample
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 size={28} className="mx-auto" style={{ color: "rgba(255,255,255,0.08)" }} />
                <p className="text-sm text-muted-foreground">No {filter.toLowerCase()} samples</p>
              </>
            )}
          </div>
        ) : (
          <>
            {displayed.map((s) => (
              <SampleRow key={s.id} sample={s} onEdit={openEdit} onDelete={handleDelete} />
            ))}
            <div
              className="px-4 py-2 text-[10px] text-muted-foreground/40 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              {displayed.length} sample{displayed.length !== 1 ? "s" : ""}
              {filter !== "ALL" ? ` · showing ${filter.toLowerCase()} only` : ""}
              {" · hover a row to edit or delete"}
            </div>
          </>
        )}
      </div>

      {/* ── Info box ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-4 flex items-start gap-3"
        style={{ backgroundColor: "rgba(90,200,250,0.04)", borderColor: "rgba(90,200,250,0.15)" }}
      >
        <ShieldCheck size={16} style={{ color: "#5AC8FA" }} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold" style={{ color: "#5AC8FA" }}>Why track samples?</p>
          <p className="text-xs text-muted-foreground">
            Distributors like DistroKid, TuneCore, and CD Baby require you to own or have cleared all content.
            Keeping records here protects you if your music is claimed or challenged.
          </p>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {showModal && (
        <SampleModal
          initial={
            editTarget
              ? {
                  id:              editTarget.id,
                  sampleSource:    editTarget.sampleSource,
                  sampleType:      editTarget.sampleType,
                  isCleared:       editTarget.isCleared,
                  clearanceMethod: editTarget.clearanceMethod ?? "",
                  clearanceNotes:  editTarget.clearanceNotes  ?? "",
                  clearanceDocUrl: editTarget.clearanceDocUrl ?? "",
                  trackId:         editTarget.trackId         ?? "",
                }
              : BLANK_FORM
          }
          tracks={tracks}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
