"use client";

import { useEffect, useState } from "react";
import {
  Radio,
  Music2,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Play,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  Upload,
  FileText,
  BarChart2,
  TrendingUp,
  Image as ImageIcon,
  ArrowUpRight,
  Bookmark,
  Mic2,
  Trash2,
  Download,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type StreamLease = {
  id: string;
  trackTitle: string;
  audioUrl: string;
  coverUrl: string | null;
  isActive: boolean;
  activatedAt: string;
  cancelledAt: string | null;
  createdAt: string;
  playCount: number;
  beat:     { id: string; title: string; coverArtUrl: string | null };
  producer: { name: string; artistName: string | null };
  agreement: { id: string; artistAcceptedAt: string } | null;
};

type BrowseBeat = {
  id: string;
  title: string;
  coverArtUrl: string | null;
  price: number | null;
  bpm: number | null;
  musicalKey: string | null;
  streamLeaseEnabled: boolean;
  maxStreamLeases: number | null;
  activeLeaseCount: number;
  artist: { id: string; name: string; artistName: string | null; photo: string | null };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function daysUntilExpiry(cancelledAt: string) {
  const expiresAt = new Date(cancelledAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

// ─── Cancel Confirmation Modal ─────────────────────────────────────────────

function CancelModal({
  lease,
  onConfirm,
  onClose,
  loading,
  error,
}: {
  lease: StreamLease;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="rounded-2xl border w-full max-w-sm p-6 space-y-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: "rgba(255,59,48,0.12)" }}
          >
            <AlertTriangle size={17} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Cancel Stream Lease?</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              <strong className="text-foreground">{lease.trackTitle}</strong> will stay live
              until the end of your current billing period, then be removed. You can
              reactivate within 30 days if you change your mind.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Keep Lease
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: "#FF3B30" }}
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Cancelling…</> : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reactivate Confirmation Modal ────────────────────────────────────────────

function ReactivateModal({
  lease,
  monthlyPrice,
  onConfirm,
  onClose,
  loading,
  error,
}: {
  lease: StreamLease;
  monthlyPrice: number;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const days = lease.cancelledAt ? daysUntilExpiry(lease.cancelledAt) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="rounded-2xl border w-full max-w-sm p-6 space-y-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: "rgba(232,93,74,0.12)" }}
          >
            <RefreshCw size={17} style={{ color: "#E85D4A" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Reactivate Stream Lease?</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              <strong className="text-foreground">{lease.trackTitle}</strong> will go
              live again immediately. ${monthlyPrice.toFixed(2)}/mo will be added to your
              next invoice. Your existing agreement still applies — no re-signing needed.
            </p>
            {days > 0 && (
              <p className="text-xs mt-2" style={{ color: "#E85D4A" }}>
                {days} {days === 1 ? "day" : "days"} left to reactivate before this lease expires permanently.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Not Now
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Reactivating…</> : "Reactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lease Card ───────────────────────────────────────────────────────────────

function LeaseCard({
  lease,
  monthlyPrice,
  onCancel,
  onReactivate,
}: {
  lease: StreamLease;
  monthlyPrice: number;
  onCancel?: () => void;
  onReactivate?: () => void;
  // upgrade: navigate to marketplace with this beat pre-selected
}) {
  const coverArt    = lease.coverUrl ?? lease.beat.coverArtUrl;
  const producer    = lease.producer.artistName ?? lease.producer.name;
  const isCancelled = !lease.isActive;
  const daysLeft    = lease.cancelledAt ? daysUntilExpiry(lease.cancelledAt) : null;
  const showUpgrade = !isCancelled && lease.playCount > 0;

  // Upgrade URL: marketplace browse tab with this beat pre-selected
  const upgradeUrl = `/dashboard/marketplace?upgrade=${lease.beat.id}&tab=browse`;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-opacity"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        opacity: isCancelled ? 0.75 : 1,
      }}
    >
      {/* Main row */}
      <div className="p-4 flex items-center gap-4">
        {/* Cover art */}
        <div
          className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
          style={{
            backgroundImage:    coverArt ? `url(${coverArt})` : undefined,
            backgroundSize:     "cover",
            backgroundPosition: "center",
            backgroundColor:    coverArt ? undefined : "var(--border)",
          }}
        >
          {!coverArt && <Music2 size={20} className="text-muted-foreground" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground truncate">{lease.trackTitle}</p>
            {isCancelled && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: "rgba(255,59,48,0.12)", color: "#FF3B30" }}
              >
                Cancelled
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            on <span className="text-foreground font-medium">{lease.beat.title}</span>
            {" · "}prod. {producer}
          </p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar size={10} />
              {isCancelled ? `Cancelled ${formatDate(lease.cancelledAt!)}` : `Since ${formatDate(lease.activatedAt)}`}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Play size={10} />
              {lease.playCount.toLocaleString()} {lease.playCount === 1 ? "play" : "plays"}
            </span>
            {!isCancelled && (
              <span className="text-[11px] font-semibold" style={{ color: "#E85D4A" }}>
                ${monthlyPrice.toFixed(2)}/mo
              </span>
            )}
            {isCancelled && daysLeft !== null && daysLeft > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {daysLeft}d left to reactivate
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {!isCancelled && onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-red-400/10"
              style={{ borderColor: "rgba(255,59,48,0.3)", color: "#FF3B30" }}
            >
              Cancel
            </button>
          )}
          {isCancelled && onReactivate && (
            <button
              onClick={onReactivate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={{ borderColor: "rgba(232,93,74,0.4)", color: "#E85D4A", backgroundColor: "rgba(232,93,74,0.07)" }}
            >
              <RefreshCw size={11} /> Reactivate
            </button>
          )}
        </div>
      </div>

      {/* Upgrade prompt — active leases with plays */}
      {showUpgrade && (
        <a
          href={upgradeUrl}
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-t no-underline group transition-colors hover:bg-white/3"
          style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "rgba(212,168,67,0.04)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp size={12} style={{ color: "#D4A843" }} className="shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              <span className="font-semibold" style={{ color: "#D4A843" }}>
                {lease.playCount.toLocaleString()} plays
              </span>
              {" on IndieThis. Ready to take it everywhere?"}
            </p>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-semibold shrink-0 group-hover:underline"
            style={{ color: "#D4A843" }}
          >
            Upgrade to Full License <ArrowUpRight size={11} />
          </span>
        </a>
      )}
    </div>
  );
}

// ─── Create Stream Lease Modal ────────────────────────────────────────────────

type CreateStep = "select-beat" | "upload" | "details" | "agreement" | "confirm";
const CREATE_STEPS: CreateStep[] = ["select-beat", "upload", "details", "agreement", "confirm"];
const STEP_LABELS: Record<CreateStep, string> = {
  "select-beat": "Select Beat",
  upload:        "Upload Track",
  details:       "Track Details",
  agreement:     "Agreement",
  confirm:       "Confirm",
};

function CreateStreamLeaseModal({
  onClose,
  onSuccess,
  monthlyPrice,
  preselectedBeatId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  monthlyPrice: number;
  preselectedBeatId?: string;
}) {
  const [step, setStep] = useState<CreateStep>("select-beat");

  // Beat selection
  const [beats,        setBeats]        = useState<BrowseBeat[]>([]);
  const [beatsLoading, setBeatsLoading] = useState(true);
  const [beatSearch,   setBeatSearch]   = useState("");
  const [selectedBeat, setSelectedBeat] = useState<BrowseBeat | null>(null);

  // Audio upload
  const [audioFile,       setAudioFile]       = useState<File | null>(null);
  const [audioUrl,        setAudioUrl]        = useState<string | null>(null);
  const [audioUploading,  setAudioUploading]  = useState(false);
  const [audioProgress,   setAudioProgress]   = useState(0);
  const [trackHash,       setTrackHash]       = useState<string | null>(null);

  // Details
  const [trackTitle,     setTrackTitle]     = useState("");
  const [coverFile,      setCoverFile]      = useState<File | null>(null);
  const [coverUrl,       setCoverUrl]       = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  // Agreement + submit
  const [agreed,     setAgreed]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const { startUpload: startAudioUpload } = useUploadThing("streamLeaseAudio", {
    onUploadProgress: (p) => setAudioProgress(p),
  });
  const { startUpload: startCoverUpload } = useUploadThing("streamLeaseCover");

  useEffect(() => {
    fetch("/api/dashboard/marketplace/browse")
      .then((r) => r.json())
      .then((d) => {
        const available = (d.tracks ?? []).filter((t: BrowseBeat) => t.streamLeaseEnabled);
        setBeats(available);
        // If a beat was pre-selected from a bookmark, auto-select it and advance
        if (preselectedBeatId) {
          const match = available.find((t: BrowseBeat) => t.id === preselectedBeatId);
          if (match) { setSelectedBeat(match); setStep("upload"); }
        }
      })
      .finally(() => setBeatsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBeats = beats.filter((b) => {
    if (!beatSearch.trim()) return true;
    const q = beatSearch.toLowerCase();
    const producer = b.artist.artistName ?? b.artist.name;
    return b.title.toLowerCase().includes(q) || producer.toLowerCase().includes(q);
  });

  async function handleAudioSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioUploading(true);
    setAudioProgress(0);
    setError(null);
    setTrackHash(null);
    try {
      // Compute SHA-256 hash and upload simultaneously
      const [res, hashBuf] = await Promise.all([
        startAudioUpload([file]),
        file.arrayBuffer().then((buf) => crypto.subtle.digest("SHA-256", buf)),
      ]);
      // Store hex hash
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
    if (!audioUrl || !trackTitle.trim() || !selectedBeat) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/stream-leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatId:     selectedBeat.id,
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

  const stepIdx     = CREATE_STEPS.indexOf(step);
  const producerName = selectedBeat ? (selectedBeat.artist.artistName ?? selectedBeat.artist.name) : "";

  function goBack() {
    if (step === "upload")     setStep("select-beat");
    if (step === "details")    setStep("upload");
    if (step === "agreement")  setStep("details");
    if (step === "confirm")    setStep("agreement");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div
        className="rounded-2xl border w-full max-w-lg overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Radio size={14} style={{ color: "#E85D4A" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#E85D4A" }}>
                New Stream Lease — ${monthlyPrice.toFixed(2)}/mo
              </p>
            </div>
            <p className="text-base font-bold text-foreground">{STEP_LABELS[step]}</p>
            {selectedBeat && (
              <p className="text-xs text-muted-foreground">
                {selectedBeat.title} · {producerName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          {CREATE_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  backgroundColor: step === s ? "#E85D4A" : (stepIdx > i ? "rgba(232,93,74,0.4)" : "var(--border)"),
                  color: step === s || stepIdx > i ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {stepIdx > i ? "✓" : i + 1}
              </div>
              {i < CREATE_STEPS.length - 1 && (
                <div className="w-4 h-px" style={{ backgroundColor: "var(--border)" }} />
              )}
            </div>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Step {stepIdx + 1} of {CREATE_STEPS.length}
          </span>
        </div>

        {/* Scrollable step content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── Step 1: Select Beat ── */}
          {step === "select-beat" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose a beat from the marketplace to record your song on.
              </p>
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2"
                style={{ borderColor: "var(--border)" }}
              >
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={beatSearch}
                  onChange={(e) => setBeatSearch(e.target.value)}
                  placeholder="Search beats by title or producer…"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {beatSearch && (
                  <button onClick={() => setBeatSearch("")} className="text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                )}
              </div>
              {beatsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading beats…</span>
                </div>
              ) : filteredBeats.length === 0 ? (
                <div className="text-center py-8">
                  <Music2 size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {beatSearch ? "No beats match your search." : "No beats available for stream leasing."}
                  </p>
                  <a
                    href="/dashboard/marketplace"
                    className="text-xs no-underline mt-2 inline-block"
                    style={{ color: "#E85D4A" }}
                  >
                    Browse Marketplace →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBeats.map((beat) => {
                    const producer  = beat.artist.artistName ?? beat.artist.name;
                    const slotsFull = beat.maxStreamLeases !== null && beat.activeLeaseCount >= beat.maxStreamLeases;
                    return (
                      <button
                        key={beat.id}
                        onClick={() => { setSelectedBeat(beat); setStep("upload"); }}
                        disabled={slotsFull}
                        className="w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-[#E85D4A]/40 hover:bg-white/3 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div
                          className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                          style={{
                            backgroundImage:    beat.coverArtUrl ? `url(${beat.coverArtUrl})` : undefined,
                            backgroundSize:     "cover",
                            backgroundPosition: "center",
                            backgroundColor:    beat.coverArtUrl ? undefined : "var(--border)",
                          }}
                        >
                          {!beat.coverArtUrl && <Music2 size={14} className="text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{beat.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {producer}
                            {beat.bpm && ` · ${beat.bpm} BPM`}
                            {beat.musicalKey && ` · ${beat.musicalKey}`}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          {slotsFull ? (
                            <span className="text-[10px] font-bold text-red-400">Full</span>
                          ) : beat.maxStreamLeases !== null ? (
                            <span className="text-[10px] text-muted-foreground">
                              {beat.activeLeaseCount}/{beat.maxStreamLeases} slots
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {beat.activeLeaseCount} artist{beat.activeLeaseCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          <ChevronRight size={13} className="text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Upload audio ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload the song you recorded using this beat. MP3 or WAV, up to 256MB.
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
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}

          {/* ── Step 3: Track details ── */}
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
                  autoFocus
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
            </div>
          )}

          {/* ── Step 4: Agreement ── */}
          {step === "agreement" && (
            <div className="space-y-4">
              <div
                className="rounded-xl border overflow-y-auto text-xs text-muted-foreground space-y-2 p-4 leading-relaxed"
                style={{ borderColor: "var(--border)", maxHeight: "260px" }}
              >
                <p className="font-bold text-foreground text-sm text-center">INDIETHIS STREAM LEASE AGREEMENT</p>
                <p><strong>Beat:</strong> {selectedBeat?.title} · <strong>Producer:</strong> {producerName}</p>
                <p><strong>1. Grant of License —</strong> You receive a non-exclusive, limited license to stream one (1) song using this beat exclusively on IndieThis. This does NOT allow distribution to Spotify, Apple Music, YouTube, or any other platform.</p>
                <p><strong>2. Term —</strong> Month-to-month. Renews automatically each billing cycle. Cancel anytime from your dashboard.</p>
                <p><strong>3. Fee —</strong> ${monthlyPrice.toFixed(2)}/month added to your subscription invoice. Split: ${(monthlyPrice * 0.70).toFixed(2)} to producer, ${(monthlyPrice * 0.30).toFixed(2)} to IndieThis.</p>
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

          {/* ── Step 5: Confirm ── */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              >
                <div className="flex items-center gap-3">
                  {(coverUrl ?? selectedBeat?.coverArtUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl ?? selectedBeat!.coverArtUrl!}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-bold text-foreground">{trackTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      using &ldquo;{selectedBeat?.title}&rdquo; by {producerName}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center justify-between text-sm pt-1 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-muted-foreground">Added to monthly bill</span>
                  <span className="font-bold text-foreground">+${monthlyPrice.toFixed(2)}/mo</span>
                </div>
              </div>
              <div
                className="rounded-xl p-3 text-xs text-muted-foreground space-y-1"
                style={{ backgroundColor: "rgba(232,93,74,0.06)", border: "1px solid rgba(232,93,74,0.2)" }}
              >
                <p className="font-semibold" style={{ color: "#E85D4A" }}>IndieThis only</p>
                <p>
                  Your song streams exclusively on IndieThis. Cancel anytime from your dashboard.
                  To distribute to Spotify or Apple Music, purchase a full license.
                </p>
              </div>
              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 pb-6 pt-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          {step === "select-beat" ? (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={goBack}
              disabled={submitting || audioUploading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}

          {/* Next / action buttons */}
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
                : <><Radio size={14} /> Confirm — +${monthlyPrice.toFixed(2)}/mo</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SavedBeat = {
  id: string;
  createdAt: string;
  beat: {
    id: string;
    title: string;
    coverArtUrl: string | null;
    bpm: number | null;
    musicalKey: string | null;
    fileUrl: string;
    beatLeaseSettings: { streamLeaseEnabled: boolean } | null;
    artist: { name: string; artistName: string | null };
  };
};

export default function StreamLeasesPage() {
  const [leases,       setLeases]       = useState<StreamLease[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState(1.00);
  const [loading,      setLoading]      = useState(true);

  // Saved beats (bookmarks)
  const [savedBeats,      setSavedBeats]      = useState<SavedBeat[]>([]);
  const [removingBookmark, setRemovingBookmark] = useState<string | null>(null);

  // Create modal — optionally with a pre-selected beat from a bookmark
  const [showCreate,       setShowCreate]       = useState(false);
  const [preselectedBeatId, setPreselectedBeatId] = useState<string | undefined>(undefined);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<StreamLease | null>(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState<string | null>(null);

  // Reactivate modal
  const [reactivateTarget, setReactivateTarget] = useState<StreamLease | null>(null);
  const [reactivating,     setReactivating]     = useState(false);
  const [reactivateError,  setReactivateError]  = useState<string | null>(null);

  // Cancelled section
  const [showCancelled, setShowCancelled] = useState(true);

  function loadLeases() {
    setLoading(true);
    Promise.all([
      fetch("/api/dashboard/stream-leases").then((r) => r.json()),
      fetch("/api/dashboard/stream-lease-bookmarks").then((r) => r.json()),
    ]).then(([leasesData, bookmarksData]) => {
      setLeases(leasesData.leases ?? []);
      setMonthlyPrice(leasesData.monthlyPrice ?? 1.00);
      setSavedBeats(bookmarksData.bookmarks ?? []);
    }).finally(() => setLoading(false));
  }

  async function removeBookmark(beatId: string) {
    setRemovingBookmark(beatId);
    try {
      await fetch("/api/dashboard/stream-lease-bookmarks", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ beatId }),
      });
      setSavedBeats((prev) => prev.filter((b) => b.beat.id !== beatId));
    } finally {
      setRemovingBookmark(null);
    }
  }

  useEffect(() => { loadLeases(); }, []);

  const activeLeases    = leases.filter((l) => l.isActive);
  const cancelledLeases = leases.filter((l) => !l.isActive);
  const totalCost       = activeLeases.length * monthlyPrice;

  // Stats — derived from lease data
  const totalPlays     = leases.reduce((sum, l) => sum + l.playCount, 0);
  const mostPlayed     = leases.length > 0
    ? leases.reduce((a, b) => a.playCount > b.playCount ? a : b)
    : null;
  const avgPlays       = leases.length > 0 ? Math.round(totalPlays / leases.length) : 0;

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res  = await fetch(`/api/dashboard/stream-leases/${cancelTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error ?? "Something went wrong."); setCancelling(false); return; }
      setLeases((prev) =>
        prev.map((l) =>
          l.id === cancelTarget.id
            ? { ...l, isActive: false, cancelledAt: new Date().toISOString() }
            : l
        )
      );
      setCancelTarget(null);
    } catch {
      setCancelError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleReactivate() {
    if (!reactivateTarget) return;
    setReactivating(true);
    setReactivateError(null);
    try {
      const res  = await fetch(`/api/dashboard/stream-leases/${reactivateTarget.id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) { setReactivateError(data.error ?? "Something went wrong."); setReactivating(false); return; }
      setLeases((prev) =>
        prev.map((l) =>
          l.id === reactivateTarget.id
            ? { ...l, isActive: true, cancelledAt: null }
            : l
        )
      );
      setReactivateTarget(null);
    } catch {
      setReactivateError("Network error. Please try again.");
    } finally {
      setReactivating(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Radio size={22} style={{ color: "#E85D4A" }} />
            <h1 className="text-2xl font-bold text-foreground">Stream Leases</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Songs you&apos;re streaming on IndieThis using producer beats. ${monthlyPrice.toFixed(2)}/mo per lease.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0 transition-colors"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          <Plus size={15} /> Create Stream Lease
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {/* ── Stats ────────────────────────────────────────────────────── */}
          {leases.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon:  BarChart2,
                  label: "Total Plays",
                  value: totalPlays.toLocaleString(),
                  sub:   "across all leases",
                  color: "#5AC8FA",
                },
                {
                  icon:  TrendingUp,
                  label: "Most Played",
                  value: mostPlayed ? mostPlayed.playCount.toLocaleString() : "—",
                  sub:   mostPlayed ? mostPlayed.trackTitle : "no plays yet",
                  color: "#E85D4A",
                },
                {
                  icon:  Play,
                  label: "Avg Plays / Lease",
                  value: avgPlays.toLocaleString(),
                  sub:   `across ${leases.length} lease${leases.length !== 1 ? "s" : ""}`,
                  color: "#34C759",
                },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div
                  key={label}
                  className="rounded-2xl border p-4"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${color}18` }}
                    >
                      <Icon size={13} style={{ color }} strokeWidth={1.75} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Active Leases ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            {activeLeases.length > 0 ? (
              <div
                className="flex items-center justify-between rounded-2xl px-5 py-4 border"
                style={{ backgroundColor: "rgba(232,93,74,0.07)", borderColor: "rgba(232,93,74,0.25)" }}
              >
                <div className="flex items-center gap-2.5">
                  <Radio size={16} style={{ color: "#E85D4A" }} />
                  <p className="text-sm font-semibold text-foreground">
                    {activeLeases.length} active {activeLeases.length === 1 ? "lease" : "leases"}
                  </p>
                </div>
                <p className="text-sm font-bold" style={{ color: "#E85D4A" }}>
                  ${totalCost.toFixed(2)}/mo added to your subscription
                </p>
              </div>
            ) : (
              <div
                className="rounded-2xl border py-14 text-center space-y-3"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <Radio size={36} className="mx-auto" style={{ color: "#E85D4A", opacity: 0.3 }} />
                <p className="text-sm font-semibold text-foreground">No active stream leases</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Create a stream lease to start streaming your song on IndieThis for ${monthlyPrice.toFixed(2)}/mo.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors mt-2"
                  style={{ borderColor: "rgba(232,93,74,0.4)", color: "#E85D4A", backgroundColor: "rgba(232,93,74,0.07)" }}
                >
                  <Plus size={12} /> Create Your First Lease
                </button>
              </div>
            )}

            {activeLeases.map((lease) => (
              <LeaseCard
                key={lease.id}
                lease={lease}
                monthlyPrice={monthlyPrice}
                onCancel={() => { setCancelTarget(lease); setCancelError(null); }}
              />
            ))}
          </section>

          {/* ── Recently Cancelled ────────────────────────────────────────── */}
          {cancelledLeases.length > 0 && (
            <section className="space-y-3">
              <button
                onClick={() => setShowCancelled((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left"
              >
                {showCancelled ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                Recently Cancelled ({cancelledLeases.length})
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  — reactivate within 30 days to restore
                </span>
              </button>

              {showCancelled && (
                <div className="space-y-3">
                  {cancelledLeases.map((lease) => (
                    <LeaseCard
                      key={lease.id}
                      lease={lease}
                      monthlyPrice={monthlyPrice}
                      onReactivate={() => { setReactivateTarget(lease); setReactivateError(null); }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Saved Beats ───────────────────────────────────────────────── */}
          {savedBeats.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark size={14} style={{ color: "#D4A843" }} />
                <p className="text-sm font-semibold text-foreground">Saved Beats</p>
                <span className="text-xs text-muted-foreground">— record your song, then come back to upload</span>
              </div>

              <div className="space-y-2">
                {savedBeats.map((b) => {
                  const producer = b.beat.artist.artistName ?? b.beat.artist.name;
                  const isRemoving = removingBookmark === b.beat.id;
                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border p-4 flex items-center gap-4"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                    >
                      {/* Cover */}
                      <div
                        className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                        style={{
                          backgroundImage:    b.beat.coverArtUrl ? `url(${b.beat.coverArtUrl})` : undefined,
                          backgroundSize:     "cover",
                          backgroundPosition: "center",
                          backgroundColor:    b.beat.coverArtUrl ? undefined : "var(--border)",
                        }}
                      >
                        {!b.beat.coverArtUrl && <Music2 size={16} className="text-muted-foreground" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{b.beat.title}</p>
                        <p className="text-xs text-muted-foreground truncate">prod. {producer}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {b.beat.bpm && <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{b.beat.bpm} BPM</span>}
                          {b.beat.bpm && b.beat.musicalKey && <span className="text-[11px] text-muted-foreground/40">·</span>}
                          {b.beat.musicalKey && <span className="text-[11px] font-semibold" style={{ color: "#D4A843" }}>{b.beat.musicalKey}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setPreselectedBeatId(b.beat.id);
                            setShowCreate(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
                        >
                          <Mic2 size={11} /> I&apos;m ready to record
                        </button>
                        <a
                          href={`/api/dashboard/stream-lease-beat-download/${b.beat.id}`}
                          download
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 text-muted-foreground"
                          title="Download beat"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          onClick={() => removeBookmark(b.beat.id)}
                          disabled={isRemoving}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 text-muted-foreground disabled:opacity-40"
                          title="Remove bookmark"
                        >
                          {isRemoving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground pl-1">
                <a href="/dashboard/marketplace" className="underline" style={{ color: "#E85D4A" }}>Browse more beats</a>
                {" "}to add to your saved list.
              </p>
            </section>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateStreamLeaseModal
          monthlyPrice={monthlyPrice}
          preselectedBeatId={preselectedBeatId}
          onClose={() => { setShowCreate(false); setPreselectedBeatId(undefined); }}
          onSuccess={() => {
            setShowCreate(false);
            setPreselectedBeatId(undefined);
            loadLeases();
          }}
        />
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelModal
          lease={cancelTarget}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
          loading={cancelling}
          error={cancelError}
        />
      )}

      {/* Reactivate modal */}
      {reactivateTarget && (
        <ReactivateModal
          lease={reactivateTarget}
          monthlyPrice={monthlyPrice}
          onConfirm={handleReactivate}
          onClose={() => setReactivateTarget(null)}
          loading={reactivating}
          error={reactivateError}
        />
      )}
    </div>
  );
}
