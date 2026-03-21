"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Film, Loader2, CheckCircle2, Clock, AlertCircle, Upload, X,
  Zap, PlayCircle, ChevronRight, Edit3,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface WhisperWord {
  word:  string;
  start: number;
  end:   number;
}

interface PollData {
  jobId:               string;
  status:              JobStatus;
  priceCharged:        number | null;
  createdAt:           string;
  completedAt:         string | null;
  errorMessage:        string | null;
  phase?:              number;
  transcriptionReady?: boolean;
  words?:              WhisperWord[];
  segments?:           { start: number; end: number; text: string }[];
  text?:               string;
  duration?:           number | null;
  finalVideoUrl?:      string;
}

interface HistoryItem {
  id:           string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  outputData:   { finalVideoUrl?: string } | null;
  errorMessage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const VISUAL_STYLES = [
  { value: "gradient",  label: "Gradient",  desc: "Smooth colour gradient background" },
  { value: "cinematic", label: "Cinematic", desc: "Dramatic dark cinematic look" },
  { value: "minimal",   label: "Minimal",   desc: "Clean minimal white/black" },
  { value: "neon",      label: "Neon",      desc: "Neon glow on dark background" },
];

const FONT_STYLES = [
  { value: "bold",    label: "Bold" },
  { value: "elegant", label: "Elegant" },
  { value: "default", label: "Default" },
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 — YouTube" },
  { value: "9:16", label: "9:16 — Reels/TikTok" },
  { value: "1:1",  label: "1:1 — Instagram" },
];

// ─── Transcription review component ───────────────────────────────────────────

function TranscriptionReview({
  words,
  text,
  onApprove,
  approving,
  approveError,
}: {
  words:       WhisperWord[];
  text?:       string;
  onApprove:   (correctedWords?: WhisperWord[]) => void;
  approving:   boolean;
  approveError: string | null;
}) {
  const [editedWords, setEditedWords] = useState<WhisperWord[]>(words);
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null);
  const [editValue,   setEditValue]   = useState("");

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditValue(editedWords[idx].word);
  }

  function saveEdit(idx: number) {
    const updated = editedWords.map((w, i) => i === idx ? { ...w, word: editValue.trim() || w.word } : w);
    setEditedWords(updated);
    setEditingIdx(null);
  }

  const correctedText = editedWords.map(w => w.word).join(" ");
  const hasChanges    = editedWords.some((w, i) => w.word !== words[i].word);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Review transcription</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Click any word to correct it. When happy, approve to generate the video.
        </p>
      </div>

      {/* Word tokens */}
      <div className="rounded-xl border p-4 flex flex-wrap gap-1.5 max-h-52 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
        {editedWords.map((w, i) => (
          editingIdx === i ? (
            <input
              key={i}
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => saveEdit(i)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") saveEdit(i); if (e.key === "Escape") setEditingIdx(null); }}
              className="px-2 py-0.5 rounded-md text-sm border outline-none"
              style={{ borderColor: "#D4A843", backgroundColor: "rgba(212,168,67,0.1)", color: "var(--foreground)", minWidth: 60, width: Math.max(60, editValue.length * 9) }}
            />
          ) : (
            <button
              key={i}
              onClick={() => startEdit(i)}
              className="px-2 py-0.5 rounded-md text-sm transition-all hover:opacity-80"
              style={{
                backgroundColor: w.word !== words[i].word ? "rgba(212,168,67,0.15)" : "var(--border)",
                color:           w.word !== words[i].word ? "#D4A843" : "var(--foreground)",
                border:          `1px solid ${w.word !== words[i].word ? "#D4A843" : "transparent"}`,
              }}
            >
              {w.word}
            </button>
          )
        ))}
      </div>

      {hasChanges && (
        <p className="text-xs text-muted-foreground">
          <span style={{ color: "#D4A843" }}>{editedWords.filter((w, i) => w.word !== words[i].word).length} words edited</span>
          {" — these corrections will be used in the video."}
        </p>
      )}

      {approveError && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={14} className="flex-shrink-0" />
          {approveError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Approve to start rendering (~5–10 min)</p>
        <button
          onClick={() => onApprove(hasChanges ? editedWords : undefined)}
          disabled={approving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {approving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Approve Lyrics & Render
        </button>
      </div>
    </div>
  );
}

// ─── Inner page (needs Suspense for useSearchParams) ──────────────────────────

function LyricVideoContent() {
  const searchParams = useSearchParams();
  const justPaid     = searchParams.get("paid") === "1";

  // Form
  const [trackUrl,     setTrackUrl]     = useState("");
  const [visualStyle,  setVisualStyle]  = useState("gradient");
  const [fontStyle,    setFontStyle]    = useState("bold");
  const [accentColor,  setAccentColor]  = useState("#D4A843");
  const [aspectRatio,  setAspectRatio]  = useState("16:9");
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // UploadThing
  const { startUpload: uploadTrack, isUploading: trackUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setTrackUrl(url);
    },
  });

  // ── Load history on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/ai/lyric-video")
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => setHistory(d.jobs ?? []))
      .finally(() => setHistoryLoading(false));
  }, []);

  // ── Poll active job every 4 s ─────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/dashboard/ai/lyric-video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          trackUrl:    trackUrl.trim(),
          visualStyle,
          fontStyle,
          accentColor,
          aspectRatio,
        }),
      });

      if (res.status === 402) {
        const d = await res.json();
        setSubmitError(`No credits remaining. Pay-per-use: $${d.amountDollars ?? "24.99"}. Add a payment method in Settings.`);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Failed to start job"); return; }

      const init: PollData = {
        jobId: data.jobId, status: "QUEUED", priceCharged: null, phase: 0,
        createdAt: new Date().toISOString(), completedAt: null, errorMessage: null,
      };
      setActiveJobId(data.jobId);
      setJobData(init);
      setTrackUrl("");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Approve lyrics ────────────────────────────────────────────────────────
  async function handleApprove(correctedWords?: WhisperWord[]) {
    if (!activeJobId) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/ai-jobs/${activeJobId}/approve-lyrics`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    correctedWords ? JSON.stringify({ words: correctedWords }) : "{}",
      });
      const data = await res.json();
      if (!res.ok) { setApproveError(data.error ?? "Failed to approve"); return; }
      // Job is now entering Phase 2 rendering — polling will pick up state
      setJobData(prev => prev ? { ...prev, transcriptionReady: false, phase: 2 } : prev);
    } finally {
      setApproving(false);
    }
  }

  const isActive = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");

  function dismissJob() { setJobData(null); setActiveJobId(null); }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lyric Video</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload your track — AI transcribes it, you review the lyrics, then we render the video via Remotion.
        </p>
      </div>

      {/* Form */}
      {!isActive && !jobData && (
        <div className="rounded-2xl border p-5 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Film size={15} style={{ color: "#D4A843" }} />
            <h2 className="text-sm font-semibold text-foreground">New Lyric Video</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Track upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audio Track *</label>
              {trackUrl ? (
                <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <p className="text-sm text-foreground truncate flex-1">Track uploaded — ready to process</p>
                  <button type="button" onClick={() => setTrackUrl("")} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                    {trackUploading
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                      : <><Upload size={14} /> Upload WAV, MP3, or FLAC</>}
                    <input type="file" accept="audio/*" className="sr-only" disabled={trackUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrack([f]); e.target.value = ""; }}
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                    <span className="text-xs text-muted-foreground">or paste URL</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                  </div>
                  <input
                    type="url"
                    value={trackUrl}
                    onChange={e => setTrackUrl(e.target.value)}
                    placeholder="https://example.com/track.mp3"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              )}
            </div>

            {/* Visual style */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visual Style</label>
              <div className="grid grid-cols-2 gap-2">
                {VISUAL_STYLES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setVisualStyle(s.value)}
                    className="rounded-xl border px-3 py-2.5 text-left transition-all"
                    style={{
                      borderColor:     visualStyle === s.value ? "#D4A843" : "var(--border)",
                      backgroundColor: visualStyle === s.value ? "rgba(212,168,67,0.08)" : "transparent",
                    }}
                  >
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced options toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            >
              <Edit3 size={11} />
              {showAdvanced ? "Hide" : "Show"} font & colour options
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-1">
                {/* Font style */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Font Style</label>
                  <div className="flex gap-2">
                    {FONT_STYLES.map(f => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFontStyle(f.value)}
                        className="flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all"
                        style={{
                          borderColor:     fontStyle === f.value ? "#D4A843" : "var(--border)",
                          backgroundColor: fontStyle === f.value ? "rgba(212,168,67,0.08)" : "transparent",
                          color:           fontStyle === f.value ? "#D4A843" : "var(--muted-foreground)",
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent colour */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accent Colour</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer"
                      style={{ borderColor: "var(--border)", padding: 2 }}
                    />
                    <span className="text-sm text-muted-foreground">{accentColor}</span>
                    <button
                      type="button"
                      onClick={() => setAccentColor("#D4A843")}
                      className="text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      Reset to gold
                    </button>
                  </div>
                </div>
              </div>
            )}

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

            {submitError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">Lyric video · {PRICING_DEFAULTS.AI_LYRIC_VIDEO.display} or 1 credit · ~10 min</p>
              <button
                type="submit"
                disabled={submitting || trackUploading || !trackUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                Start Transcription
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active job status */}
      {jobData && (
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {/* Phase 0/1: Transcribing */}
          {isActive && !jobData.transcriptionReady && (
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="animate-spin mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {jobData.status === "QUEUED" ? "Queued — starting transcription…" : "Transcribing your audio…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {jobData.status === "PROCESSING"
                    ? "Running word-level transcription. Takes ~1–3 minutes."
                    : "Job is waiting to start…"}
                </p>
              </div>
            </div>
          )}

          {/* Phase 1 done — transcription ready for review */}
          {jobData.transcriptionReady && jobData.words && !jobData.finalVideoUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">
                  Transcription ready — {jobData.words.length} words
                  {jobData.duration && ` · ${jobData.duration.toFixed(0)}s`}
                </p>
              </div>

              <TranscriptionReview
                words={jobData.words}
                text={jobData.text}
                onApprove={handleApprove}
                approving={approving}
                approveError={approveError}
              />
            </div>
          )}

          {/* Phase 2: rendering */}
          {isActive && jobData.phase === 2 && !jobData.transcriptionReady && (
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="animate-spin mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">Phase 2: Rendering lyric video…</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generating Remotion animation script and rendering on Lambda. Takes ~5–10 minutes.
                </p>
              </div>
            </div>
          )}

          {/* Complete */}
          {jobData.status === "COMPLETE" && jobData.finalVideoUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">Lyric video ready!</p>
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
                download="lyric-video.mp4"
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
                <p className="text-sm font-semibold">Lyric video generation failed</p>
                <p className="text-xs text-red-400/70">{jobData.errorMessage ?? "Unknown error occurred"}</p>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">Dismiss</button>
              </div>
            </div>
          )}

          {/* Cancel button when active (not in transcription review) */}
          {isActive && !jobData.transcriptionReady && (
            <button onClick={dismissJob} className="mt-4 text-xs text-muted-foreground hover:text-foreground transition">
              ← Cancel and start new
            </button>
          )}
        </div>
      )}

      {/* History */}
      {!historyLoading && history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Lyric Videos</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.map(job => (
              <div key={job.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: "var(--border)" }}>
                  {job.status === "COMPLETE"   ? <Film size={16} className="text-emerald-400" />          :
                   job.status === "PROCESSING" ? <Loader2 size={16} className="text-blue-400 animate-spin" /> :
                   job.status === "FAILED"     ? <AlertCircle size={16} className="text-red-400" />       :
                   <Clock size={16} className="text-yellow-400" />}
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

// ─── Page wrapper (Suspense for useSearchParams) ───────────────────────────────

export default function LyricVideoPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    }>
      <LyricVideoContent />
    </Suspense>
  );
}
