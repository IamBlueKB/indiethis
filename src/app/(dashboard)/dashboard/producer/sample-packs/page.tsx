"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  Archive, Plus, Trash2, Edit2, Upload, CheckCircle2, Loader2,
  Music2, AlertCircle, ExternalLink, Play, Pause, ChevronDown,
  DollarSign, ShoppingBag, Eye, EyeOff, X,
} from "lucide-react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type SamplePack = {
  id:                 string;
  title:              string;
  price:              number;
  description:        string | null;
  genre:              string | null;
  coverArtUrl:        string | null;
  published:          boolean;
  samplePackFileUrl:  string | null;
  samplePackFileSize: number | null;
  sampleCount:        number | null;
  previewSampleUrls:  string[] | null;
  createdAt:          string;
  _count:             { purchases: number };
};

type PackForm = {
  title:       string;
  description: string;
  price:       string;
  genre:       string;
  coverArtUrl: string;
};

const GENRE_OPTIONS = [
  "Hip-Hop", "Trap", "R&B", "Soul", "Pop", "Electronic", "House",
  "Techno", "Drum & Bass", "Lo-Fi", "Ambient", "Jazz", "Gospel",
  "Afrobeats", "Dancehall", "Reggaeton", "Latin", "Other",
];

const EMPTY_FORM: PackForm = {
  title: "", description: "", price: "29.99", genre: "", coverArtUrl: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Mini audio preview player ────────────────────────────────────────────────

function PreviewPlayer({ url, label }: { url: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { void audioRef.current.play().then(() => setPlaying(true)); }
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd = () => setPlaying(false);
    el.addEventListener("ended", onEnd);
    return () => { el.removeEventListener("ended", onEnd); el.pause(); };
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <audio ref={audioRef} src={url} preload="none" />
      <button onClick={toggle}
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: playing ? "#E85D4A" : "#D4A843" }}>
        {playing ? <Pause size={10} style={{ color: "#fff" }} /> : <Play size={10} style={{ color: "#0A0A0A" }} />}
      </button>
      <p className="text-xs truncate text-gray-300 flex-1">{label}</p>
    </div>
  );
}

// ─── Pack Card ────────────────────────────────────────────────────────────────

function PackCard({
  pack,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  pack:            SamplePack;
  onEdit:          (p: SamplePack) => void;
  onDelete:        (id: string) => void;
  onTogglePublish: (p: SamplePack) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const previews = pack.previewSampleUrls ?? [];

  const canPublish = !!(pack.samplePackFileUrl && previews.length > 0);

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "#111", borderColor: pack.published ? "rgba(212,168,67,0.3)" : "#222" }}>
      {/* Top row */}
      <div className="flex items-start gap-3 p-4">
        {/* Cover art */}
        <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          {pack.coverArtUrl ? (
            <Image src={pack.coverArtUrl} alt={pack.title} width={56} height={56} className="object-cover w-full h-full" />
          ) : (
            <Archive size={22} className="text-gray-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{pack.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {pack.genre && <span className="text-[10px] text-gray-500">{pack.genre}</span>}
                {pack.sampleCount && (
                  <span className="text-[10px] text-gray-500">{pack.sampleCount} samples</span>
                )}
                {pack.samplePackFileSize && (
                  <span className="text-[10px] text-gray-500">{fmtSize(pack.samplePackFileSize)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                pack.published ? "text-emerald-400 bg-emerald-400/10" : "text-yellow-400 bg-yellow-400/10"
              }`}>
                {pack.published ? "Live" : "Draft"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="font-semibold" style={{ color: "#D4A843" }}>${(pack.price / 100).toFixed(2)}</span>
            <span>{pack._count.purchases} sold</span>
            <span>{fmtDate(pack.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Previews */}
      {expanded && previews.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          {previews.map((url, i) => (
            <PreviewPlayer key={url} url={url} label={`Preview ${i + 1}`} />
          ))}
        </div>
      )}

      {/* Warnings */}
      {!pack.samplePackFileUrl && (
        <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)", color: "#EAB308" }}>
          <AlertCircle size={12} />
          No zip file uploaded yet
        </div>
      )}
      {pack.samplePackFileUrl && previews.length === 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)", color: "#EAB308" }}>
          <AlertCircle size={12} />
          Select preview samples before publishing
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4 border-t pt-3" style={{ borderColor: "#1a1a1a" }}>
        {previews.length > 0 && (
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : undefined }} />
            {expanded ? "Hide" : "Preview"} samples
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => onEdit(pack)}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <Edit2 size={13} className="text-gray-400" />
          </button>
          {pack._count.purchases === 0 && (
            <button onClick={() => onDelete(pack.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
              <Trash2 size={13} className="text-red-400" />
            </button>
          )}
          <button
            onClick={() => onTogglePublish(pack)}
            disabled={!canPublish && !pack.published}
            title={!canPublish && !pack.published ? "Upload zip + select previews to publish" : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              pack.published
                ? { backgroundColor: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }
                : { backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.3)" }
            }
          >
            {pack.published ? <><EyeOff size={11} /> Unpublish</> : <><Eye size={11} /> Publish</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function PackModal({
  pack,
  onClose,
  onSaved,
}: {
  pack:    SamplePack | null;
  onClose: () => void;
  onSaved: (p: SamplePack) => void;
}) {
  const isEdit = !!pack;
  const [form,        setForm]        = useState<PackForm>(pack ? {
    title:       pack.title,
    description: pack.description ?? "",
    price:       (pack.price / 100).toFixed(2),
    genre:       pack.genre ?? "",
    coverArtUrl: pack.coverArtUrl ?? "",
  } : { ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  // ── Zip upload state ──
  const [zipFile,     setZipFile]     = useState<File | null>(null);
  const [zipUploading, setZipUploading] = useState(false);
  const [zipScanning, setZipScanning] = useState(false);
  const [zipResult,   setZipResult]   = useState<{ sampleCount: number; fileSize: number; files: string[] } | null>(
    pack?.samplePackFileUrl ? { sampleCount: pack.sampleCount ?? 0, fileSize: pack.samplePackFileSize ?? 0, files: [] } : null
  );
  const [zipUrl,      setZipUrl]      = useState<string>(pack?.samplePackFileUrl ?? "");
  const [zipError,    setZipError]    = useState("");

  // ── Preview selection state ──
  const [fileList,     setFileList]    = useState<string[]>([]);
  const [selectedPrev, setSelectedPrev] = useState<string[]>(pack?.previewSampleUrls ?? []);
  const [prevUploading, setPrevUploading] = useState(false);
  const [savedPrevUrls, setSavedPrevUrls] = useState<string[]>(pack?.previewSampleUrls ?? []);

  // ── Cover art upload ──
  const { startUpload: uploadCover } = useUploadThing("albumArt", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) setForm((f) => ({ ...f, coverArtUrl: res[0].url }));
    },
  });
  const { startUpload: uploadZip } = useUploadThing("samplePackZip", {
    onClientUploadComplete: async (res) => {
      if (!res?.[0]?.url) { setZipError("Upload failed"); setZipUploading(false); return; }
      const url = res[0].url;
      setZipUrl(url);
      setZipUploading(false);
      setZipScanning(true);
      setZipError("");
      // Validate server-side
      try {
        const r = await fetch("/api/dashboard/sample-packs/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl:  url,
            fileSize: zipFile?.size ?? 0,
            ...(pack ? { digitalProductId: pack.id } : {}),
          }),
        });
        const d = await r.json() as { success?: boolean; sampleCount?: number; fileSize?: number; files?: string[]; error?: string };
        if (!r.ok || !d.success) { setZipError(d.error ?? "Validation failed"); setZipUrl(""); }
        else {
          setZipResult({ sampleCount: d.sampleCount ?? 0, fileSize: d.fileSize ?? 0, files: d.files ?? [] });
          setFileList(d.files ?? []);
        }
      } catch { setZipError("Network error during scan"); setZipUrl(""); }
      finally { setZipScanning(false); }
    },
    onUploadError: (err) => {
      setZipError(err.message || "Upload failed");
      setZipUploading(false);
    },
  });

  function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) { setZipError("Please upload a .zip file"); return; }
    if (file.size > 200 * 1024 * 1024) { setZipError("Zip file must be under 200MB"); return; }
    setZipFile(file);
    setZipError("");
    setZipResult(null);
    setZipUrl("");
    setFileList([]);
    setZipUploading(true);
    void uploadZip([file]);
  }

  function togglePreview(name: string) {
    setSelectedPrev((prev) => {
      if (prev.includes(name)) return prev.filter((x) => x !== name);
      if (prev.length >= 5) return prev;
      return [...prev, name];
    });
  }

  async function savePreviews(packId: string) {
    if (selectedPrev.length === 0) return;
    // Only save previews that are filenames (not already-uploaded URLs)
    const filenames = selectedPrev.filter((s) => !s.startsWith("http"));
    if (filenames.length === 0) return; // all previews already uploaded
    setPrevUploading(true);
    try {
      const r = await fetch(`/api/dashboard/sample-packs/${packId}/previews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: filenames }),
      });
      const d = await r.json() as { previewUrls?: string[]; error?: string };
      if (r.ok && d.previewUrls) {
        setSavedPrevUrls(d.previewUrls);
        setSelectedPrev(d.previewUrls);
      } else {
        setZipError(d.error ?? "Failed to save preview samples");
      }
    } finally { setPrevUploading(false); }
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    const priceCents = Math.round(parseFloat(form.price) * 100);
    if (isNaN(priceCents) || priceCents < 99 || priceCents > 19999) {
      setError("Price must be between $0.99 and $199.99");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let packId = pack?.id;
      const body = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        price:       priceCents,
        genre:       form.genre || null,
        coverArtUrl: form.coverArtUrl || null,
      };

      if (isEdit && packId) {
        const r = await fetch(`/api/dashboard/sample-packs/${packId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json() as SamplePack & { error?: string };
        if (!r.ok) { setError(d.error ?? "Save failed"); return; }
        // Save zip URL if changed
        if (zipUrl && zipUrl !== pack?.samplePackFileUrl) {
          await fetch(`/api/dashboard/sample-packs/${packId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              samplePackFileUrl: zipUrl,
              samplePackFileSize: zipResult?.fileSize,
              sampleCount: zipResult?.sampleCount,
            }),
          });
        }
        if (selectedPrev.some((s) => !s.startsWith("http"))) {
          await savePreviews(packId);
        }
        onSaved({ ...d, previewSampleUrls: savedPrevUrls.length > 0 ? savedPrevUrls : d.previewSampleUrls });
      } else {
        const r = await fetch("/api/dashboard/sample-packs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json() as SamplePack & { error?: string };
        if (!r.ok) { setError(d.error ?? "Create failed"); return; }
        packId = d.id;
        // Save previews for new pack
        if (selectedPrev.some((s) => !s.startsWith("http"))) {
          await savePreviews(packId);
        }
        onSaved({ ...d, samplePackFileUrl: zipUrl || null, sampleCount: zipResult?.sampleCount ?? null, samplePackFileSize: zipResult?.fileSize ?? null, previewSampleUrls: savedPrevUrls });
      }
      onClose();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  const showFileList = fileList.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: "#111", border: "1px solid rgba(212,168,67,0.2)" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b z-10"
          style={{ backgroundColor: "#111", borderColor: "#222" }}>
          <h2 className="text-base font-bold text-white">{isEdit ? "Edit Sample Pack" : "New Sample Pack"}</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Title *</label>
            <input type="text" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="808 Essentials Vol. 1"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What's in the pack? Style, BPM range, key, vibe..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {/* Price + Genre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Price (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#D4A843" }}>$</span>
                <input type="number" step="0.01" min="0.99" max="199.99"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Genre</label>
              <select value={form.genre}
                onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="">Select...</option>
                {GENRE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Cover Art */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Cover Art</label>
            <div className="flex items-center gap-3">
              {form.coverArtUrl && (
                <Image src={form.coverArtUrl} alt="cover" width={48} height={48}
                  className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-medium"
                style={{ border: "1px solid rgba(212,168,67,0.3)", color: "#D4A843" }}>
                <Upload size={12} />
                {form.coverArtUrl ? "Change" : "Upload"} Cover
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) void uploadCover([e.target.files[0]]); }} />
              </label>
            </div>
          </div>

          {/* Zip Upload */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Sample Pack ZIP *</label>
            <p className="text-[11px] text-gray-600 mb-2">
              Must contain only audio files (.wav, .mp3, .flac, .aiff, .ogg). Max 200MB. Scanned for malware automatically.
            </p>

            {zipUploading || zipScanning ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ backgroundColor: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.2)" }}>
                <Loader2 size={14} className="animate-spin" style={{ color: "#D4A843" }} />
                <span className="text-gray-300">{zipUploading ? "Uploading..." : "Scanning & validating..."}</span>
              </div>
            ) : zipResult ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ backgroundColor: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)" }}>
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-emerald-300">
                  {zipResult.sampleCount} samples · {fmtSize(zipResult.fileSize)} — clean
                </span>
                <label className="ml-auto text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                  Replace
                  <input type="file" accept=".zip" className="hidden" onChange={handleZipChange} />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl cursor-pointer transition-colors"
                style={{ border: "2px dashed rgba(212,168,67,0.3)", backgroundColor: "rgba(212,168,67,0.03)" }}>
                <Archive size={24} className="text-gray-600" />
                <span className="text-sm text-gray-400">Drop .zip here or click to upload</span>
                <span className="text-xs text-gray-600">Max 200MB</span>
                <input type="file" accept=".zip" className="hidden" onChange={handleZipChange} />
              </label>
            )}
            {zipError && <p className="text-xs mt-2" style={{ color: "#E85D4A" }}>{zipError}</p>}
          </div>

          {/* Preview Sample Selection */}
          {showFileList && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Preview Samples <span className="text-gray-600">({selectedPrev.filter(s => !s.startsWith("http")).length}/5 selected)</span>
              </label>
              <p className="text-[11px] text-gray-600 mb-2">
                Select 1–5 samples buyers can hear before purchasing.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1"
                style={{ scrollbarWidth: "thin" }}>
                {fileList.map((name) => {
                  const checked = selectedPrev.includes(name);
                  const baseName = name.split("/").pop() ?? name;
                  return (
                    <button key={name}
                      onClick={() => togglePreview(name)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors"
                      style={{
                        backgroundColor: checked ? "rgba(212,168,67,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${checked ? "rgba(212,168,67,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${checked ? "bg-[#D4A843] border-[#D4A843]" : "border-gray-600"}`}>
                        {checked && <CheckCircle2 size={10} style={{ color: "#0A0A0A" }} />}
                      </div>
                      <Music2 size={11} className="text-gray-500 shrink-0" />
                      <span className="truncate text-gray-300">{baseName}</span>
                    </button>
                  );
                })}
              </div>
              {prevUploading && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <Loader2 size={12} className="animate-spin" />
                  Extracting and uploading preview files...
                </div>
              )}
            </div>
          )}

          {/* Already-saved previews (edit mode) */}
          {isEdit && savedPrevUrls.length > 0 && fileList.length === 0 && (
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Current Preview Samples</label>
              <div className="space-y-1.5">
                {savedPrevUrls.map((url, i) => (
                  <PreviewPlayer key={url} url={url} label={`Preview ${i + 1}`} />
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                Upload a new zip to change preview selections.
              </p>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#E85D4A" }}>{error}</p>}

          <button onClick={() => void handleSave()}
            disabled={saving || zipUploading || zipScanning || prevUploading}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Sample Pack"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SamplePacksPage() {
  const [packs,   setPacks]   = useState<SamplePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<"create" | SamplePack | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/dashboard/sample-packs");
    if (r.ok) setPacks(await r.json() as SamplePack[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this sample pack?")) return;
    setDeleting(id);
    const r = await fetch(`/api/dashboard/sample-packs/${id}`, { method: "DELETE" });
    if (r.ok) { setPacks((prev) => prev.filter((p) => p.id !== id)); }
    setDeleting(null);
  }

  async function handleTogglePublish(pack: SamplePack) {
    const r = await fetch(`/api/dashboard/sample-packs/${pack.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !pack.published }),
    });
    if (r.ok) {
      const d = await r.json() as SamplePack;
      setPacks((prev) => prev.map((p) => p.id === d.id ? { ...p, published: d.published } : p));
    }
  }

  function handleSaved(updated: SamplePack) {
    setPacks((prev) => {
      const exists = prev.find((p) => p.id === updated.id);
      if (exists) return prev.map((p) => p.id === updated.id ? updated : p);
      return [updated, ...prev];
    });
  }

  const totalSales  = packs.reduce((s, p) => s + p._count.purchases, 0);
  const liveCount   = packs.filter((p) => p.published).length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sample Packs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sell audio samples to other producers. IndieThis takes 10%.</p>
        </div>
        <button onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
          <Plus size={14} />
          New Pack
        </button>
      </div>

      {/* Stats */}
      {packs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Packs",  value: packs.length,  icon: Archive },
            { label: "Live",         value: liveCount,      icon: Eye },
            { label: "Total Sales",  value: totalSales,     icon: ShoppingBag },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className="text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      {packs.length === 0 && !loading && (
        <div className="rounded-2xl border p-6 text-center"
          style={{ backgroundColor: "rgba(212,168,67,0.04)", borderColor: "rgba(212,168,67,0.15)" }}>
          <Archive size={32} className="mx-auto mb-3 text-gray-600" />
          <h3 className="text-base font-semibold text-white mb-2">Start selling sample packs</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            Upload a zip of audio samples, select up to 5 previews for buyers to hear, set your price, and publish. You keep 90%.
          </p>
          <div className="grid grid-cols-3 gap-3 text-left mb-5">
            {[
              { step: "1", label: "Upload ZIP", desc: "Only audio files allowed. Auto-scanned for malware." },
              { step: "2", label: "Pick Previews", desc: "Choose 1–5 samples buyers can hear before purchasing." },
              { step: "3", label: "Publish & Earn", desc: "Buyers get a download link. You earn 90% of every sale." },
            ].map(({ step, label, desc }) => (
              <div key={step} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1a1a1a" }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mb-2"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>{step}</div>
                <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
                <p className="text-[10px] text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setModal("create")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            <Plus size={14} /> Create First Pack
          </button>
        </div>
      )}

      {/* Pack list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((p) => (
            <div key={p.id} style={{ opacity: deleting === p.id ? 0.5 : 1 }}>
              <PackCard
                pack={p}
                onEdit={(pack) => setModal(pack)}
                onDelete={handleDelete}
                onTogglePublish={handleTogglePublish}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <PackModal
          pack={modal === "create" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(p) => { handleSaved(p); setModal(null); }}
        />
      )}
    </div>
  );
}
