"use client";

import React, { useEffect, useState, Suspense } from "react";
import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useSearchParams } from "next/navigation";
import {
  Film, Loader2, CheckCircle2, Clock, AlertCircle, Upload, X,
  Zap, PlayCircle, ChevronRight, Download, RefreshCw, Music,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import CreditExhaustedBanner from "@/components/dashboard/CreditExhaustedBanner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface Track {
  id:       string;
  title:    string;
  fileUrl:  string | null;
  coverArtUrl?: string | null;
}

interface TranscribedWord {
  word:    string;
  start:   number;
  end:     number;
}

interface TranscribedSegment {
  start: number;
  end:   number;
  text:  string;
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
  words?:              TranscribedWord[];
  segments?:           TranscribedSegment[];
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

const NEXT_CREDITS: Record<string, number> = { launch: 1, push: 3 };

type TextStyle   = "captions" | "centered" | "cinematic" | "minimal" | "visualizer";
type FontChoice  = "inter" | "playfair" | "montserrat" | "oswald" | "raleway";
type AspectRatio = "16:9" | "9:16" | "1:1";
type TextPos     = "bottom" | "center" | "top";
type BgType      = "photo" | "video" | "ai";

const TEXT_STYLES: { value: TextStyle; label: string; preview: string; desc: string }[] = [
  { value: "captions",   label: "Captions",   preview: "[ Hello world ]",         desc: "Line-by-line, active word highlighted" },
  { value: "centered",   label: "Centered",   preview: "       Hello       ",      desc: "One word at a time, center stage" },
  { value: "cinematic",  label: "Cinematic",  preview: "▌ Hello world ▐",          desc: "Blurred bar, slide-in animation" },
  { value: "minimal",    label: "Minimal",    preview: "hello world next...",      desc: "Lowercase, subtle, corner placement" },
  { value: "visualizer", label: "Visualizer", preview: "◉ ~~~waveform~~~ ◉",       desc: "Animated waveform + captions" },
];

const FONT_OPTIONS: { value: FontChoice; label: string; sample: string; style: React.CSSProperties }[] = [
  { value: "inter",      label: "Inter",      sample: "Aa",  style: { fontFamily: "system-ui, sans-serif" } },
  { value: "playfair",   label: "Playfair",   sample: "Aa",  style: { fontFamily: "Georgia, serif", fontStyle: "italic" } },
  { value: "montserrat", label: "Montserrat", sample: "Aa",  style: { fontFamily: "system-ui, sans-serif", letterSpacing: "0.05em" } },
  { value: "oswald",     label: "Oswald",     sample: "Aa",  style: { fontFamily: "Impact, sans-serif", letterSpacing: "0.1em" } },
  { value: "raleway",    label: "Raleway",    sample: "Aa",  style: { fontFamily: "system-ui, sans-serif", fontWeight: 300 } },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string; sub: string }[] = [
  { value: "16:9", label: "YouTube",   sub: "16:9" },
  { value: "9:16", label: "TikTok",    sub: "9:16" },
  { value: "1:1",  label: "Instagram", sub: "1:1"  },
];

// ─── Multi-step wizard steps ───────────────────────────────────────────────────

type Step = "setup" | "lyrics" | "generate";

const STEP_ORDER: Step[] = ["setup", "lyrics", "generate"];
function getStepIndex(s: Step) { return STEP_ORDER.indexOf(s); }

// ─── Inner content ─────────────────────────────────────────────────────────────

function LyricVideoContent() {
  const searchParams = useSearchParams();
  const justPaid     = searchParams.get("paid") === "1";

  // Step
  const [step, setStep] = useState<Step>("setup");

  // Step 1 — Setup
  const [tracks,         setTracks]         = useState<Track[]>([]);
  const [tracksLoading,  setTracksLoading]  = useState(true);
  const [selectedTrack,  setSelectedTrack]  = useState<Track | null>(null);
  const [bgType,         setBgType]         = useState<BgType>("photo");
  const [bgUrl,          setBgUrl]          = useState("");
  const [aspectRatio,    setAspectRatio]    = useState<AspectRatio>("16:9");
  const [textStyle,      setTextStyle]      = useState<TextStyle>("captions");
  const [fontChoice,     setFontChoice]     = useState<FontChoice>("inter");
  const [textPosition,   setTextPosition]   = useState<TextPos>("bottom");
  const [accentColor,    setAccentColor]    = useState("#D4A843");

  // Transcribing
  const [transcribing,   setTranscribing]   = useState(false);
  const [transcribeErr,  setTranscribeErr]  = useState<string | null>(null);
  const [transcribeData, setTranscribeData] = useState<{
    words: TranscribedWord[];
    segments: TranscribedSegment[];
    text: string;
  } | null>(null);

  // Step 2 — Lyrics review (textarea per segment)
  const [editedSegments, setEditedSegments] = useState<TranscribedSegment[]>([]);
  const [previewing,     setPreviewing]     = useState(false);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [previewErr,     setPreviewErr]     = useState<string | null>(null);

  // Step 3 — Generate job
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);
  const [approving,      setApproving]      = useState(false);
  const [approveError,   setApproveError]   = useState<string | null>(null);
  const [activeJobId,    setActiveJobId]    = useState<string | null>(null);
  const [jobData,        setJobData]        = useState<PollData | null>(null);

  // Credits
  const [creditExhausted, setCreditExhausted] = useState(justPaid ? false : false);
  const [creditInfo, setCreditInfo] = useState<{
    used: number; limit: number; tier: string; priceDisplay: string;
  } | null>(null);

  // History
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Background upload
  const { startUpload: uploadBg, isUploading: bgUploading } = useUploadThing(
    "lyricVideoBg",
    { onClientUploadComplete: (res) => { const url = res[0]?.url; if (url) setBgUrl(url); } },
  );

  // ── Load tracks + history on mount ───────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/tracks")
      .then(r => r.ok ? r.json() : { tracks: [] })
      .then(d => setTracks(d.tracks ?? []))
      .finally(() => setTracksLoading(false));

    fetch("/api/dashboard/ai/lyric-video")
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => {
        setHistory(d.jobs ?? []);
        if (d.credits) {
          setCreditInfo({ used: d.credits.used, limit: d.credits.limit, tier: d.credits.tier, priceDisplay: d.priceDisplay ?? "" });
          if (d.credits?.limit === 0) setCreditExhausted(true);
        }
      })
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
        // Transcription ready — move to Step 2
        if (data.transcriptionReady && data.words && step === "setup") {
          setTranscribeData({
            words:    data.words,
            segments: data.segments ?? [],
            text:     data.text ?? "",
          });
          setEditedSegments(data.segments ?? []);
          setStep("lyrics");
        }
      } catch { /* transient */ }
    }, 4000);

    return () => clearInterval(t);
  }, [activeJobId, jobData?.status, step]);

  // ── Step 1: Transcribe ────────────────────────────────────────────────────
  async function handleTranscribe() {
    if (!selectedTrack?.fileUrl) return;
    setTranscribing(true);
    setTranscribeErr(null);
    try {
      const res = await fetch("/api/dashboard/lyric-video/transcribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ trackId: selectedTrack.id }),
      });
      const data = await res.json();
      if (!res.ok) { setTranscribeErr(data.error ?? "Transcription failed"); return; }
      setTranscribeData(data);
      setEditedSegments(data.segments ?? []);
      setStep("lyrics");
    } finally {
      setTranscribing(false);
    }
  }

  // ── Step 2: Preview (10s) ─────────────────────────────────────────────────
  async function handlePreview() {
    if (!selectedTrack?.fileUrl || !transcribeData) return;
    setPreviewing(true);
    setPreviewErr(null);
    setPreviewUrl(null);
    try {
      const correctedWords = buildCorrectedWords();
      const res = await fetch("/api/dashboard/lyric-video/preview", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          lyrics:         correctedWords,
          audioUrl:       selectedTrack.fileUrl,
          trackTitle:     selectedTrack.title,
          artistName:     "",
          backgroundUrl:  bgUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920",
          backgroundType: bgType === "video" ? "video" : "image",
          accentColor,
          textStyle,
          fontChoice,
          textPosition,
          aspectRatio,
          durationMs:     10000,
          previewOnly:    true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setPreviewErr(data.error ?? "Preview failed"); return; }
      if (data.previewUrl) setPreviewUrl(data.previewUrl);
      else if (data.message) setPreviewErr(data.message);
    } finally {
      setPreviewing(false);
    }
  }

  // ── Step 3: Generate full video ───────────────────────────────────────────
  async function handleGenerate() {
    if (!selectedTrack?.fileUrl || !transcribeData) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const correctedWords = buildCorrectedWords();
      // Create the AIJob
      const res = await fetch("/api/dashboard/ai/lyric-video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          trackUrl:      selectedTrack.fileUrl,
          textStyle,
          fontChoice,
          accentColor,
          aspectRatio,
          textPosition,
          backgroundUrl:  bgUrl || "",
          backgroundType: bgType === "video" ? "video" : "image",
          trackTitle:     selectedTrack.title,
          artistName:     "",
          correctedWords,
          aiBackground:   bgType === "ai",
        }),
      });

      if (res.status === 402) { setCreditExhausted(true); return; }

      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Failed to start job"); return; }

      const init: PollData = {
        jobId: data.jobId, status: "QUEUED", priceCharged: null,
        createdAt: new Date().toISOString(), completedAt: null, errorMessage: null,
      };
      setActiveJobId(data.jobId);
      setJobData(init);
      setStep("generate");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Approve lyrics (existing flow for queued jobs) ────────────────────────
  async function handleApprove() {
    if (!activeJobId) return;
    setApproving(true);
    setApproveError(null);
    try {
      const correctedWords = buildCorrectedWords();
      const res = await fetch(`/api/ai-jobs/${activeJobId}/approve-lyrics`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ words: correctedWords }),
      });
      const data = await res.json();
      if (!res.ok) { setApproveError(data.error ?? "Failed to approve"); return; }
      setJobData(prev => prev ? { ...prev, transcriptionReady: false, phase: 2 } : prev);
      setStep("generate");
    } finally {
      setApproving(false);
    }
  }

  // ── Build corrected words from edited segments ────────────────────────────
  function buildCorrectedWords(): TranscribedWord[] {
    if (!transcribeData) return [];
    // Reconstruct words from edited segment text + original word timings
    const allWords = transcribeData.words;
    if (editedSegments.length === 0) return allWords;

    const result: TranscribedWord[] = [];
    for (const seg of editedSegments) {
      // Find original words that fall within this segment
      const segWords = allWords.filter(
        w => w.start >= seg.start - 0.05 && w.end <= seg.end + 0.05,
      );
      // Split edited text back into tokens
      const editedTokens = seg.text.trim().split(/\s+/);
      editedTokens.forEach((token, i) => {
        if (segWords[i]) {
          result.push({ word: token, start: segWords[i].start, end: segWords[i].end });
        } else if (segWords.length > 0) {
          // Distribute remaining tokens across last word's time range
          const last = segWords[segWords.length - 1];
          result.push({ word: token, start: last.start, end: last.end });
        }
      });
    }
    return result;
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const isActive = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");
  function dismissJob() { setJobData(null); setActiveJobId(null); setStep("setup"); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lyric Video</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload your track, review the lyrics, then render your video automatically.
        </p>
      </div>

      {/* Step indicators */}
      {step !== "generate" && (
        <div className="flex items-center gap-2">
          {(["setup", "lyrics", "generate"] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: step === s ? "#D4A843" : "var(--muted-foreground)", opacity: getStepIndex(step) < getStepIndex(s) ? 0.4 : 1 }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: step === s ? "#D4A843" : "var(--border)",
                    color: step === s ? "#0A0A0A" : "var(--muted-foreground)",
                  }}
                >
                  {i + 1}
                </span>
                {s === "setup" ? "Setup" : s === "lyrics" ? "Review Lyrics" : "Generate"}
              </div>
              {i < 2 && <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── STEP 1: Setup ────────────────────────────────────────────────── */}
      {step === "setup" && !isActive && (
        <div className="space-y-6">
          {/* Track selector */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Music size={15} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold text-foreground">Select Track</h2>
            </div>

            {tracksLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> Loading your tracks…
              </div>
            ) : tracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracks found. Upload a track in Music first.</p>
            ) : (
              <select
                value={selectedTrack?.id ?? ""}
                onChange={e => {
                  const t = tracks.find(tr => tr.id === e.target.value) ?? null;
                  setSelectedTrack(t);
                }}
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">— choose a track —</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Background */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-foreground">Background</h2>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: "photo" as BgType, label: "Upload Photo", sub: "jpg, png, webp" },
                { value: "video" as BgType, label: "Upload Video", sub: "mp4, mov" },
                { value: "ai"    as BgType, label: "AI Generated", sub: "+$5.00" },
              ] as { value: BgType; label: string; sub: string }[]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setBgType(opt.value); setBgUrl(""); }}
                  className="rounded-xl border p-3 text-left transition-all"
                  style={{
                    borderColor:     bgType === opt.value ? "#D4A843" : "var(--border)",
                    backgroundColor: bgType === opt.value ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                >
                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>

            {/* Upload area */}
            {bgType !== "ai" && (
              <div>
                {bgUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-sm text-foreground truncate flex-1">Background uploaded</p>
                    <button type="button" onClick={() => setBgUrl("")} className="text-muted-foreground hover:text-foreground">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                    {bgUploading
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                      : <><Upload size={14} /> {bgType === "video" ? "Upload MP4 / MOV" : "Upload JPG / PNG / WebP"}</>}
                    <input
                      type="file"
                      accept={bgType === "video" ? "video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp"}
                      className="sr-only"
                      disabled={bgUploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadBg([f]); e.target.value = ""; }}
                    />
                  </label>
                )}
              </div>
            )}
            {bgType === "ai" && (
              <p className="text-xs text-muted-foreground">
                A background will be generated automatically from your track title and genre. Additional $5.00 applies.
              </p>
            )}
          </div>

          {/* Aspect ratio */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-foreground">Format</h2>
            <div className="flex gap-3">
              {ASPECT_RATIOS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setAspectRatio(r.value)}
                  className="flex-1 rounded-xl border py-3 text-center transition-all"
                  style={{
                    borderColor:     aspectRatio === r.value ? "#D4A843" : "var(--border)",
                    backgroundColor: aspectRatio === r.value ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: aspectRatio === r.value ? "#D4A843" : "var(--foreground)" }}>{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Text style */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-foreground">Text Style</h2>
            <div className="grid grid-cols-1 gap-2">
              {TEXT_STYLES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTextStyle(s.value)}
                  className="rounded-xl border px-4 py-3 text-left flex items-center gap-4 transition-all"
                  style={{
                    borderColor:     textStyle === s.value ? "#D4A843" : "var(--border)",
                    backgroundColor: textStyle === s.value ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground w-36 shrink-0 truncate">{s.preview}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-foreground">Font</h2>
            <div className="flex flex-wrap gap-2">
              {FONT_OPTIONS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFontChoice(f.value)}
                  className="rounded-xl border px-4 py-2.5 flex items-center gap-2 transition-all"
                  style={{
                    borderColor:     fontChoice === f.value ? "#D4A843" : "var(--border)",
                    backgroundColor: fontChoice === f.value ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                >
                  <span style={{ ...f.style, fontSize: 20 }}>{f.sample}</span>
                  <span className="text-xs font-medium" style={{ color: fontChoice === f.value ? "#D4A843" : "var(--foreground)" }}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text position (only for captions + minimal) */}
          {(textStyle === "captions" || textStyle === "minimal") && (
            <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold text-foreground">Text Position</h2>
              <div className="flex gap-2">
                {(["bottom", "center", "top"] as TextPos[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTextPosition(p)}
                    className="flex-1 rounded-xl border py-2 text-xs font-medium capitalize transition-all"
                    style={{
                      borderColor:     textPosition === p ? "#D4A843" : "var(--border)",
                      backgroundColor: textPosition === p ? "rgba(212,168,67,0.08)" : "transparent",
                      color:           textPosition === p ? "#D4A843" : "var(--muted-foreground)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accent color */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Accent Color</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Used for highlighted words</p>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border cursor-pointer shrink-0"
                  style={{ borderColor: "var(--border)", padding: 2 }}
                />
                <span className="text-sm text-muted-foreground font-mono">{accentColor}</span>
                <button
                  type="button"
                  onClick={() => setAccentColor("#D4A843")}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {transcribeErr && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} />
              {transcribeErr}
            </div>
          )}

          {creditExhausted && creditInfo && (
            <CreditExhaustedBanner
              toolLabel="lyric video"
              toolType="LYRIC_VIDEO"
              creditsLimit={creditInfo.limit}
              ppuPrice={creditInfo.priceDisplay || PRICING_DEFAULTS.AI_LYRIC_VIDEO.display}
              nextTierName={creditInfo.tier === "launch" ? "Push" : "Reign"}
              nextTierCredits={NEXT_CREDITS[creditInfo.tier as "launch" | "push"] ?? 0}
              nextTierPrice={creditInfo.tier === "launch" ? "$49/mo" : "$99/mo"}
              isMaxTier={creditInfo.tier === "reign"}
            />
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {PRICING_DEFAULTS.AI_LYRIC_VIDEO.display} or 1 credit
              {bgType === "ai" && " + $5.00 AI background"}
            </p>
            <button
              type="button"
              disabled={!selectedTrack || transcribing}
              onClick={handleTranscribe}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {transcribing
                ? <><Loader2 size={14} className="animate-spin" /> Transcribing…</>
                : <><Film size={14} /> Transcribe Lyrics</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Lyrics review ──────────────────────────────────────────── */}
      {step === "lyrics" && transcribeData && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Transcription ready — {transcribeData.words.length} words
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Edit any words below. Timestamps are locked — only text can be corrected.
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {editedSegments.map((seg, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-2.5 w-12">
                    [{formatTime(seg.start)}]
                  </span>
                  <textarea
                    value={seg.text}
                    onChange={e => {
                      const updated = [...editedSegments];
                      updated[idx] = { ...updated[idx], text: e.target.value };
                      setEditedSegments(updated);
                    }}
                    rows={1}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm bg-transparent text-foreground outline-none resize-none"
                    style={{ borderColor: seg.text !== transcribeData.segments[idx]?.text ? "#D4A843" : "var(--border)" }}
                    onInput={e => {
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Preview section */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Preview (10 seconds, free)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">See how your video will look before generating</p>
              </div>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {previewing ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                Preview 10s
              </button>
            </div>

            {previewErr && (
              <p className="text-xs text-muted-foreground">{previewErr}</p>
            )}

            {previewUrl && (
              <div className="rounded-xl overflow-hidden aspect-video" style={{ backgroundColor: "#000" }}>
                <video src={previewUrl} controls autoPlay className="w-full h-full object-contain" />
              </div>
            )}
          </div>

          {approveError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} />
              {approveError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Back to setup
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={submitting || approving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Starting…</>
                : <><Zap size={14} /> Generate Full Video</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 / Active job status ─────────────────────────────────────── */}
      {(step === "generate" || isActive || (jobData && !isActive)) && jobData && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {/* Queued / rendering */}
          {isActive && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Loader2 size={18} className="animate-spin mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {jobData.status === "QUEUED"
                      ? "Queued — starting render…"
                      : jobData.phase === 2
                      ? "Rendering your lyric video…"
                      : "Processing…"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {jobData.status === "PROCESSING" && jobData.phase !== 2
                      ? "Transcribing audio…"
                      : "Rendering via Lambda. Takes 5–10 minutes."}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    backgroundColor: "#D4A843",
                    width: jobData.status === "QUEUED" ? "5%" : jobData.phase === 2 ? "60%" : "30%",
                  }}
                />
              </div>
              <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">
                ← Cancel
              </button>
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
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "#000",
                  aspectRatio: aspectRatio === "9:16" ? "9/16" : aspectRatio === "1:1" ? "1/1" : "16/9",
                  maxHeight: 400,
                }}
              >
                <video src={jobData.finalVideoUrl} controls className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={jobData.finalVideoUrl}
                  download="lyric-video.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <Download size={14} /> Download MP4
                </a>
                <button
                  type="button"
                  onClick={dismissJob}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <RefreshCw size={14} /> Make another
                </button>
              </div>
            </div>
          )}

          {/* Failed */}
          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Video generation failed</p>
                <p className="text-xs text-red-400/70">{jobData.errorMessage ?? "Unknown error"}</p>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────────── */}
      {!historyLoading && history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Videos</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.map(job => (
              <div key={job.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div className="w-12 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--border)" }}>
                  {job.status === "COMPLETE"   ? <Film size={14} className="text-emerald-400" />
                 : job.status === "PROCESSING" ? <Loader2 size={14} className="text-blue-400 animate-spin" />
                 : job.status === "FAILED"     ? <AlertCircle size={14} className="text-red-400" />
                 : <Clock size={14} className="text-yellow-400" />}
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

// ─── Page wrapper ──────────────────────────────────────────────────────────────

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
