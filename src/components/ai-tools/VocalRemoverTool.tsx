"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Upload, X, Loader2, Download, CheckCircle2, AlertCircle,
  RotateCcw, Music2, Mic, Drum, Waves, Music,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

type SepStatus = "pending" | "processing" | "completed" | "failed";

interface Separation {
  id:               string;
  originalFileName: string;
  originalFileUrl:  string;
  vocalsUrl:        string | null;
  drumsUrl:         string | null;
  bassUrl:          string | null;
  otherUrl:         string | null;
  status:           SepStatus;
  errorMessage:     string | null;
  createdAt:        string;
}

interface HistoryItem extends Separation {}

const STEM_CARDS = [
  { key: "vocalsUrl", label: "Vocals",        emoji: "🎤", icon: Mic },
  { key: "drumsUrl",  label: "Drums",         emoji: "🥁", icon: Drum },
  { key: "bassUrl",   label: "Bass",          emoji: "🎸", icon: Music2 },
  { key: "otherUrl",  label: "Instruments",   emoji: "🎹", icon: Waves },
] as const;

// ─── Mini audio player ────────────────────────────────────────────────────────

function StemPlayer({ url, label }: { url: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-colors"
        style={playing
          ? { backgroundColor: "#D4A843", color: "#0A0A0A", borderColor: "#D4A843" }
          : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
        }
        title={playing ? `Pause ${label}` : `Play ${label}`}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <a
        href={url}
        download={`${label.toLowerCase()}.wav`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors hover:text-foreground"
        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
      >
        <Download size={11} /> Download
      </a>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VocalRemoverToolProps {
  /** "artist" uses /dashboard/ai/vocal-remover return URLs; "studio" uses /studio/ai-tools/vocal-remover */
  mode: "artist" | "studio";
}

export default function VocalRemoverTool({ mode }: VocalRemoverToolProps) {
  const returnBase = mode === "artist"
    ? "/dashboard/ai/vocal-remover"
    : "/studio/ai-tools/vocal-remover";

  // Upload state
  const [uploadedUrl,  setUploadedUrl]  = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [dragging,     setDragging]     = useState(false);
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Job state
  const [separationId, setSeparationId] = useState<string | null>(null);
  const [jobData,      setJobData]      = useState<Separation | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  // History + pricing
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [priceDisplay,   setPriceDisplay]   = useState(PRICING_DEFAULTS.AI_VOCAL_REMOVER.display);

  // UploadThing — artist track router (256MB audio)
  const { startUpload, isUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => {
      const url  = (res?.[0] as { ufsUrl?: string; url?: string } | undefined)?.ufsUrl
                ?? (res?.[0] as { url?: string } | undefined)?.url ?? "";
      const name = res?.[0]?.name ?? "track";
      if (url) { setUploadedUrl(url); setUploadedName(name); }
      else setUploadError("Upload succeeded but no URL returned. Try again.");
    },
    onUploadError: (err) => setUploadError(err.message ?? "Upload failed. Try again."),
  });

  // ── Load history + check for Stripe return ──────────────────────────────────
  useEffect(() => {
    fetch("/api/ai-tools/vocal-remover")
      .then(r => r.ok ? r.json() : { separations: [] })
      .then(d => {
        setHistory(d.separations ?? []);
        if (d.priceDisplay) setPriceDisplay(d.priceDisplay);
      })
      .finally(() => setHistoryLoading(false));

    // Handle Stripe checkout return
    const params = new URLSearchParams(window.location.search);
    const paid   = params.get("paid");
    const sid    = params.get("session_id");
    const sepId  = params.get("separationId");

    if (paid === "1" && sid && sepId) {
      // Remove query params from URL
      window.history.replaceState({}, "", returnBase);
      setSeparationId(sepId);
      // Start the Replicate job
      fetch("/api/ai-tools/vocal-remover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeSessionId: sid, separationId: sepId }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.separationId) setSeparationId(d.separationId);
        })
        .catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll status every 3 s while processing ───────────────────────────────────
  useEffect(() => {
    if (!separationId) return;
    if (jobData?.status === "completed" || jobData?.status === "failed") return;

    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-tools/vocal-remover/status/${separationId}`);
        if (!res.ok) return;
        const data: Separation = await res.json();
        setJobData(data);
        if (data.status === "completed") {
          setHistory(prev => [data, ...prev.filter(h => h.id !== data.id)]);
        }
      } catch { /* transient */ }
    }, 3000);

    return () => clearInterval(t);
  }, [separationId, jobData?.status]);

  // ── File drag/drop ────────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file.name)) {
      setUploadError("Please upload an audio file (.mp3, .wav, .flac, .m4a, .aac, .ogg)");
      return;
    }
    setUploadError(null);
    startUpload([file]);
  }, [startUpload]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    startUpload([file]);
    e.target.value = "";
  }

  // ── Submit (create Stripe checkout) ──────────────────────────────────────────
  async function handleSubmit() {
    if (!uploadedUrl || !uploadedName) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/ai-tools/vocal-remover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: uploadedUrl, fileName: uploadedName }),
      });
      const data = await res.json();
      if (res.status === 402 && data.requiresUpgrade) {
        window.location.href = "/dashboard/upgrade";
        return;
      }
      if (!res.ok) { setSubmitError(data.error ?? "Failed to start payment"); return; }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setUploadedUrl(null);
    setUploadedName(null);
    setSeparationId(null);
    setJobData(null);
    setSubmitError(null);
    setUploadError(null);
  }

  const isProcessing = jobData && (jobData.status === "pending" || jobData.status === "processing");
  const isComplete   = jobData?.status === "completed";
  const isFailed     = jobData?.status === "failed";

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vocal Remover &amp; Stem Separator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Isolate vocals, drums, bass, and instruments from any track using AI
          </p>
        </div>
        <span
          className="shrink-0 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
          style={{ backgroundColor: "#D4A84322", color: "#D4A843", border: "1px solid #D4A84355" }}
        >
          {priceDisplay} per track
        </span>
      </div>

      {/* ── Main tool area ── */}
      {!separationId && !isProcessing && !isComplete && !isFailed ? (
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Upload zone */}
          {!uploadedUrl ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors"
              style={{ borderColor: dragging ? "#D4A843" : "var(--border)" }}
            >
              {isUploading ? (
                <Loader2 size={28} className="animate-spin text-accent" />
              ) : (
                <Upload size={28} className="text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {isUploading ? "Uploading…" : "Drop your track here or click to upload"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  MP3, WAV, FLAC, M4A, AAC, OGG · Max 256MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Music size={16} className="text-accent shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{uploadedName}</span>
              </div>
              <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> {uploadError}
            </p>
          )}

          {submitError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> {submitError}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!uploadedUrl || isUploading || submitting}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#E05C5C", color: "#fff" }}
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Starting…</span>
              : `Separate Stems — ${priceDisplay}`
            }
          </button>
          <p className="text-xs text-center text-muted-foreground">
            You'll be taken to a secure checkout. Separation begins immediately after payment.
          </p>
        </div>
      ) : null}

      {/* ── Processing state ── */}
      {(isProcessing || (separationId && !jobData)) && (
        <div
          className="rounded-2xl border p-8 flex flex-col items-center gap-4 text-center"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="relative">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#D4A84322" }}
            >
              <Music size={28} style={{ color: "#D4A843" }} />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-accent/40 animate-ping" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Separating stems…</p>
            <p className="text-sm text-muted-foreground mt-1">Usually takes 10–30 seconds</p>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            {["Vocals", "Drums", "Bass", "Instruments"].map(s => (
              <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-full border" style={{ borderColor: "var(--border)" }}>
                <Loader2 size={9} className="animate-spin" /> {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {isComplete && jobData && (
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Stems ready — {jobData.originalFileName}</h2>
            </div>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={12} /> Separate another track
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {STEM_CARDS.map(({ key, label, emoji }) => {
              const url = jobData[key as keyof Separation] as string | null;
              return (
                <div
                  key={key}
                  className="rounded-xl border p-4 space-y-1"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                >
                  <p className="text-sm font-semibold text-foreground">{emoji} {label}</p>
                  {url
                    ? <StemPlayer url={url} label={label} />
                    : <p className="text-xs text-muted-foreground">Not available</p>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Failed state ── */}
      {isFailed && (
        <div
          className="rounded-2xl border p-6 flex items-start gap-3"
          style={{ backgroundColor: "var(--card)", borderColor: "#EF444433" }}
        >
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-foreground">Separation failed</p>
            <p className="text-xs text-muted-foreground">
              {jobData?.errorMessage ?? "Something went wrong. Please try again."}
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold flex items-center gap-1.5"
              style={{ color: "#D4A843" }}
            >
              <RotateCcw size={11} /> Try again
            </button>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {!historyLoading && history.length > 0 && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previous Separations</p>
          </div>
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 px-5 py-4 border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {item.status === "completed" && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                  {item.status === "failed"    && <AlertCircle  size={12} className="text-red-400 shrink-0" />}
                  {item.status === "processing"&& <Loader2      size={12} className="animate-spin text-accent shrink-0" />}
                  <p className="text-sm font-medium text-foreground truncate">{item.originalFileName}</p>
                </div>
                {item.status === "completed" && (
                  <div className="flex flex-wrap gap-2">
                    {STEM_CARDS.map(({ key, label }) => {
                      const url = item[key as keyof HistoryItem] as string | null;
                      return url ? (
                        <a
                          key={key}
                          href={url}
                          download={`${label.toLowerCase()}.wav`}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:text-foreground"
                          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                        >
                          <Download size={9} /> {label}
                        </a>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
