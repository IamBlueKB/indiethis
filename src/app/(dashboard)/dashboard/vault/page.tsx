"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Archive, Upload, Search, X, ExternalLink, Pencil, Trash2,
  Info, ChevronDown, Loader2, Check, FileText, Music2, Radio,
  Wand2, Paperclip,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type LicenseSource =
  | "SPLICE" | "SUNO" | "UDIO" | "SOUNDRAW" | "LANDR"
  | "TRACKLIB" | "LOOPCLOUD" | "AI_GENERATION"
  | "SAMPLE_CLEARANCE" | "WORK_FOR_HIRE" | "CUSTOM" | "OTHER";

type VaultDoc = {
  id:           string;
  title:        string;
  fileUrl:      string;
  fileType:     string;
  source:       LicenseSource;
  notes:        string | null;
  trackId:      string | null;
  streamLeaseId:string | null;
  aiJobId:      string | null;
  createdAt:    string;
  track:        { id: string; title: string; isBeat: boolean } | null;
  streamLease:  { id: string; trackTitle: string } | null;
  aiJob:        { id: string; type: string } | null;
};

type TrackOption = { id: string; title: string; isBeat: boolean };
type LeaseOption = { id: string; trackTitle: string };

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<LicenseSource, { label: string; bg: string; text: string }> = {
  SPLICE:           { label: "Splice",           bg: "bg-blue-500/15",    text: "text-blue-400"    },
  SUNO:             { label: "Suno",             bg: "bg-violet-500/15",  text: "text-violet-400"  },
  UDIO:             { label: "Udio",             bg: "bg-purple-500/15",  text: "text-purple-400"  },
  SOUNDRAW:         { label: "Soundraw",         bg: "bg-cyan-500/15",    text: "text-cyan-400"    },
  LANDR:            { label: "LANDR",            bg: "bg-emerald-500/15", text: "text-emerald-400" },
  TRACKLIB:         { label: "Tracklib",         bg: "bg-teal-500/15",    text: "text-teal-400"    },
  LOOPCLOUD:        { label: "Loopcloud",        bg: "bg-indigo-500/15",  text: "text-indigo-400"  },
  AI_GENERATION:    { label: "AI Generated",     bg: "bg-amber-500/15",   text: "text-amber-400"   },
  SAMPLE_CLEARANCE: { label: "Sample Clearance", bg: "bg-rose-500/15",    text: "text-rose-400"    },
  WORK_FOR_HIRE:    { label: "Work for Hire",    bg: "bg-orange-500/15",  text: "text-orange-400"  },
  CUSTOM:           { label: "Custom",           bg: "bg-stone-500/15",   text: "text-stone-400"   },
  OTHER:            { label: "Other",            bg: "bg-zinc-500/15",    text: "text-zinc-400"    },
};

const SOURCE_OPTIONS = Object.entries(SOURCE_CONFIG) as [LicenseSource, typeof SOURCE_CONFIG[LicenseSource]][];

type FilterType = "all" | "beats" | "tracks" | "leases" | "ai" | "unattached";

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "beats",      label: "Beats" },
  { key: "tracks",     label: "Tracks" },
  { key: "leases",     label: "Stream Leases" },
  { key: "ai",         label: "AI Generated" },
  { key: "unattached", label: "Unattached" },
];

const AI_JOB_LABELS: Record<string, string> = {
  VIDEO:       "AI Video",
  LYRIC_VIDEO: "Lyric Video",
  COVER_ART:   "Cover Art",
  MASTERING:   "AI Master",
  AR_REPORT:   "AR Report",
  PRESS_KIT:   "Press Kit",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: LicenseSource }) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ─── Attachment label ─────────────────────────────────────────────────────────

function AttachmentLabel({ doc }: { doc: VaultDoc }) {
  if (doc.track) {
    const Icon = doc.track.isBeat ? Music2 : Music2;
    const label = doc.track.isBeat ? "Beat" : "Track";
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon size={12} />
        <span>{label}:</span>
        <a
          href={doc.track.isBeat ? `/dashboard/producer/beats` : `/dashboard/music`}
          className="text-accent hover:underline"
        >
          {doc.track.title}
        </a>
      </span>
    );
  }
  if (doc.streamLease) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Radio size={12} />
        <span>Stream Lease:</span>
        <a href="/dashboard/stream-leases" className="text-accent hover:underline">
          {doc.streamLease.trackTitle}
        </a>
      </span>
    );
  }
  if (doc.aiJob) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Wand2 size={12} />
        <span>{AI_JOB_LABELS[doc.aiJob.type] ?? "AI Tool"}:</span>
        <a href="/dashboard/ai/video" className="text-accent hover:underline">
          View Job
        </a>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip size={12} />
      <span>Unattached</span>
    </span>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

type UploadModalProps = {
  tracks:       TrackOption[];
  streamLeases: LeaseOption[];
  onClose:      () => void;
  onCreated:    (doc: VaultDoc) => void;
  editDoc?:     VaultDoc | null;
};

function VaultModal({ tracks, streamLeases, onClose, onCreated, editDoc }: UploadModalProps) {
  const [title,         setTitle]         = useState(editDoc?.title   ?? "");
  const [source,        setSource]        = useState<LicenseSource>(editDoc?.source ?? "OTHER");
  const [notes,         setNotes]         = useState(editDoc?.notes   ?? "");
  const [attachType,    setAttachType]    = useState<"none" | "track" | "beat" | "lease">("none");
  const [attachId,      setAttachId]      = useState("");
  const [fileUrl,       setFileUrl]       = useState(editDoc?.fileUrl ?? "");
  const [fileType,      setFileType]      = useState(editDoc?.fileType ?? "");
  const [uploading,     setUploading]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Initialise attach fields from editDoc
  useEffect(() => {
    if (!editDoc) return;
    if (editDoc.trackId) {
      const t = tracks.find(x => x.id === editDoc.trackId);
      setAttachType(t?.isBeat ? "beat" : "track");
      setAttachId(editDoc.trackId);
    } else if (editDoc.streamLeaseId) {
      setAttachType("lease");
      setAttachId(editDoc.streamLeaseId);
    }
  }, [editDoc, tracks]);

  const { startUpload } = useUploadThing("licenseDocument", {
    onClientUploadComplete: (res: { url: string; type?: string }[]) => {
      if (res?.[0]) {
        setFileUrl(res[0].url);
        setFileType(res[0].type ?? "application/octet-stream");
      }
      setUploading(false);
    },
    onUploadError: () => {
      setError("Upload failed. Please try again.");
      setUploading(false);
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    await startUpload([file]);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!fileUrl && !editDoc)  { setError("Please upload a file."); return; }
    setSaving(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        title:  title.trim(),
        source,
        notes:  notes.trim() || null,
        fileUrl:  fileUrl || editDoc?.fileUrl,
        fileType: fileType || editDoc?.fileType || "application/octet-stream",
      };
      if (attachType === "track" || attachType === "beat") body.trackId = attachId || null;
      if (attachType === "lease") body.streamLeaseId = attachId || null;

      let res: Response;
      if (editDoc) {
        res = await fetch(`/api/dashboard/vault/${editDoc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/dashboard/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save document.");
        setSaving(false);
        return;
      }

      const j = await res.json();
      onCreated(j.doc);
    } catch {
      setError("Something went wrong.");
      setSaving(false);
    }
  }

  const beats  = tracks.filter(t =>  t.isBeat);
  const songs  = tracks.filter(t => !t.isBeat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-lg rounded-xl border shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold text-foreground">
            {editDoc ? "Edit Document" : "Upload Document"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Source</label>
            <div className="relative">
              <select
                value={source}
                onChange={e => setSource(e.target.value as LicenseSource)}
                className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              >
                {SOURCE_OPTIONS.map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Splice license for drum loop"
              className="w-full rounded-lg border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {editDoc ? "Replace File (optional)" : "File"}
            </label>
            {fileUrl ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <Check size={14} />
                <span>File uploaded</span>
                <button
                  onClick={() => { setFileUrl(""); setFileType(""); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="vault-file-input"
                />
                <label
                  htmlFor="vault-file-input"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm cursor-pointer transition-colors",
                    uploading
                      ? "opacity-50 cursor-wait"
                      : "text-muted-foreground hover:text-foreground hover:border-accent/50"
                  )}
                  style={{ borderColor: "var(--border)" }}
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Uploading…" : "Choose PDF or image (max 10MB)"}
                </label>
              </div>
            )}
          </div>

          {/* Attach to */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Attach to <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="relative mb-2">
              <select
                value={attachType}
                onChange={e => { setAttachType(e.target.value as typeof attachType); setAttachId(""); }}
                className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              >
                <option value="none">No attachment</option>
                {beats.length  > 0 && <option value="beat">Beat</option>}
                {songs.length  > 0 && <option value="track">Track</option>}
                {streamLeases.length > 0 && <option value="lease">Stream Lease</option>}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            {attachType === "beat" && beats.length > 0 && (
              <div className="relative">
                <select
                  value={attachId}
                  onChange={e => setAttachId(e.target.value)}
                  className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                >
                  <option value="">Select beat…</option>
                  {beats.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {attachType === "track" && songs.length > 0 && (
              <div className="relative">
                <select
                  value={attachId}
                  onChange={e => setAttachId(e.target.value)}
                  className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                >
                  <option value="">Select track…</option>
                  {songs.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {attachType === "lease" && streamLeases.length > 0 && (
              <div className="relative">
                <select
                  value={attachId}
                  onChange={e => setAttachId(e.target.value)}
                  className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                >
                  <option value="">Select stream lease…</option>
                  {streamLeases.map(l => <option key={l.id} value={l.id}>{l.trackTitle}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="License terms, sample origin, clearance info…"
              className="w-full rounded-lg border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editDoc ? "Save Changes" : "Upload Document"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel, busy }: { onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-red-400">Delete?</span>
      <button
        onClick={onConfirm}
        disabled={busy}
        className="px-2.5 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
      </button>
      <button onClick={onCancel} className="px-2.5 py-1 rounded text-xs bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
        No
      </button>
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocRow({
  doc,
  onEdit,
  onDeleted,
}: {
  doc:       VaultDoc;
  onEdit:    (doc: VaultDoc) => void;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const isAutoGenerated = !!doc.aiJobId;

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/dashboard/vault/${doc.id}`, { method: "DELETE" });
      onDeleted(doc.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div
      className="flex items-start gap-4 px-5 py-4 border-b last:border-0 hover:bg-white/2 transition-colors"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: "var(--background)" }}
      >
        <FileText size={16} className="text-muted-foreground" />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-foreground truncate max-w-[260px]">{doc.title}</span>
          <SourceBadge source={doc.source} />
          {isAutoGenerated && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400">
              Auto-generated
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AttachmentLabel doc={doc} />
          <span className="text-xs text-muted-foreground/60">{formatDate(doc.createdAt)}</span>
        </div>
        {doc.notes && (
          <p className="text-xs text-muted-foreground/70 mt-1 truncate max-w-[480px]">{doc.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {confirming ? (
          <DeleteConfirm onConfirm={handleDelete} onCancel={() => setConfirming(false)} busy={deleting} />
        ) : (
          <>
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="View"
            >
              <ExternalLink size={15} />
            </a>
            {!isAutoGenerated && (
              <button
                onClick={() => onEdit(doc)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const BANNER_KEY = "vault-banner-dismissed";

export default function VaultPage() {
  const [docs,         setDocs]         = useState<VaultDoc[]>([]);
  const [tracks,       setTracks]       = useState<TrackOption[]>([]);
  const [streamLeases, setStreamLeases] = useState<LeaseOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<FilterType>("all");
  const [search,       setSearch]       = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [editDoc,      setEditDoc]      = useState<VaultDoc | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true); // start true to avoid flash

  useEffect(() => {
    setBannerDismissed(localStorage.getItem(BANNER_KEY) === "1");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/vault");
      if (res.ok) {
        const j = await res.json();
        setDocs(j.docs ?? []);
        setTracks(j.tracks ?? []);
        setStreamLeases(j.streamLeases ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function dismissBanner() {
    localStorage.setItem(BANNER_KEY, "1");
    setBannerDismissed(true);
  }

  function openUpload() {
    setEditDoc(null);
    setShowModal(true);
  }

  function openEdit(doc: VaultDoc) {
    setEditDoc(doc);
    setShowModal(true);
  }

  function handleCreated(doc: VaultDoc) {
    if (editDoc) {
      setDocs(prev => prev.map(d => d.id === doc.id ? doc : d));
    } else {
      setDocs(prev => [doc, ...prev]);
    }
    setShowModal(false);
    setEditDoc(null);
  }

  function handleDeleted(id: string) {
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  // Filter + search
  const filtered = docs.filter(doc => {
    if (filter === "beats")      return doc.track?.isBeat === true;
    if (filter === "tracks")     return doc.track != null && !doc.track.isBeat;
    if (filter === "leases")     return doc.streamLease != null;
    if (filter === "ai")         return doc.aiJobId != null;
    if (filter === "unattached") return !doc.trackId && !doc.streamLeaseId && !doc.aiJobId;
    return true;
  }).filter(doc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      SOURCE_CONFIG[doc.source].label.toLowerCase().includes(q) ||
      doc.track?.title.toLowerCase().includes(q) ||
      doc.streamLease?.trackTitle.toLowerCase().includes(q) ||
      false
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Archive size={22} className="text-accent" />
          <h1 className="text-xl font-semibold text-foreground">License Vault</h1>
        </div>
        <button
          onClick={openUpload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
        >
          <Upload size={15} />
          Upload Document
        </button>
      </div>

      {/* Info banner */}
      {!bannerDismissed && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg border mb-5 relative"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Info size={16} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-0.5">Store your license documentation in one place</p>
            <p className="text-xs text-muted-foreground">
              Upload PDFs and images from Splice, Suno, Udio, and other sources. Attach them to specific beats, tracks,
              or stream leases. AI-generated receipts appear here automatically.
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === key
                  ? "text-[#0A0A0A]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              style={filter === key ? { backgroundColor: "var(--accent)" } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full sm:w-56 pl-8 pr-8 py-1.5 rounded-lg border text-sm text-foreground placeholder:text-muted-foreground/50 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Document list */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading vault…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Archive size={36} className="text-muted-foreground/30 mb-3" />
            {docs.length === 0 ? (
              <>
                <p className="text-sm font-medium text-foreground mb-1">Your vault is empty</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload license documents, clearance PDFs, and receipts to keep everything organized.
                </p>
                <button
                  onClick={openUpload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
                >
                  <Upload size={14} />
                  Upload your first document
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-1">No documents match</p>
                <p className="text-xs text-muted-foreground">Try a different filter or search term.</p>
              </>
            )}
          </div>
        ) : (
          filtered.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              onEdit={openEdit}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} {filtered.length === 1 ? "document" : "documents"}
          {filter !== "all" || search ? " shown" : " total"}
        </p>
      )}

      {/* Upload / Edit modal */}
      {showModal && (
        <VaultModal
          tracks={tracks}
          streamLeases={streamLeases}
          onClose={() => { setShowModal(false); setEditDoc(null); }}
          onCreated={handleCreated}
          editDoc={editDoc}
        />
      )}
    </div>
  );
}
