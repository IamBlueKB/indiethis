"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  Upload, Edit2, Trash2, ExternalLink, Music, ChevronDown, X,
  ListMusic, Radio, FileText, DollarSign, Loader2, Check, AlertCircle,
} from "lucide-react";
import LicenseAttachment from "@/components/shared/LicenseAttachment";

// ─── Types ────────────────────────────────────────────────────────────────────

type Beat = {
  id: string;
  title: string;
  fileUrl: string;
  coverArtUrl: string | null;
  price: number | null;
  status: "DRAFT" | "PUBLISHED";
  bpm: number | null;
  musicalKey: string | null;
  audioHash: string | null;
  projectName: string | null;
  description: string | null;
  createdAt: string;
  activeLeaseCount: number;
  totalLeaseCount: number;
  licensesCount: number;
  totalPlays: number;
  beatLeaseSettings: {
    streamLeaseEnabled: boolean;
    maxStreamLeases: number | null;
    creditFormat: string;
    revocationPolicy: string;
    contentRestrictions: string[];
    customRestriction: string | null;
  } | null;
};

type ProducerStats = {
  totalBeats: number;
  totalActiveLeases: number;
  totalLicenses: number;
  totalRevenue: number;
};

type BeatFormData = {
  title: string;
  price: string;
  leasePrice: string;
  nonExclusivePrice: string;
  exclusivePrice: string;
  description: string;
  status: "DRAFT" | "PUBLISHED";
  bpm: string;
  musicalKey: string;
  streamLeaseEnabled: boolean;
  maxStreamLeases: string;
  creditFormat: string;
  revocationPolicy: string;
  contentRestrictions: string[];
  customRestriction: string;
};

const RESTRICTION_OPTIONS = [
  "No explicit content",
  "No political content",
  "No religious content",
  "No commercial use beyond streaming",
  "Credit producer in all releases",
];

const REVOCATION_LABELS: Record<string, string> = {
  A: "30-day notice",
  B: "Violation only",
  C: "Cannot revoke",
};

const KEY_OPTIONS = [
  "C major","C minor","C# major","C# minor","D major","D minor",
  "D# major","D# minor","E major","E minor","F major","F minor",
  "F# major","F# minor","G major","G minor","G# major","G# minor",
  "A major","A minor","A# major","A# minor","B major","B minor",
];

const EMPTY_FORM: BeatFormData = {
  title: "", price: "", leasePrice: "", nonExclusivePrice: "",
  exclusivePrice: "", description: "", status: "DRAFT",
  bpm: "", musicalKey: "", streamLeaseEnabled: true,
  maxStreamLeases: "", creditFormat: "Prod. {producerName}",
  revocationPolicy: "A", contentRestrictions: [], customRestriction: "",
};

// ─── SHA-256 helper ───────────────────────────────────────────────────────────

async function sha256File(file: File): Promise<string> {
  const buf    = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Beat Modal ───────────────────────────────────────────────────────────────

function BeatModal({
  mode,
  beat,
  onClose,
  onSaved,
}: {
  mode: "upload" | "edit";
  beat?: Beat;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BeatFormData>(() =>
    beat
      ? {
          title:               beat.title,
          price:               beat.price?.toString() ?? "",
          leasePrice:          beat.price?.toString() ?? "",
          nonExclusivePrice:   "",
          exclusivePrice:      "",
          description:         beat.description ?? "",
          status:              beat.status,
          bpm:                 beat.bpm?.toString() ?? "",
          musicalKey:          beat.musicalKey ?? "",
          streamLeaseEnabled:  beat.beatLeaseSettings?.streamLeaseEnabled ?? true,
          maxStreamLeases:     beat.beatLeaseSettings?.maxStreamLeases?.toString() ?? "",
          creditFormat:        beat.beatLeaseSettings?.creditFormat ?? "Prod. {producerName}",
          revocationPolicy:    beat.beatLeaseSettings?.revocationPolicy ?? "A",
          contentRestrictions: beat.beatLeaseSettings?.contentRestrictions ?? [],
          customRestriction:   beat.beatLeaseSettings?.customRestriction ?? "",
        }
      : EMPTY_FORM
  );

  const [audioFile,    setAudioFile]    = useState<File | null>(null);
  const [coverFile,    setCoverFile]    = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(beat?.coverArtUrl ?? null);
  const [saving,       setSaving]       = useState(false);
  const [uploadStep,   setUploadStep]   = useState<string>("");
  const [error,        setError]        = useState<string | null>(null);
  const [savedBeatId,  setSavedBeatId]  = useState<string | null>(null);
  const [analyzing,    setAnalyzing]    = useState(false); // true while describe endpoint is running

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { startUpload: uploadAudio } = useUploadThing("beatAudio");
  const { startUpload: uploadCover } = useUploadThing("beatCoverArt");

  function setField<K extends keyof BeatFormData>(k: K, v: BeatFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Fire-and-forget description generation whenever a new audio file is selected.
  // Pre-fills BPM, key, and description — producer can edit or clear before saving.
  async function analyzeAndDescribe(file: File) {
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/dashboard/beats/describe", { method: "POST", body: fd });
      if (!res.ok) return;
      const data = await res.json() as { bpm: number | null; key: string | null; description: string | null };
      // Only pre-fill BPM/key if the producer hasn't typed a value yet
      if (data.bpm !== null) setForm((f) => ({ ...f, bpm: f.bpm || String(data.bpm) }));
      if (data.key !== null) setForm((f) => ({ ...f, musicalKey: f.musicalKey || data.key! }));
      if (data.description) setForm((f) => ({ ...f, description: f.description || data.description! }));
    } catch {
      // Silent — never block the upload flow
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleRestriction(r: string) {
    setForm((f) => ({
      ...f,
      contentRestrictions: f.contentRestrictions.includes(r)
        ? f.contentRestrictions.filter((x) => x !== r)
        : [...f.contentRestrictions, r],
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (mode === "upload" && !audioFile) { setError("Audio file is required."); return; }

    setSaving(true);
    setError(null);

    try {
      let fileUrl   = beat?.fileUrl ?? "";
      let coverUrl  = beat?.coverArtUrl ?? null;
      let audioHash = beat?.audioHash ?? null;

      // ── Upload audio ──────────────────────────────────────────────────────
      if (audioFile) {
        setUploadStep("Hashing audio…");
        audioHash = await sha256File(audioFile);

        setUploadStep("Uploading audio…");
        const [uploaded] = await uploadAudio([audioFile]) ?? [];
        if (!uploaded?.url) throw new Error("Audio upload failed.");
        fileUrl = uploaded.url;
      }

      // ── Upload cover ──────────────────────────────────────────────────────
      if (coverFile) {
        setUploadStep("Uploading cover art…");
        const [uploaded] = await uploadCover([coverFile]) ?? [];
        if (uploaded?.url) coverUrl = uploaded.url;
      }

      setUploadStep("Saving beat…");

      // ── Create or update track ────────────────────────────────────────────
      let beatId = beat?.id;

      if (mode === "upload") {
        const res = await fetch("/api/dashboard/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       form.title.trim(),
            fileUrl,
            coverArtUrl: coverUrl,
            price:       form.leasePrice ? parseFloat(form.leasePrice) : null,
            status:      form.status,
            description: form.description.trim() || null,
            audioHash,
          }),
        });
        if (!res.ok) throw new Error("Failed to create beat.");
        const data = await res.json();
        beatId = data.track.id;
      } else {
        await fetch(`/api/dashboard/tracks/${beat!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       form.title.trim(),
            price:       form.leasePrice ? parseFloat(form.leasePrice) : null,
            status:      form.status,
            description: form.description.trim() || null,
            coverArtUrl: coverUrl,
            bpm:         form.bpm ? parseInt(form.bpm) : null,
            musicalKey:  form.musicalKey || null,
            ...(audioFile && { fileUrl, audioHash }),
          }),
        });
      }

      // ── Upsert lease settings ─────────────────────────────────────────────
      await fetch(`/api/dashboard/tracks/${beatId}/lease-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamLeaseEnabled:  form.streamLeaseEnabled,
          maxStreamLeases:     form.maxStreamLeases ? parseInt(form.maxStreamLeases) : null,
          creditFormat:        form.creditFormat,
          revocationPolicy:    form.revocationPolicy,
          contentRestrictions: form.contentRestrictions,
          customRestriction:   form.customRestriction.trim() || null,
        }),
      });

      // For edit mode, call onSaved immediately.
      // For upload mode, capture the beat ID and show the license attachment step.
      if (mode === "edit") {
        onSaved();
      } else {
        setSavedBeatId(beatId!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
      setUploadStep("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "upload" ? "Upload New Beat" : "Edit Beat"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cover art + audio files */}
          <div className="flex gap-4">
            {/* Cover art */}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0 overflow-hidden relative group"
              style={{ borderColor: "var(--border)" }}
            >
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Music size={20} className="mx-auto mb-1" />
                  <span className="text-[10px]">Cover art</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Upload size={16} className="text-white" />
              </div>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setCoverFile(f);
                setCoverPreview(URL.createObjectURL(f));
              }}
            />

            {/* Audio file */}
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Audio File {mode === "upload" && <span className="text-red-400">*</span>}
              </label>
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="w-full h-10 rounded-lg border flex items-center gap-2 px-3 text-sm transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: audioFile ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                <Upload size={14} />
                {audioFile ? audioFile.name : beat ? "Replace audio file…" : "Choose MP3 or WAV…"}
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setAudioFile(f);
                  void analyzeAndDescribe(f);
                }}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Beat title"
              className="w-full h-10 rounded-lg border px-3 text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* BPM + Key + Status row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">BPM</label>
              <input
                type="number"
                value={form.bpm}
                onChange={(e) => setField("bpm", e.target.value)}
                placeholder="Auto-detect"
                className="w-full h-10 rounded-lg border px-3 text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Key</label>
              <div className="relative">
                <select
                  value={form.musicalKey}
                  onChange={(e) => setField("musicalKey", e.target.value)}
                  className="w-full h-10 rounded-lg border px-3 text-sm bg-transparent text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-accent"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="">Auto-detect</option>
                  {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value as "DRAFT" | "PUBLISHED")}
                  className="w-full h-10 rounded-lg border px-3 text-sm bg-transparent text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-accent"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              {analyzing && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 size={10} className="animate-spin" />
                  Generating description…
                </span>
              )}
              {!analyzing && form.description && audioFile && (
                <span className="text-[11px]" style={{ color: "var(--accent)" }}>
                  AI-generated · edit freely
                </span>
              )}
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder={analyzing ? "" : "Describe the vibe, mood, influences…"}
              disabled={analyzing}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-wait"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Pricing section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pricing</p>
            <div className="grid grid-cols-3 gap-3">
              {(["leasePrice", "nonExclusivePrice", "exclusivePrice"] as const).map((field, i) => (
                <div key={field}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    {["Lease", "Non-Exclusive", "Exclusive"][i]}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form[field]}
                      onChange={(e) => setField(field, e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 rounded-lg border pl-6 pr-3 text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stream Lease Settings */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stream Lease Settings</p>
            <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: "var(--border)" }}>
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Stream Leases</p>
                  <p className="text-xs text-muted-foreground">Allow artists to stream-lease this beat</p>
                </div>
                <button
                  type="button"
                  onClick={() => setField("streamLeaseEnabled", !form.streamLeaseEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.streamLeaseEnabled ? "bg-accent" : "bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.streamLeaseEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {form.streamLeaseEnabled && (
                <>
                  {/* Max leases + credit format row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Stream Leases</label>
                      <input
                        type="number"
                        min="1"
                        value={form.maxStreamLeases}
                        onChange={(e) => setField("maxStreamLeases", e.target.value)}
                        placeholder="Unlimited"
                        className="w-full h-10 rounded-lg border px-3 text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        style={{ borderColor: "var(--border)" }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Credit Format</label>
                      <input
                        value={form.creditFormat}
                        onChange={(e) => setField("creditFormat", e.target.value)}
                        placeholder="Prod. {producerName}"
                        className="w-full h-10 rounded-lg border px-3 text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        style={{ borderColor: "var(--border)" }}
                      />
                    </div>
                  </div>

                  {/* Revocation policy */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Revocation Policy</label>
                    <div className="flex gap-2">
                      {(["A", "B", "C"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setField("revocationPolicy", p)}
                          className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${
                            form.revocationPolicy === p
                              ? "border-accent text-accent bg-accent/10"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          style={{ borderColor: form.revocationPolicy === p ? "var(--accent)" : "var(--border)" }}
                        >
                          {p} — {REVOCATION_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content restrictions */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Content Restrictions</label>
                    <div className="space-y-1.5">
                      {RESTRICTION_OPTIONS.map((r) => (
                        <label key={r} className="flex items-center gap-2 cursor-pointer">
                          <button
                            type="button"
                            onClick={() => toggleRestriction(r)}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              form.contentRestrictions.includes(r) ? "bg-accent border-accent" : "border-border"
                            }`}
                            style={{ borderColor: form.contentRestrictions.includes(r) ? "var(--accent)" : "var(--border)" }}
                          >
                            {form.contentRestrictions.includes(r) && <Check size={10} className="text-background" />}
                          </button>
                          <span className="text-xs text-muted-foreground">{r}</span>
                        </label>
                      ))}
                      <input
                        value={form.customRestriction}
                        onChange={(e) => setField("customRestriction", e.target.value)}
                        placeholder="Custom restriction…"
                        className="w-full h-8 rounded-lg border px-3 text-xs bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-accent mt-1"
                        style={{ borderColor: "var(--border)" }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* License attachment — edit mode only (beat ID known) */}
          {mode === "edit" && beat && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Sample &amp; Rights Documentation</p>
              <LicenseAttachment contentType="track" contentId={beat.id} />
              <p className="text-[11px] text-muted-foreground">Attach sample clearances, loop licenses, or any rights documentation for this beat.</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Upload mode: post-save license attachment step */}
        {savedBeatId && (
          <div className="border-t px-5 py-5 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Check size={15} className="text-emerald-400 shrink-0" />
              <p className="text-sm font-semibold text-foreground">Beat uploaded! Attach any rights documentation.</p>
            </div>
            <LicenseAttachment contentType="track" contentId={savedBeatId} />
            <p className="text-[11px] text-muted-foreground">Attach sample clearances, loop licenses, or rights docs for this beat. You can also do this later from the edit screen.</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs text-muted-foreground">{uploadStep}</span>
          <div className="flex gap-3">
            {savedBeatId ? (
              <button
                onClick={onSaved}
                className="px-5 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "#E87040", color: "#fff" }}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  style={{ backgroundColor: "#E87040", color: "#fff", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saving ? uploadStep || "Saving…" : mode === "upload" ? "Upload Beat" : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProducerBeatsPage() {
  const [beats, setBeats]   = useState<Beat[]>([]);
  const [stats, setStats]   = useState<ProducerStats>({ totalBeats: 0, totalActiveLeases: 0, totalLicenses: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<{ mode: "upload" | "edit"; beat?: Beat } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/producer/beats");
      if (res.ok) {
        const data = await res.json();
        setBeats(data.beats);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleStatus(beat: Beat) {
    const next = beat.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setBeats((prev) => prev.map((b) => b.id === beat.id ? { ...b, status: next } : b));
    await fetch(`/api/dashboard/tracks/${beat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function deleteBeat(beatId: string) {
    if (!confirm("Delete this beat? This cannot be undone.")) return;
    setDeleting(beatId);
    await fetch(`/api/dashboard/tracks/${beatId}`, { method: "DELETE" });
    await load();
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Beats</h1>
        <button
          onClick={() => setModal({ mode: "upload" })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#E87040", color: "#fff" }}
        >
          <Upload size={15} />
          Upload New Beat
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Beats",      value: stats.totalBeats,         icon: ListMusic },
          { label: "Active Leases",    value: stats.totalActiveLeases,  icon: Radio },
          { label: "Licenses Sold",    value: stats.totalLicenses,      icon: FileText },
          { label: "Total Revenue",    value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Beat list */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : beats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Music size={36} className="text-muted-foreground mb-3" />
            <p className="text-foreground font-medium mb-1">No beats yet</p>
            <p className="text-sm text-muted-foreground mb-4">Upload your first beat to start licensing and earning.</p>
            <button
              onClick={() => setModal({ mode: "upload" })}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "#E87040", color: "#fff" }}
            >
              Upload Beat
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Beat","BPM / Key","Leases","Licenses","Plays","Status","Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {beats.map((beat) => (
                <tr
                  key={beat.id}
                  className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Beat info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: "var(--background)" }}
                      >
                        {beat.coverArtUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={beat.coverArtUrl} alt={beat.title} className="w-full h-full object-cover" />
                        ) : (
                          <Music size={16} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-[180px]">{beat.title}</p>
                        {beat.price != null && (
                          <p className="text-xs text-muted-foreground">${beat.price.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* BPM / Key */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {beat.bpm || beat.musicalKey
                      ? [beat.bpm && `${beat.bpm} BPM`, beat.musicalKey].filter(Boolean).join(" · ")
                      : <span className="text-xs italic">Detecting…</span>
                    }
                  </td>

                  {/* Leases */}
                  <td className="px-4 py-3">
                    <a
                      href="/dashboard/producer/stream-leases"
                      className="text-accent hover:underline font-medium"
                    >
                      {beat.activeLeaseCount}
                    </a>
                    {beat.totalLeaseCount > beat.activeLeaseCount && (
                      <span className="text-xs text-muted-foreground ml-1">/ {beat.totalLeaseCount}</span>
                    )}
                  </td>

                  {/* Licenses */}
                  <td className="px-4 py-3 text-foreground">{beat.licensesCount}</td>

                  {/* Plays */}
                  <td className="px-4 py-3 text-foreground">{beat.totalPlays.toLocaleString()}</td>

                  {/* Status toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(beat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        beat.status === "PUBLISHED"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-white/8 text-muted-foreground hover:bg-white/12"
                      }`}
                    >
                      {beat.status === "PUBLISHED" ? "Active" : "Draft"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        title="Edit"
                        onClick={() => setModal({ mode: "edit", beat })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <a
                        href="/dashboard/marketplace"
                        title="View in Marketplace"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        title="Delete"
                        onClick={() => deleteBeat(beat.id)}
                        disabled={deleting === beat.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/8 transition-colors"
                      >
                        {deleting === beat.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <BeatModal
          mode={modal.mode}
          beat={modal.beat}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); void load(); }}
        />
      )}
    </div>
  );
}
