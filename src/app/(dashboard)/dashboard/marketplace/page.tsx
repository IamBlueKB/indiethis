"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Music2, ShoppingCart, Clock, CheckCircle2, Eye, Download, Search, User, Loader2, X, Radio, ChevronRight, ChevronLeft, Upload, Image as ImageIcon, FileText, Bookmark, BookmarkCheck, Mic2, ArrowRight } from "lucide-react";
import { useAudioStore } from "@/store";
import BeatPreviewPlayer from "@/components/audio/BeatPreviewPlayer";
import { useUploadThing } from "@/lib/uploadthing-client";

type BeatPreview = {
  id: string;
  status: string;
  isDownloadable: boolean;
  expiresAt: string;
  createdAt: string;
  track: {
    id: string;
    title: string;
    description: string | null;
    fileUrl: string;
    coverArtUrl: string | null;
    price: number | null;
    projectName: string | null;
    bpm: number | null;
    musicalKey: string | null;
  };
  producer: { id: string; name: string; artistName: string | null };
};

type BrowseTrack = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  coverArtUrl: string | null;
  price: number | null;
  projectName: string | null;
  plays: number;
  bpm: number | null;
  musicalKey: string | null;
  createdAt: string;
  isOwned: boolean;
  activeLeaseCount: number;
  streamLeaseEnabled: boolean;
  maxStreamLeases: number | null;
  artist: {
    id: string;
    name: string;
    artistName: string | null;
    artistSlug: string | null;
    photo: string | null;
  };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: "New",      color: "text-yellow-400",  icon: Clock },
  LISTENED:  { label: "Listened", color: "text-blue-400",    icon: Eye },
  PURCHASED: { label: "Licensed", color: "text-emerald-400", icon: CheckCircle2 },
  EXPIRED:   { label: "Expired",  color: "text-red-400",     icon: Clock },
};

const LICENSE_OPTIONS = [
  { type: "LEASE",         label: "Lease",         description: "Limited use — demos, non-commercial projects."   },
  { type: "NON_EXCLUSIVE", label: "Non-Exclusive",  description: "Commercial use. Producer may sell to others."   },
  { type: "EXCLUSIVE",     label: "Exclusive",      description: "Full rights. Producer stops selling this beat." },
] as const;

// ─── Stream Lease Modal ───────────────────────────────────────────────────────

type StreamLeaseTarget = {
  trackId: string;
  beatTitle: string;
  producerName: string;
  coverArtUrl: string | null;
};

type StreamLeaseStep = "upload" | "details" | "agreement" | "confirm";

// ─── Stream Lease Explain Modal ───────────────────────────────────────────────

function StreamLeaseExplainModal({
  target,
  onClose,
  onUploadNow,
}: {
  target: StreamLeaseTarget;
  onClose: () => void;
  onUploadNow: () => void;
}) {
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  async function handleSaveLater() {
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch("/api/dashboard/stream-lease-bookmarks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ beatId: target.trackId }),
      });
      if (res.ok) { setSaved(true); }
      else        { const d = await res.json(); setSaveErr(d.error ?? "Failed to save."); }
    } catch {
      setSaveErr("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const STEPS = [
    { icon: Download,  text: "Download or reference this beat from the marketplace" },
    { icon: Mic2,      text: "Record your song over it in your DAW (GarageBand, FL Studio, etc.)" },
    { icon: Upload,    text: "Come back and upload your finished track here" },
    { icon: Radio,     text: "It streams exclusively on IndieThis for $1/mo — cancel anytime" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div
        className="rounded-2xl border w-full max-w-md overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="px-6 pt-5 pb-4 border-b flex items-start justify-between gap-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {target.coverArtUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={target.coverArtUrl} alt={target.beatTitle} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: "var(--border)" }}>
                <Music2 size={18} className="text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Radio size={12} style={{ color: "#E85D4A" }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#E85D4A" }}>Stream Lease · $1/mo</p>
              </div>
              <p className="text-sm font-bold text-foreground truncate">{target.beatTitle}</p>
              <p className="text-xs text-muted-foreground">prod. {target.producerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        {/* How it works */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm font-bold text-foreground">How Stream Lease works</p>
          <div className="space-y-3">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: "rgba(232,93,74,0.1)" }}
                >
                  <Icon size={13} style={{ color: "#E85D4A" }} />
                </div>
                <div className="flex items-start gap-2 pt-1">
                  <span className="text-xs font-bold text-muted-foreground/60 w-3 shrink-0">{i + 1}.</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>

          {saveErr && <p className="text-xs text-red-400">{saveErr}</p>}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={onUploadNow}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <Upload size={14} />
              I&apos;ve already recorded — upload now
            </button>

            {saved ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold" style={{ borderColor: "rgba(52,199,89,0.3)", color: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                <BookmarkCheck size={14} />
                Saved to your Stream Leases dashboard
              </div>
            ) : (
              <button
                onClick={handleSaveLater}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/5 disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />}
                {saving ? "Saving…" : "Save this beat for later"}
              </button>
            )}

            <a
              href={`/api/dashboard/stream-lease-beat-download/${target.trackId}`}
              download
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Download size={13} />
              Download beat (with ID3 tags)
            </a>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Saved beats appear in your{" "}
            <a href="/dashboard/stream-leases" className="underline" style={{ color: "#E85D4A" }}>Stream Leases dashboard</a>{" "}
            so you can come back after recording.
          </p>
        </div>
      </div>
    </div>
  );
}

function StreamLeaseModal({
  target,
  onClose,
  onSuccess,
}: {
  target: StreamLeaseTarget;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<StreamLeaseStep>("upload");

  // Step 1 — audio upload
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl]   = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioProgress, setAudioProgress]   = useState(0);
  const [trackHash, setTrackHash] = useState<string | null>(null);

  // Step 2 — details
  const [trackTitle, setTrackTitle] = useState("");
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [coverUrl, setCoverUrl]     = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  // Step 3 — agreement
  const [agreed, setAgreed] = useState(false);

  // Step 4 — submitting
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const { startUpload: startAudioUpload } = useUploadThing("streamLeaseAudio", {
    onUploadProgress: (p) => setAudioProgress(p),
  });
  const { startUpload: startCoverUpload } = useUploadThing("streamLeaseCover");

  async function handleAudioSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioUploading(true);
    setAudioProgress(0);
    setTrackHash(null);
    try {
      const [res, hashBuf] = await Promise.all([
        startAudioUpload([file]),
        file.arrayBuffer().then((buf) => crypto.subtle.digest("SHA-256", buf)),
      ]);
      const hexHash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setTrackHash(hexHash);
      const url = res?.[0]?.url;
      if (url) { setAudioUrl(url); setStep("details"); }
      else setError("Upload failed — please try again.");
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setAudioUploading(false);
    }
  }

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverUploading(true);
    try {
      const res = await startCoverUpload([file]);
      const url = res?.[0]?.url;
      if (url) setCoverUrl(url);
    } catch { /* cover is optional — fail silently */ }
    finally { setCoverUploading(false); }
  }

  async function handleConfirm() {
    if (!audioUrl || !trackTitle.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/stream-leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatId:     target.trackId,
          trackTitle: trackTitle.trim(),
          audioUrl,
          coverUrl:   coverUrl ?? undefined,
          trackHash:  trackHash ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSubmitting(false); return; }
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const stepTitles: Record<StreamLeaseStep, string> = {
    upload:    "Upload Your Track",
    details:   "Track Details",
    agreement: "Stream Lease Agreement",
    confirm:   "Confirm",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div
        className="rounded-2xl border w-full max-w-lg overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Radio size={14} style={{ color: "#E85D4A" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#E85D4A" }}>
                Stream Lease — $1/mo
              </p>
            </div>
            <p className="text-base font-bold text-foreground">{stepTitles[step]}</p>
            <p className="text-xs text-muted-foreground">{target.beatTitle} · {target.producerName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          {(["upload", "details", "agreement", "confirm"] as StreamLeaseStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  backgroundColor: step === s ? "#E85D4A" : (["upload","details","agreement","confirm"].indexOf(step) > i ? "rgba(232,93,74,0.3)" : "var(--border)"),
                  color: step === s || ["upload","details","agreement","confirm"].indexOf(step) > i ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {["upload","details","agreement","confirm"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              {i < 3 && <div className="w-6 h-px" style={{ backgroundColor: "var(--border)" }} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-6 space-y-4">

          {/* ── Step 1: Upload audio ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload the song you recorded using this beat. Mp3 or WAV, up to 256MB.
              </p>
              {audioUploading ? (
                <div className="rounded-xl border p-6 text-center space-y-3" style={{ borderColor: "var(--border)" }}>
                  <Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading… {audioProgress}%</p>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${audioProgress}%`, backgroundColor: "#E85D4A" }}
                    />
                  </div>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors hover:border-[#E85D4A]/50"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Upload size={28} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Click to upload your track</p>
                    <p className="text-xs text-muted-foreground mt-0.5">MP3 or WAV · Max 256MB</p>
                  </div>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioSelect} />
                </label>
              )}
              {audioFile && !audioUploading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Music2 size={12} /> {audioFile.name}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Track details ── */}
          {step === "details" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Track Title *
                </label>
                <input
                  type="text"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder="What did you call this song?"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-[#E85D4A]/30"
                  style={{ borderColor: "var(--border)" }}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Cover Art <span className="font-normal normal-case">(optional — uses beat art if none)</span>
                </label>
                {coverUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt="cover" className="w-14 h-14 rounded-xl object-cover" />
                    <button
                      onClick={() => { setCoverUrl(null); setCoverFile(null); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors hover:border-[#E85D4A]/50"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {coverUploading
                      ? <Loader2 size={16} className="animate-spin text-muted-foreground" />
                      : <ImageIcon size={16} className="text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">
                      {coverUploading ? "Uploading…" : coverFile ? coverFile.name : "Upload cover art"}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} disabled={coverUploading} />
                  </label>
                )}
              </div>
              {target.coverArtUrl && !coverUrl && (
                <p className="text-xs text-muted-foreground">
                  No cover uploaded — the beat&apos;s artwork will be used instead.
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Agreement ── */}
          {step === "agreement" && (
            <div className="space-y-4">
              <div
                className="rounded-xl border overflow-y-auto text-xs text-muted-foreground space-y-2 p-4 leading-relaxed"
                style={{ borderColor: "var(--border)", maxHeight: "260px" }}
              >
                <p className="font-bold text-foreground text-sm text-center">INDIETHIS STREAM LEASE AGREEMENT</p>
                <p><strong>Beat:</strong> {target.beatTitle} · <strong>Producer:</strong> {target.producerName}</p>
                <p><strong>1. Grant of License —</strong> You receive a non-exclusive, limited license to stream one (1) song using this beat exclusively on IndieThis. This does NOT allow distribution to Spotify, Apple Music, YouTube, or any other platform.</p>
                <p><strong>2. Term —</strong> Month-to-month. Renews automatically each billing cycle. Cancel anytime from your dashboard.</p>
                <p><strong>3. Fee —</strong> $1.00/month added to your subscription invoice. Split: $0.70 to producer, $0.30 to IndieThis.</p>
                <p><strong>4. Ownership —</strong> Producer retains all rights to the beat. You own your vocal performance and lyrics. The combined track is governed by this agreement.</p>
                <p><strong>5. Credits —</strong> You agree to credit the producer on the track listing in the format specified by the producer.</p>
                <p><strong>6. Restrictions —</strong> You may not sell, distribute, sublicense, or use the track commercially without a full license. You may not register the beat with any PRO.</p>
                <p><strong>7. Upgrade —</strong> Purchase a full license through the Beat Marketplace to distribute outside IndieThis. This lease terminates automatically upon full license purchase.</p>
                <p><strong>8. Revocation —</strong> Subject to producer&apos;s revocation policy set in their dashboard.</p>
                <p><strong>9. Indemnification —</strong> You represent your vocals and lyrics are original and indemnify IndieThis and the producer against any third-party claims.</p>
                <p><strong>10. Platform Terms —</strong> This agreement is subject to the IndieThis Terms of Service.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#E85D4A]"
                />
                <span className="text-sm text-foreground">
                  I have read and agree to the Stream Lease Agreement
                </span>
              </label>
            </div>
          )}

          {/* ── Step 4: Confirm ── */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
                <div className="flex items-center gap-3">
                  {(coverUrl ?? target.coverArtUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl ?? target.coverArtUrl!} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-foreground">{trackTitle}</p>
                    <p className="text-xs text-muted-foreground">using &ldquo;{target.beatTitle}&rdquo; by {target.producerName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <span className="text-muted-foreground">Added to monthly bill</span>
                  <span className="font-bold text-foreground">+$1.00/mo</span>
                </div>
              </div>
              <div className="rounded-xl p-3 text-xs text-muted-foreground space-y-1"
                style={{ backgroundColor: "rgba(232,93,74,0.06)", border: "1px solid rgba(232,93,74,0.2)" }}>
                <p className="font-semibold" style={{ color: "#E85D4A" }}>IndieThis only</p>
                <p>Your song streams exclusively on IndieThis. Cancel anytime from your dashboard. To distribute to Spotify or Apple Music, purchase a full license.</p>
              </div>
              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 pb-6">
          {step !== "upload" && (
            <button
              onClick={() => {
                if (step === "details") setStep("upload");
                else if (step === "agreement") setStep("details");
                else if (step === "confirm") setStep("agreement");
              }}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {step === "upload" && (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
          )}
          {step === "details" && (
            <button
              onClick={() => setStep("agreement")}
              disabled={!trackTitle.trim() || coverUploading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              Review Agreement <ChevronRight size={14} />
            </button>
          )}
          {step === "agreement" && (
            <button
              onClick={() => setStep("confirm")}
              disabled={!agreed}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              <FileText size={14} /> Continue <ChevronRight size={14} />
            </button>
          )}
          {step === "confirm" && (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#E85D4A", color: "#fff" }}
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Creating Lease…</>
                : <><Radio size={14} /> Confirm Stream Lease — $1/mo</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Previews tab ─────────────────────────────────────────────────────────

function MyPreviews() {
  const [previews, setPreviews] = useState<BeatPreview[]>([]);
  const [loading, setLoading]   = useState(true);

  // License modal state
  const [licensePreview, setLicensePreview] = useState<BeatPreview | null>(null);
  const [licenseType, setLicenseType]       = useState<string>("NON_EXCLUSIVE");
  const [licensing, setLicensing]           = useState(false);
  const [licenseError, setLicenseError]     = useState<string | null>(null);

  // Stream lease state
  const [explainTarget, setExplainTarget] = useState<StreamLeaseTarget | null>(null);
  const [streamTarget,  setStreamTarget]  = useState<StreamLeaseTarget | null>(null);
  const [leaseSuccess,  setLeaseSuccess]  = useState(false);

  async function handlePreviewLicense() {
    if (!licensePreview?.track.price) return;
    setLicensing(true);
    setLicenseError(null);
    try {
      const res  = await fetch("/api/beats/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: licensePreview.id, licenseType }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setLicenseError(data.error ?? "Something went wrong."); setLicensing(false); }
    } catch {
      setLicenseError("Network error. Please try again.");
      setLicensing(false);
    }
  }

  useEffect(() => {
    fetch("/api/beats/previews")
      .then((r) => r.json())
      .then((d) => { setPreviews(d.previews ?? []); setLoading(false); });
  }, []);

  async function markListened(p: BeatPreview) {
    if (p.status === "PENDING") {
      await fetch(`/api/beats/previews/${p.id}`);
      setPreviews((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "LISTENED" } : x));
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (previews.length === 0) return (
    <div className="rounded-2xl border py-16 text-center space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <Music2 size={40} className="mx-auto text-muted-foreground opacity-40" />
      <p className="text-sm font-semibold text-foreground">No beat previews yet</p>
      <p className="text-xs text-muted-foreground">Producers will share previews with you here.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {leaseSuccess && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4 border"
          style={{ backgroundColor: "rgba(52,199,89,0.08)", borderColor: "rgba(52,199,89,0.25)" }}>
          <CheckCircle2 size={18} style={{ color: "#34C759" }} />
          <div>
            <p className="text-sm font-semibold text-foreground">Stream Lease created!</p>
            <p className="text-xs text-muted-foreground">$1/mo has been added to your next invoice. Your track is live on IndieThis.</p>
          </div>
          <button onClick={() => setLeaseSuccess(false)} className="ml-auto text-muted-foreground"><X size={14} /></button>
        </div>
      )}

      {/* License modal */}
      {licensePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-2xl border w-full max-w-md p-6 space-y-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">License Beat</p>
                <p className="text-base font-bold text-foreground truncate">{licensePreview.track.title}</p>
                <p className="text-sm text-muted-foreground">by {licensePreview.producer.artistName ?? licensePreview.producer.name}</p>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {licensePreview.track.coverArtUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={licensePreview.track.coverArtUrl} alt={licensePreview.track.title} className="w-14 h-14 rounded-xl object-cover" />
                )}
                <button onClick={() => setLicensePreview(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">License Type</p>
              {LICENSE_OPTIONS.map(({ type, label, description }) => (
                <button key={type} onClick={() => setLicenseType(type)}
                  className="w-full text-left rounded-xl border p-3 transition-all"
                  style={{ borderColor: licenseType === type ? "#D4A843" : "var(--border)", backgroundColor: licenseType === type ? "rgba(212,168,67,0.06)" : "var(--background)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    {licensePreview.track.price && <p className="text-sm font-bold text-foreground">${licensePreview.track.price.toFixed(2)}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </button>
              ))}
              {/* Stream Lease option */}
              <button
                onClick={() => {
                  const t = { trackId: licensePreview.track.id, beatTitle: licensePreview.track.title, producerName: licensePreview.producer.artistName ?? licensePreview.producer.name, coverArtUrl: licensePreview.track.coverArtUrl };
                  setLicensePreview(null);
                  setExplainTarget(t);
                }}
                className="w-full text-left rounded-xl border p-3 transition-all"
                style={{ borderColor: "rgba(232,93,74,0.4)", backgroundColor: "rgba(232,93,74,0.04)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={13} style={{ color: "#E85D4A" }} />
                    <p className="text-sm font-semibold text-foreground">Stream Lease</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: "#E85D4A" }}>$1/mo</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 pl-5">
                  Record your song over this beat and stream it exclusively on IndieThis. Cancel anytime.
                </p>
              </button>
            </div>
            {licenseError && <p className="text-xs text-red-400 text-center">{licenseError}</p>}
            {!licensePreview.track.price && (
              <p className="text-xs text-center text-muted-foreground">
                This track doesn&apos;t have a price set. Contact the producer directly.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setLicensePreview(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                Cancel
              </button>
              <button onClick={handlePreviewLicense} disabled={licensing || !licensePreview.track.price}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                {licensing ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : `Purchase — $${licensePreview.track.price?.toFixed(2) ?? "—"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stream lease explain modal */}
      {explainTarget && (
        <StreamLeaseExplainModal
          target={explainTarget}
          onClose={() => setExplainTarget(null)}
          onUploadNow={() => { setStreamTarget(explainTarget); setExplainTarget(null); }}
        />
      )}

      {/* Stream lease upload modal */}
      {streamTarget && (
        <StreamLeaseModal
          target={streamTarget}
          onClose={() => setStreamTarget(null)}
          onSuccess={() => { setStreamTarget(null); setLeaseSuccess(true); }}
        />
      )}

      {previews.map((p) => {
        const isExpired      = new Date(p.expiresAt) < new Date();
        const effectiveStatus = isExpired && p.status !== "PURCHASED" ? "EXPIRED" : p.status;
        const effectiveCfg   = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.PENDING;
        const EffectiveIcon  = effectiveCfg.icon;

        return (
          <div key={p.id} className="rounded-2xl border p-5 flex items-center gap-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
              style={{ backgroundImage: p.track.coverArtUrl ? `url(${p.track.coverArtUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: p.track.coverArtUrl ? undefined : "var(--border)" }}>
              {!p.track.coverArtUrl && <Music2 size={20} className="text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{p.track.title}</p>
              <p className="text-xs text-muted-foreground">by {p.producer.artistName ?? p.producer.name}</p>
              {p.track.projectName && <p className="text-xs text-muted-foreground">{p.track.projectName}</p>}
              {(p.track.bpm != null || p.track.musicalKey) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {p.track.bpm != null && <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{p.track.bpm} BPM</span>}
                  {p.track.bpm != null && p.track.musicalKey && <span className="text-[11px] text-muted-foreground/40">·</span>}
                  {p.track.musicalKey && <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{p.track.musicalKey}</span>}
                </div>
              )}
              {effectiveStatus !== "EXPIRED" && (
                <BeatPreviewPlayer
                  trackId={p.track.id} title={p.track.title} producerName={p.producer.artistName ?? p.producer.name}
                  fileUrl={p.track.fileUrl} coverArtUrl={p.track.coverArtUrl ?? undefined}
                  isOwned={effectiveStatus === "PURCHASED"} onPlay={() => markListened(p)} className="mt-2 w-full"
                />
              )}
            </div>
            {p.track.price && <div className="text-right shrink-0"><p className="text-sm font-bold text-foreground">${p.track.price.toFixed(2)}</p><p className="text-xs text-muted-foreground">license</p></div>}
            <div className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 ${effectiveCfg.color}`}>
              <EffectiveIcon size={12} />{effectiveCfg.label}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isExpired && effectiveStatus !== "PURCHASED" && (
                <button onClick={() => { setLicensePreview(p); setLicenseType("NON_EXCLUSIVE"); setLicenseError(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  <ShoppingCart size={12} /> License
                </button>
              )}
              {effectiveStatus === "PURCHASED" && p.isDownloadable && (
                <a href={p.track.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/5 no-underline"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  <Download size={12} /> Download
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top 10 Leaderboard ───────────────────────────────────────────────────────

type TopBeat = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  activeLeaseCount: number;
  artist: { id: string; name: string; artistName: string | null; artistSlug: string | null };
};

function TopBeatsLeaderboard({ onStreamLease }: { onStreamLease: (target: StreamLeaseTarget) => void }) {
  const [beats, setBeats]   = useState<TopBeat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/marketplace/top-beats")
      .then((r) => r.json())
      .then((d) => { setBeats(d.beats ?? []); setLoading(false); });
  }, []);

  if (loading || beats.length === 0) return null;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="px-5 py-4 border-b flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
        <Radio size={14} style={{ color: "#E85D4A" }} />
        <p className="text-sm font-bold text-foreground">Top 10 Most Used Beats</p>
        <span className="text-xs text-muted-foreground ml-auto">by active stream leases</span>
      </div>
      <div>
        {beats.map((beat, idx) => {
          const producerName = beat.artist.artistName ?? beat.artist.name;
          return (
            <div key={beat.id}
              className="flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}>
              {/* Rank */}
              <span className="text-xs font-bold w-5 text-center shrink-0"
                style={{ color: idx === 0 ? "#D4A843" : idx === 1 ? "#9CA3AF" : idx === 2 ? "#B45309" : "var(--muted-foreground)" }}>
                {idx + 1}
              </span>
              {/* Cover art */}
              <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                style={{
                  backgroundImage: beat.coverArtUrl ? `url(${beat.coverArtUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: beat.coverArtUrl ? undefined : "var(--border)",
                }}>
                {!beat.coverArtUrl && <Music2 size={14} className="text-muted-foreground" />}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{beat.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-muted-foreground truncate">{producerName}</p>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "#E85D4A" }}>
                    <Radio size={9} />
                    {beat.activeLeaseCount} {beat.activeLeaseCount === 1 ? "artist" : "artists"} recording
                  </span>
                </div>
              </div>
              {/* CTA */}
              <button
                onClick={() => onStreamLease({
                  trackId: beat.id,
                  beatTitle: beat.title,
                  producerName,
                  coverArtUrl: beat.coverArtUrl,
                })}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-[rgba(232,93,74,0.10)]"
                style={{ borderColor: "rgba(232,93,74,0.4)", color: "#E85D4A", backgroundColor: "rgba(232,93,74,0.05)" }}
              >
                <Radio size={10} /> Stream Lease
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Browse Beats tab ─────────────────────────────────────────────────────────

function BrowseBeats({ upgradeBeatId }: { upgradeBeatId?: string | null }) {
  const [tracks, setTracks]     = useState<BrowseTrack[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const currentTrack            = useAudioStore((s) => s.currentTrack);

  // License modal
  const [licenseTrack, setLicenseTrack] = useState<BrowseTrack | null>(null);
  const [licenseType, setLicenseType]   = useState<string>("NON_EXCLUSIVE");
  const [licensing, setLicensing]       = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // Stream lease state
  const [explainTarget, setExplainTarget] = useState<StreamLeaseTarget | null>(null);
  const [streamTarget,  setStreamTarget]  = useState<StreamLeaseTarget | null>(null);
  const [leaseSuccess,  setLeaseSuccess]  = useState(false);

  async function handleLicense() {
    if (!licenseTrack?.price) return;
    setLicensing(true);
    setLicenseError(null);
    try {
      const res  = await fetch("/api/beats/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: licenseTrack.id, licenseType }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setLicenseError(data.error ?? "Something went wrong."); setLicensing(false); }
    } catch {
      setLicenseError("Network error. Please try again.");
      setLicensing(false);
    }
  }

  const openLicenseModal = useCallback((track: BrowseTrack) => {
    setLicenseTrack(track);
    setLicenseType("NON_EXCLUSIVE");
    setLicenseError(null);
  }, []);

  useEffect(() => {
    fetch("/api/dashboard/marketplace/browse")
      .then((r) => r.json())
      .then((d) => {
        const loaded: BrowseTrack[] = d.tracks ?? [];
        setTracks(loaded);
        setLoading(false);
        // Deep-link: ?upgrade=<beatId> → auto-open license modal for that beat
        if (upgradeBeatId) {
          const target = loaded.find((t) => t.id === upgradeBeatId);
          if (target) openLicenseModal(target);
        }
      });
  }, [upgradeBeatId, openLicenseModal]);

  const filtered = search.trim()
    ? tracks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.artist.artistName ?? t.artist.name).toLowerCase().includes(search.toLowerCase())
      )
    : tracks;

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Top 10 leaderboard — shown before the search bar */}
      <TopBeatsLeaderboard onStreamLease={(target) => { setStreamTarget(target); }} />

      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Search beats or producers…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/30"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }} />
      </div>

      {leaseSuccess && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4 border"
          style={{ backgroundColor: "rgba(52,199,89,0.08)", borderColor: "rgba(52,199,89,0.25)" }}>
          <CheckCircle2 size={18} style={{ color: "#34C759" }} />
          <div>
            <p className="text-sm font-semibold text-foreground">Stream Lease created!</p>
            <p className="text-xs text-muted-foreground">$1/mo added to your next invoice. Your track is live on IndieThis.</p>
          </div>
          <button onClick={() => setLeaseSuccess(false)} className="ml-auto text-muted-foreground"><X size={14} /></button>
        </div>
      )}

      {/* License modal */}
      {licenseTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-2xl border w-full max-w-md p-6 space-y-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">License Beat</p>
                <p className="text-base font-bold text-foreground truncate">{licenseTrack.title}</p>
                <p className="text-sm text-muted-foreground">by {licenseTrack.artist.artistName ?? licenseTrack.artist.name}</p>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {licenseTrack.coverArtUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={licenseTrack.coverArtUrl} alt={licenseTrack.title} className="w-14 h-14 rounded-xl object-cover" />
                )}
                <button onClick={() => setLicenseTrack(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">License Type</p>
              {LICENSE_OPTIONS.map(({ type, label, description }) => (
                <button key={type} onClick={() => setLicenseType(type)}
                  className="w-full text-left rounded-xl border p-3 transition-all"
                  style={{ borderColor: licenseType === type ? "#D4A843" : "var(--border)", backgroundColor: licenseType === type ? "rgba(212,168,67,0.06)" : "var(--background)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    {licenseTrack.price && <p className="text-sm font-bold text-foreground">${licenseTrack.price.toFixed(2)}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </button>
              ))}
              {/* Stream Lease option — only show if enabled for this beat */}
              {licenseTrack.streamLeaseEnabled && <button
                onClick={() => {
                  const producerName = licenseTrack.artist.artistName ?? licenseTrack.artist.name;
                  setLicenseTrack(null);
                  setExplainTarget({ trackId: licenseTrack.id, beatTitle: licenseTrack.title, producerName, coverArtUrl: licenseTrack.coverArtUrl });
                }}
                className="w-full text-left rounded-xl border p-3 transition-all"
                style={{ borderColor: "rgba(232,93,74,0.4)", backgroundColor: "rgba(232,93,74,0.04)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={13} style={{ color: "#E85D4A" }} />
                    <p className="text-sm font-semibold text-foreground">Stream Lease</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: "#E85D4A" }}>$1/mo</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 pl-5">
                  Record your song over this beat and stream it exclusively on IndieThis. Cancel anytime.
                </p>
              </button>}
            </div>
            {licenseError && <p className="text-xs text-red-400 text-center">{licenseError}</p>}
            {!licenseTrack.price && (
              <p className="text-xs text-center text-muted-foreground">
                This track doesn&apos;t have a price set. Contact the producer directly.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setLicenseTrack(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                Cancel
              </button>
              <button onClick={handleLicense} disabled={licensing || !licenseTrack.price}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                {licensing ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : `Purchase — $${licenseTrack.price?.toFixed(2) ?? "—"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stream lease explain modal */}
      {explainTarget && (
        <StreamLeaseExplainModal
          target={explainTarget}
          onClose={() => setExplainTarget(null)}
          onUploadNow={() => { setStreamTarget(explainTarget); setExplainTarget(null); }}
        />
      )}

      {/* Stream lease upload modal */}
      {streamTarget && (
        <StreamLeaseModal
          target={streamTarget}
          onClose={() => setStreamTarget(null)}
          onSuccess={() => { setStreamTarget(null); setLeaseSuccess(true); }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border py-16 text-center space-y-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <Music2 size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">
            {search ? "No beats match your search" : "No beats available yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {search ? "Try a different search term." : "Producers will list their beats here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((t) => {
            const isThis       = currentTrack?.id === t.id;
            const producerName = t.artist.artistName ?? t.artist.name;
            return (
              <div key={t.id} className="rounded-2xl border p-4 flex items-center gap-4"
                style={{ backgroundColor: "var(--card)", borderColor: isThis ? "#D4A843" : "var(--border)", transition: "border-color 0.2s" }}>
                <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ backgroundImage: t.coverArtUrl ? `url(${t.coverArtUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: t.coverArtUrl ? undefined : "var(--border)" }}>
                  {!t.coverArtUrl && <Music2 size={18} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <User size={10} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{producerName}</p>
                    {t.projectName && <><span className="text-xs text-muted-foreground/40">·</span><p className="text-xs text-muted-foreground truncate">{t.projectName}</p></>}
                  </div>
                  {t.plays > 0 && <p className="text-[11px] text-muted-foreground mt-0.5">{t.plays} plays</p>}
                  {/* Stream Lease badge — prominent CTA directly on the card */}
                  {t.streamLeaseEnabled && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExplainTarget({ trackId: t.id, beatTitle: t.title, producerName, coverArtUrl: t.coverArtUrl });
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors w-fit"
                        style={{ borderColor: "rgba(232,93,74,0.5)", color: "#E85D4A", backgroundColor: "rgba(232,93,74,0.07)" }}
                      >
                        <Radio size={10} /> Stream Lease — $1/mo
                      </button>
                      {t.maxStreamLeases !== null ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t.activeLeaseCount} of {t.maxStreamLeases} stream lease slots taken
                        </p>
                      ) : t.activeLeaseCount > 0 ? (
                        <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "#E85D4A" }}>
                          <Radio size={9} />{t.activeLeaseCount} {t.activeLeaseCount === 1 ? "artist" : "artists"} recording
                        </p>
                      ) : null}
                    </div>
                  )}
                  {(t.bpm != null || t.musicalKey) && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.bpm != null && <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{t.bpm} BPM</span>}
                      {t.bpm != null && t.musicalKey && <span className="text-[11px] text-muted-foreground/40">·</span>}
                      {t.musicalKey && <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{t.musicalKey}</span>}
                    </div>
                  )}
                  <BeatPreviewPlayer
                    trackId={t.id} title={t.title} producerName={producerName}
                    fileUrl={t.fileUrl} coverArtUrl={t.coverArtUrl ?? undefined}
                    isOwned={t.isOwned} className="mt-2 w-full"
                  />
                </div>
                {t.price && !t.isOwned && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">${t.price.toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">license</p>
                  </div>
                )}
                {!t.isOwned && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                      onClick={() => openLicenseModal(t)}
                    >
                      <ShoppingCart size={12} /> License
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const searchParams                    = useSearchParams();
  const justLicensed                    = searchParams.get("licensed") === "1";
  const upgradeBeatId                   = searchParams.get("upgrade") ?? null;

  // Default to browse tab when coming from an upgrade deep-link
  const [tab, setTab]                   = useState<"previews" | "browse">(upgradeBeatId ? "browse" : "previews");
  const [dismissedBanner, setDismissedBanner]   = useState(false);
  const [dismissedUpgrade, setDismissedUpgrade] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* License purchased banner */}
      {justLicensed && !dismissedBanner && (
        <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 border"
          style={{ backgroundColor: "rgba(52,199,89,0.08)", borderColor: "rgba(52,199,89,0.25)" }}>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} style={{ color: "#34C759" }} />
            <div>
              <p className="text-sm font-semibold text-foreground">License purchased!</p>
              <p className="text-xs text-muted-foreground">Your beat license is confirmed. Check My Previews to download.</p>
            </div>
          </div>
          <button onClick={() => setDismissedBanner(true)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Upgrade context banner — shown when arriving from stream lease upgrade CTA */}
      {upgradeBeatId && !dismissedUpgrade && (
        <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 border"
          style={{ backgroundColor: "rgba(212,168,67,0.08)", borderColor: "rgba(212,168,67,0.3)" }}>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} style={{ color: "#D4A843" }} />
            <div>
              <p className="text-sm font-semibold text-foreground">Upgrade your stream lease</p>
              <p className="text-xs text-muted-foreground">
                Purchase a full license to distribute your track on Spotify, Apple Music, and anywhere else.
                Your $1/mo stream lease will be cancelled automatically.
              </p>
            </div>
          </div>
          <button onClick={() => setDismissedUpgrade(true)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={15} />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Beat Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Discover and license beats from independent producers</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {(["previews", "browse"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            style={tab === t ? { backgroundColor: "var(--background)", color: "var(--foreground)" } : { color: "var(--muted-foreground)" }}>
            {t === "previews" ? "My Previews" : "Browse Beats"}
          </button>
        ))}
      </div>

      {tab === "previews" ? <MyPreviews /> : <BrowseBeats upgradeBeatId={upgradeBeatId} />}
    </div>
  );
}
