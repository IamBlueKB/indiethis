"use client";

/**
 * src/app/lyric-video/QuickModeWizard.tsx
 *
 * Lyric Video Studio — Quick Mode Wizard (5 screens)
 *
 * Phase 0: Track input    (upload audio, title, cover art URL)
 * Phase 1: Style picker   (typography style grid with live previews)
 * Phase 2: Confirm + Pay  (summary → Stripe checkout)
 * Phase 3: Generating     (progress poll, step labels)
 * Phase 4: Preview        (video player + download + upsell)
 *
 * Works for both guests (guestEmail via cookie) and logged-in non-subscribers.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter }      from "next/navigation";
import {
  Upload, Music2, ChevronRight, ChevronLeft, Loader2, Download,
  CheckCircle2, AlertCircle, Sparkles, X, Film, Lock, Star,
} from "lucide-react";
import { useUploadThing }  from "@/lib/uploadthing-client";
import TypographyPreview   from "@/components/lyric-video/TypographyPreview";
import type { TypographyStyleData } from "@/components/lyric-video/TypographyPreview";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import AvatarPicker, { type AvatarSelectPayload } from "@/components/avatar/AvatarPicker";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface JobStatus {
  id:           string;
  status:       "PENDING" | "ANALYZING" | "GENERATING" | "STITCHING" | "COMPLETE" | "FAILED";
  progress:     number;
  currentStep:  string | null;
  finalVideoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
}

interface Props {
  guestEmail:     string;
  artistName?:    string | null;
  isSubscriber?:  boolean;
  userId?:        string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GUEST_PRICE    = PRICING_DEFAULTS.LYRIC_VIDEO_QUICK_GUEST.display; // $17.99
const SUB_PRICE      = PRICING_DEFAULTS.LYRIC_VIDEO_QUICK_SUB.display;   // $14.99
const POLL_INTERVAL  = 4000; // ms

const STEP_LABELS: Record<string, string> = {
  PENDING:      "Waiting to start…",
  ANALYZING:    "Analyzing your track…",
  GENERATING:   "Creating video backgrounds…",
  STITCHING:    "Assembling your lyric video…",
  COMPLETE:     "Done!",
  FAILED:       "Something went wrong",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickModeWizard({ guestEmail, artistName, isSubscriber = false, userId = null }: Props) {
  const router = useRouter();

  // ── Wizard phase ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);

  // ── Phase 0: Track ─────────────────────────────────────────────────────────
  const [audioUrl,    setAudioUrl]    = useState<string | null>(null);
  const [audioName,   setAudioName]   = useState<string>("");
  const [trackTitle,  setTrackTitle]  = useState<string>("");
  const [coverArtUrl, setCoverArtUrl] = useState<string>("");
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Phase 1: Style ─────────────────────────────────────────────────────────
  const [styles,         setStyles]         = useState<TypographyStyleData[]>([]);
  const [stylesLoading,  setStylesLoading]  = useState(false);
  const [selectedStyle,  setSelectedStyle]  = useState<TypographyStyleData | null>(null);
  const [visionPrompt,   setVisionPrompt]   = useState<string>("");

  // ── Phase 2: Confirm ───────────────────────────────────────────────────────
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ── Phase 3: Generating ────────────────────────────────────────────────────
  const [jobId,    setJobId]    = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Phase 4: Preview ───────────────────────────────────────────────────────
  // jobStatus.finalVideoUrl is used

  // ── Audio upload via UploadThing ───────────────────────────────────────────
  const { startUpload } = useUploadThing("lyricVideoAudio", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.url ?? (res?.[0] as { serverData?: { url?: string } })?.serverData?.url ?? "";
      if (url) {
        setAudioUrl(url);
        setUploading(false);
        setUploadError(null);
      }
    },
    onUploadError: (err) => {
      setUploadError(err.message || "Upload failed. Please try again.");
      setUploading(false);
    },
  });

  function handleAudioFile(file: File) {
    const validTypes = ["audio/mpeg", "audio/wav", "audio/flac", "audio/aac", "audio/ogg", "audio/x-m4a"];
    const validExts  = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"];
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!validTypes.includes(file.type) && !hasValidExt) {
      setUploadError("Please upload an audio file (MP3, WAV, FLAC, AAC).");
      return;
    }
    if (file.size > 64 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 64MB.");
      return;
    }
    setAudioName(file.name);
    setUploadError(null);
    setUploading(true);
    // Auto-fill title from filename
    if (!trackTitle) {
      setTrackTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim());
    }
    startUpload([file]);
  }

  // ── Load typography styles ────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 1 || styles.length > 0) return;
    setStylesLoading(true);
    fetch("/api/lyric-video/styles")
      .then(r => r.json())
      .then((d: { styles?: TypographyStyleData[] }) => {
        const list = d.styles ?? [];
        setStyles(list);
        if (list.length > 0 && !selectedStyle) setSelectedStyle(list[0]);
      })
      .catch(() => {/* styles load failure — non-fatal */})
      .finally(() => setStylesLoading(false));
  }, [phase]);

  // ── Poll job status ───────────────────────────────────────────────────────

  const pollJob = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/lyric-video/status?jobId=${id}`);
      if (!r.ok) return;
      const d: JobStatus = await r.json();
      setJobStatus(d);
      if (d.status === "COMPLETE") {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase(4);
      } else if (d.status === "FAILED") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (phase !== 3 || !jobId) return;
    pollJob(jobId);
    pollRef.current = setInterval(() => pollJob(jobId), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, jobId, pollJob]);

  // ── Check for ?paid=1&jobId= on mount (Stripe return) ────────────────────

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const paid    = params.get("paid");
    const jId     = params.get("jobId");
    const mode    = params.get("mode");
    if (paid === "1" && jId && mode === "quick") {
      setJobId(jId);
      setPhase(3);
    }
  }, []);

  // ── Stripe checkout ───────────────────────────────────────────────────────

  async function handleCheckout() {
    if (!audioUrl || !trackTitle || !selectedStyle) return;
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const r = await fetch("/api/lyric-video/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode:             "quick",
          audioUrl,
          trackTitle,
          coverArtUrl:      coverArtUrl || null,
          typographyStyleId: selectedStyle.id,
          visionPrompt:     visionPrompt.trim() || null,
          guestEmail,
          guestName:        artistName ?? null,
          isSubscriber,
        }),
      });
      const d = await r.json() as { url?: string; error?: string };
      if (!r.ok || d.error) {
        setCheckoutError(d.error ?? "Failed to start checkout.");
        setCheckingOut(false);
        return;
      }
      if (d.url) window.location.href = d.url;
    } catch {
      setCheckoutError("Network error. Please try again.");
      setCheckingOut(false);
    }
  }

  // ─── Phase renderers ──────────────────────────────────────────────────────

  // Phase 0 — Track Upload
  if (phase === 0) return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <p className="font-bold text-white text-lg">Add Your Track</p>
        <p className="text-sm" style={{ color: "#888" }}>Upload your audio file to get started</p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleAudioFile(file);
        }}
        className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          borderColor:     audioUrl ? "#D4A843" : "#2A2A2A",
          backgroundColor: audioUrl ? "rgba(212,168,67,0.05)" : "#0F0F0F",
          minHeight:       "120px",
          padding:         "24px",
        }}
      >
        {uploading ? (
          <><Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} /><p className="text-sm" style={{ color: "#888" }}>Uploading…</p></>
        ) : audioUrl ? (
          <>
            <CheckCircle2 size={24} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-white">{audioName}</p>
            <button onClick={(e) => { e.stopPropagation(); setAudioUrl(null); setAudioName(""); }} className="text-xs" style={{ color: "#666" }}>
              Change file
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
              <Upload size={18} style={{ color: "#D4A843" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">Drop audio here or click to browse</p>
              <p className="text-xs mt-1" style={{ color: "#666" }}>MP3, WAV, FLAC, AAC · max 64MB</p>
            </div>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); }}
      />

      {uploadError && <p className="text-xs" style={{ color: "#E85D4A" }}>{uploadError}</p>}

      {/* Track title */}
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: "#888" }}>Track Title</label>
        <input
          type="text"
          placeholder="e.g. Midnight Drive"
          value={trackTitle}
          onChange={(e) => setTrackTitle(e.target.value)}
          className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none"
          style={{ borderColor: "#2A2A2A" }}
          onFocus={(e) => (e.target.style.borderColor = "#D4A843")}
          onBlur={(e)  => (e.target.style.borderColor = "#2A2A2A")}
        />
      </div>

      {/* Cover art / avatar reference */}
      {userId ? (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#1E1E1E", backgroundColor: "#111" }}>
          <p className="text-xs font-semibold text-white">Artist Reference <span style={{ color: "#555", fontWeight: 400 }}>(optional — seeds the video color palette)</span></p>
          <AvatarPicker
            compact
            label="Artist Reference"
            selectedUrl={coverArtUrl || undefined}
            onSelect={(p: AvatarSelectPayload) => setCoverArtUrl(p.url)}
            onUploadUrl={(url: string) => setCoverArtUrl(url)}
          />
        </div>
      ) : (
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "#888" }}>
            Cover Art URL <span style={{ color: "#555", fontWeight: 400 }}>(optional — seeds the video color palette)</span>
          </label>
          <input
            type="url"
            placeholder="https://…"
            value={coverArtUrl}
            onChange={(e) => setCoverArtUrl(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none"
            style={{ borderColor: "#2A2A2A" }}
            onFocus={(e) => (e.target.style.borderColor = "#D4A843")}
            onBlur={(e)  => (e.target.style.borderColor = "#2A2A2A")}
          />
        </div>
      )}

      <button
        onClick={() => setPhase(1)}
        disabled={!audioUrl || !trackTitle.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        Choose Style <ChevronRight size={15} />
      </button>
    </div>
  );

  // Phase 1 — Style Picker
  if (phase === 1) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setPhase(0)} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
          <ChevronLeft size={16} style={{ color: "#888" }} />
        </button>
        <div>
          <p className="font-bold text-white text-lg">Choose Your Style</p>
          <p className="text-xs" style={{ color: "#888" }}>Pick how your lyrics will animate</p>
        </div>
      </div>

      {stylesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {styles.map((s) => (
            <TypographyPreview
              key={s.id}
              style={s}
              isSelected={selectedStyle?.id === s.id}
              onClick={() => setSelectedStyle(s)}
            />
          ))}
        </div>
      )}

      {/* Vision prompt */}
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: "#888" }}>
          Visual Direction <span style={{ color: "#555", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="e.g. dark neon cityscape, rain, moody atmosphere"
          value={visionPrompt}
          onChange={(e) => setVisionPrompt(e.target.value)}
          className="w-full rounded-xl border px-4 py-3 text-sm bg-transparent text-white outline-none resize-none"
          style={{ borderColor: "#2A2A2A" }}
          onFocus={(e) => (e.target.style.borderColor = "#D4A843")}
          onBlur={(e)  => (e.target.style.borderColor = "#2A2A2A")}
        />
      </div>

      <button
        onClick={() => setPhase(2)}
        disabled={!selectedStyle}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        Review Order <ChevronRight size={15} />
      </button>
    </div>
  );

  // Phase 2 — Confirm + Pay
  if (phase === 2) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setPhase(1)} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={16} style={{ color: "#888" }} />
        </button>
        <div>
          <p className="font-bold text-white text-lg">Confirm & Pay</p>
          <p className="text-xs" style={{ color: "#888" }}>Review your order before generating</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
        <SummaryRow label="Track" value={trackTitle} />
        <SummaryRow label="Style" value={selectedStyle?.displayName ?? ""} />
        {visionPrompt && <SummaryRow label="Direction" value={visionPrompt.slice(0, 50) + (visionPrompt.length > 50 ? "…" : "")} />}
        <div className="border-t pt-3 mt-1" style={{ borderColor: "#222" }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Quick Mode</span>
            <span className="text-lg font-black" style={{ color: "#D4A843" }}>
              {isSubscriber ? SUB_PRICE : GUEST_PRICE}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "#666" }}>4–8 AI background clips · cinematic typography · instant download</p>
        </div>
      </div>

      {/* What you get */}
      <ul className="space-y-1.5">
        {[
          "AI-generated background scenes per section",
          "5 typography animation styles",
          "Artist branding watermark",
          "MP4 download in 1080p",
        ].map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#888" }}>
            <CheckCircle2 size={12} style={{ color: "#D4A843" }} />
            {f}
          </li>
        ))}
      </ul>

      {checkoutError && <p className="text-xs" style={{ color: "#E85D4A" }}>{checkoutError}</p>}

      <button
        onClick={handleCheckout}
        disabled={checkingOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50"
        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
      >
        {checkingOut ? (
          <><Loader2 size={15} className="animate-spin" /> Processing…</>
        ) : (
          <><Lock size={13} /> Pay {isSubscriber ? SUB_PRICE : GUEST_PRICE} &amp; Generate</>
        )}
      </button>

      <p className="text-center text-xs" style={{ color: "#555" }}>
        Secured by Stripe. No account needed.
      </p>
    </div>
  );

  // Phase 3 — Generating
  if (phase === 3) return (
    <div className="space-y-6 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
        style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)" }}
      >
        <Film size={26} style={{ color: "#D4A843" }} className="animate-pulse" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-white text-lg">Creating Your Lyric Video</p>
        <p className="text-sm" style={{ color: "#888" }}>
          {jobStatus ? STEP_LABELS[jobStatus.status] ?? "Working…" : "Starting generation…"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${jobStatus?.progress ?? 5}%`, backgroundColor: "#D4A843" }}
          />
        </div>
        <p className="text-xs text-right" style={{ color: "#666" }}>{jobStatus?.progress ?? 5}%</p>
      </div>

      {/* Step labels */}
      {["Analyzing track", "Generating backgrounds", "Adding typography", "Finalizing video"].map((step, i) => {
        const progress = jobStatus?.progress ?? 0;
        const done  = progress >= (i + 1) * 25;
        const active = !done && progress >= i * 25;
        return (
          <div key={step} className="flex items-center gap-3 text-left">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: done ? "#D4A843" : active ? "rgba(212,168,67,0.2)" : "#1A1A1A" }}
            >
              {done ? (
                <CheckCircle2 size={12} style={{ color: "#0A0A0A" }} />
              ) : active ? (
                <Loader2 size={10} className="animate-spin" style={{ color: "#D4A843" }} />
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#333", display: "block" }} />
              )}
            </div>
            <p className="text-sm" style={{ color: done ? "#D4A843" : active ? "#F0F0F0" : "#555" }}>
              {step}
            </p>
          </div>
        );
      })}

      {jobStatus?.status === "FAILED" && (
        <div className="rounded-xl border p-4 text-left" style={{ borderColor: "#E85D4A33", backgroundColor: "rgba(232,93,74,0.05)" }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={15} style={{ color: "#E85D4A", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#E85D4A" }}>Generation failed</p>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>{jobStatus.errorMessage ?? "Unknown error. Please contact support."}</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: "#555" }}>
        This typically takes 3–8 minutes. You can close this tab — we&apos;ll email you when it&apos;s ready.
      </p>
    </div>
  );

  // Phase 4 — Preview + Download
  if (phase === 4) return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <CheckCircle2 size={28} className="mx-auto" style={{ color: "#D4A843" }} />
        <p className="font-bold text-white text-lg">Your Lyric Video is Ready!</p>
        <p className="text-sm" style={{ color: "#888" }}>{trackTitle}</p>
      </div>

      {/* Video preview */}
      {jobStatus?.finalVideoUrl && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
          <video
            src={jobStatus.finalVideoUrl}
            poster={jobStatus.thumbnailUrl ?? undefined}
            controls
            className="w-full"
            style={{ maxHeight: "240px" }}
          />
        </div>
      )}

      {/* Download */}
      {jobStatus?.finalVideoUrl && (
        <a
          href={jobStatus.finalVideoUrl}
          download={`${trackTitle} - Lyric Video.mp4`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Download size={15} /> Download MP4
        </a>
      )}

      {/* Upsell */}
      {!isSubscriber && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
          <div className="flex items-center gap-2">
            <Star size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-bold text-white">Unlock unlimited lyric videos</p>
          </div>
          <p className="text-xs" style={{ color: "#888" }}>
            Subscribe to IndieThis and get monthly lyric video credits, AI mastering, music distribution, and 10+ more tools.
          </p>
          <a
            href="/pricing"
            className="block text-center py-2 rounded-lg text-xs font-bold mt-1"
            style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
          >
            View Plans from $9.99/mo →
          </a>
        </div>
      )}

      {/* Make another */}
      <button
        onClick={() => {
          setPhase(0);
          setAudioUrl(null);
          setAudioName("");
          setTrackTitle("");
          setCoverArtUrl("");
          setSelectedStyle(null);
          setVisionPrompt("");
          setJobId(null);
          setJobStatus(null);
        }}
        className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-all hover:border-white/20"
        style={{ borderColor: "#2A2A2A", color: "#888" }}
      >
        <Sparkles size={13} className="inline mr-1.5" />
        Create Another Video
      </button>
    </div>
  );

  return null;
}

// ── Utility ────────────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs flex-shrink-0" style={{ color: "#666" }}>{label}</span>
      <span className="text-xs text-right font-medium" style={{ color: "#F0F0F0" }}>{value}</span>
    </div>
  );
}
