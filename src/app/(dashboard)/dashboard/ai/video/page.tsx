"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import {
  Wand2, Loader2, CheckCircle2, Clock, AlertCircle, Upload, X,
  PlayCircle, ChevronRight, Zap,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface ClipSummary {
  total:      number;
  succeeded:  number;
  failed:     number;
  generating: number;
  pending:    number;
}

interface PollData {
  jobId:          string;
  status:         JobStatus;
  priceCharged:   number | null;
  createdAt:      string;
  completedAt:    string | null;
  errorMessage:   string | null;
  phase?:         number;
  durationTier?:  string | null;
  previewReady?:  boolean;
  previewUrl?:    string | null;
  clips?:         ClipSummary;
  stitching?:     boolean;
  finalVideoUrl?: string;
}

interface HistoryItem {
  id:           string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  outputData:   { finalVideoUrl?: string; previewUrl?: string } | null;
  errorMessage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STYLES = [
  { value: "cinematic",    label: "Cinematic",    desc: "Epic wide shots, dramatic pacing" },
  { value: "music-video",  label: "Music Video",  desc: "Performance cuts, fast edits" },
  { value: "documentary",  label: "Documentary",  desc: "Storytelling, slower pacing" },
  { value: "artistic",     label: "Artistic",     desc: "Abstract, experimental" },
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 — YouTube / landscape" },
  { value: "9:16", label: "9:16 — TikTok / Reels" },
  { value: "1:1",  label: "1:1 — Instagram square" },
];

const DURATION_TIERS = [
  { value: "SHORT",  label: "Short",  desc: "Up to 30 sec", price: 19 },
  { value: "MEDIUM", label: "Medium", desc: "Up to 1 min",  price: 29 },
  { value: "FULL",   label: "Full",   desc: "Up to 3 min",  price: 49 },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AIVideoPage() {
  // Form
  const [imageUrl,      setImageUrl]      = useState("");
  const [style,         setStyle]         = useState("cinematic");
  const [aspectRatio,   setAspectRatio]   = useState("16:9");
  const [durationTier,  setDurationTier]  = useState("MEDIUM");

  // Job state
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [approving,    setApproving]    = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [activeJobId,  setActiveJobId]  = useState<string | null>(null);
  const [jobData,      setJobData]      = useState<PollData | null>(null);

  // History
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // UploadThing for still image
  const { startUpload: uploadImage, isUploading: imageUploading } = useUploadThing("trackCoverArt", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setImageUrl(url);
    },
  });

  // ── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/ai/video")
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => setHistory(d.jobs ?? []))
      .finally(() => setHistoryLoading(false));
  }, []);

  // ── Poll active job every 4 s ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId) return;
    if (jobData?.status === "COMPLETE" || jobData?.status === "FAILED") return;

    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-jobs/${activeJobId}`);
        if (!res.ok) return;
        const data: PollData = await res.json();
        setJobData(data);
        if (data.status === "COMPLETE") {
          setHistory(prev => [{
            id:           data.jobId,
            status:       data.status,
            priceCharged: data.priceCharged,
            createdAt:    data.createdAt,
            outputData:   { finalVideoUrl: data.finalVideoUrl },
            errorMessage: null,
          }, ...prev]);
        }
      } catch { /* transient */ }
    }, 4000);

    return () => clearInterval(t);
  }, [activeJobId, jobData?.status]);

  // ── Submit form ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/dashboard/ai/video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          imageUrl:     imageUrl.trim(),
          style,
          aspectRatio,
          durationTier,
        }),
      });

      if (res.status === 402) {
        const d = await res.json();
        const tier = DURATION_TIERS.find(t => t.value === durationTier);
        setSubmitError(`No credits remaining. Pay-per-use: $${d.amountDollars ?? tier?.price ?? "29"}. Add a payment method in Settings.`);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Failed to start job"); return; }

      const init: PollData = {
        jobId: data.jobId, status: "QUEUED", priceCharged: null, phase: 1,
        createdAt: new Date().toISOString(), completedAt: null, errorMessage: null,
      };
      setActiveJobId(data.jobId);
      setJobData(init);
      setImageUrl("");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Approve full render (Phase 1 → Phase 2) ─────────────────────────────────
  async function handleApprove() {
    if (!activeJobId) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/ai-jobs/${activeJobId}/approve-video`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setApproveError(data.error ?? "Failed to approve"); return; }
      // Job is now entering Phase 2 — polling will pick up the state change
      setJobData(prev => prev ? { ...prev, phase: 2, previewReady: false } : prev);
    } finally {
      setApproving(false);
    }
  }

  const isActive = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");

  function dismissJob() { setJobData(null); setActiveJobId(null); }

  // Compute clip progress %
  const clips    = jobData?.clips;
  const clipsDone = (clips?.succeeded ?? 0) + (clips?.failed ?? 0);
  const clipsTotal = clips?.total ?? 0;
  const clipsProgress = clipsTotal > 0 ? Math.round((clipsDone / clipsTotal) * 100) : 0;

  const selectedTier = DURATION_TIERS.find(t => t.value === durationTier);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Music Video</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Turn a photo into a cinematic music video.
        </p>
      </div>

      {/* Form */}
      {!isActive && !jobData && (
        <div className="rounded-2xl border p-5 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Wand2 size={15} style={{ color: "#D4A843" }} />
            <h2 className="text-sm font-semibold text-foreground">New Music Video</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Image upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Starting Image (Photo / Album Cover) *
              </label>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">Image ready</p>
                    <button type="button" onClick={() => setImageUrl("")} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1 mt-1">
                      <X size={11} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                    {imageUploading
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                      : <><Upload size={14} /> Upload photo or album art (JPG, PNG)</>}
                    <input type="file" accept="image/*" className="sr-only" disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage([f]); e.target.value = ""; }}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                    <span className="text-xs text-muted-foreground">or paste URL</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                  </div>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              )}
            </div>

            {/* Style */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visual Style</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyle(s.value)}
                    className="rounded-xl border px-3 py-2.5 text-left transition-all"
                    style={{
                      borderColor:     style === s.value ? "#D4A843" : "var(--border)",
                      backgroundColor: style === s.value ? "rgba(212,168,67,0.08)" : "transparent",
                    }}
                  >
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect ratio */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setAspectRatio(r.value)}
                    className="flex-1 rounded-xl border px-2 py-2 text-xs text-center transition-all"
                    style={{
                      borderColor:     aspectRatio === r.value ? "#D4A843" : "var(--border)",
                      backgroundColor: aspectRatio === r.value ? "rgba(212,168,67,0.08)" : "transparent",
                      color:           aspectRatio === r.value ? "#D4A843" : "var(--muted-foreground)",
                      fontWeight:      aspectRatio === r.value ? "600" : "400",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration tier */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_TIERS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setDurationTier(t.value)}
                    className="rounded-xl border p-3 text-left transition-all"
                    style={{
                      borderColor:     durationTier === t.value ? "#D4A843" : "var(--border)",
                      backgroundColor: durationTier === t.value ? "rgba(212,168,67,0.08)" : "transparent",
                    }}
                  >
                    <p className="text-sm font-bold text-foreground">${t.price}</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                ${selectedTier?.price ?? 29} pay-per-use · Phase 1: preview clips first
              </p>
              <button
                type="submit"
                disabled={submitting || imageUploading || !imageUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                Generate Video
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active job */}
      {jobData && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {/* Phase 1 — generating preview clips */}
          {isActive && !jobData.previewReady && (
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="animate-spin mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {jobData.status === "QUEUED" ? "Queued — starting soon…" : "Phase 1: Generating preview clips…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Animating your image into preview clips. You'll review them before the full render. Takes ~3–5 minutes.
                </p>
              </div>
            </div>
          )}

          {/* Phase 1 done — preview ready for approval */}
          {jobData.status === "PROCESSING" && jobData.previewReady && jobData.phase !== 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">Preview clips ready — review and approve</p>
              </div>

              {jobData.previewUrl && (
                <div className="rounded-xl overflow-hidden aspect-video" style={{ backgroundColor: "var(--border)" }}>
                  <video
                    src={jobData.previewUrl}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay
                    muted
                    loop
                  />
                </div>
              )}

              {approveError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  {approveError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Happy with the clips? Approve to start the full render.</p>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {approving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  Approve Full Render
                </button>
              </div>
            </div>
          )}

          {/* Phase 2 — stitching full video */}
          {isActive && jobData.phase === 2 && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Loader2 size={18} className="animate-spin mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {jobData.stitching ? "Phase 2: Stitching final video…" : "Phase 2: Rendering all clips…"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {clips
                      ? `${clipsDone}/${clipsTotal} clips done · ${clips.generating} generating · ${clips.failed} failed`
                      : "Processing…"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              {clipsTotal > 0 && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${clipsProgress}%`, backgroundColor: "#D4A843" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Complete */}
          {jobData.status === "COMPLETE" && jobData.finalVideoUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">Video complete!</p>
                </div>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">
                  Dismiss
                </button>
              </div>
              <div className="rounded-xl overflow-hidden aspect-video" style={{ backgroundColor: "var(--border)" }}>
                <video src={jobData.finalVideoUrl} controls className="w-full h-full object-contain" />
              </div>
              <a
                href={jobData.finalVideoUrl}
                download="music-video.mp4"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <PlayCircle size={14} /> Download MP4
              </a>
            </div>
          )}

          {/* Failed */}
          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Video generation failed</p>
                <p className="text-xs text-red-400/70">{jobData.errorMessage ?? "Unknown error occurred"}</p>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">Dismiss</button>
              </div>
            </div>
          )}

          {/* Start new button when active */}
          {isActive && (
            <button
              onClick={dismissJob}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Cancel and start new
            </button>
          )}
        </div>
      )}

      {/* History */}
      {!historyLoading && history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Videos</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.map(job => (
              <div key={job.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                {/* Thumbnail */}
                <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "var(--border)" }}>
                  {job.outputData?.finalVideoUrl ? (
                    <video src={job.outputData.finalVideoUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {job.status === "PROCESSING" ? <Loader2 size={12} className="text-blue-400 animate-spin" /> :
                       job.status === "FAILED"     ? <AlertCircle size={12} className="text-red-400" />           :
                       <Clock size={12} className="text-yellow-400" />}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {job.status === "COMPLETE"   && <span className="text-xs text-emerald-400">Completed</span>}
                    {job.status === "PROCESSING" && <span className="text-xs text-blue-400">Processing</span>}
                    {job.status === "QUEUED"     && <span className="text-xs text-yellow-400">Queued</span>}
                    {job.status === "FAILED"     && <span className="text-xs text-red-400">Failed</span>}
                    {job.priceCharged != null && job.priceCharged > 0 && (
                      <span className="text-xs text-muted-foreground">${job.priceCharged.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {job.outputData?.finalVideoUrl && (
                  <a
                    href={job.outputData.finalVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium shrink-0"
                    style={{ color: "#D4A843" }}
                  >
                    Watch <ChevronRight size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
