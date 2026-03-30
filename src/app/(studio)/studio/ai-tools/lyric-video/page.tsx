"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Film, Loader2, CheckCircle2, Clock, AlertCircle, Upload, X,
  Zap, PlayCircle, ChevronRight, Download, RefreshCw, Music, Users,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";
type TextStyle   = "captions" | "centered" | "cinematic" | "minimal" | "visualizer";
type FontChoice  = "inter" | "playfair" | "montserrat" | "oswald" | "raleway";
type AspectRatio = "16:9" | "9:16" | "1:1";
type TextPos     = "bottom" | "center" | "top";
type BgType      = "photo" | "video" | "ai";

interface RosterArtist {
  id:              string;
  name:            string;
  email:           string | null;
  indieThisUserId: string | null;
  indieThisName:   string | null;
}

interface TranscribedWord    { word: string; start: number; end: number; }
interface TranscribedSegment { start: number; end: number; text: string; }

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
  finalVideoUrl?:      string;
}

type Step = "setup" | "lyrics" | "generate";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEXT_STYLES: { value: TextStyle; label: string; desc: string }[] = [
  { value: "captions",   label: "Captions",   desc: "Line-by-line, active word highlighted" },
  { value: "centered",   label: "Centered",   desc: "One word at a time, center stage" },
  { value: "cinematic",  label: "Cinematic",  desc: "Blurred bar, slide-in animation" },
  { value: "minimal",    label: "Minimal",    desc: "Lowercase, subtle corner placement" },
  { value: "visualizer", label: "Visualizer", desc: "Animated waveform + captions" },
];

const FONT_OPTIONS: { value: FontChoice; label: string }[] = [
  { value: "inter",      label: "Inter"      },
  { value: "playfair",   label: "Playfair"   },
  { value: "montserrat", label: "Montserrat" },
  { value: "oswald",     label: "Oswald"     },
  { value: "raleway",    label: "Raleway"    },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string; sub: string }[] = [
  { value: "16:9", label: "YouTube",   sub: "16:9" },
  { value: "9:16", label: "TikTok",    sub: "9:16" },
  { value: "1:1",  label: "Instagram", sub: "1:1"  },
];

// ─── Inner content ─────────────────────────────────────────────────────────────

function StudioLyricVideoContent() {
  // Roster
  const [roster,        setRoster]        = useState<RosterArtist[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selectedArtist, setSelectedArtist] = useState<RosterArtist | null>(null);

  // Step
  const [step, setStep] = useState<Step>("setup");

  // Setup fields
  const [trackUrl,      setTrackUrl]      = useState("");
  const [bgType,        setBgType]        = useState<BgType>("photo");
  const [bgUrl,         setBgUrl]         = useState("");
  const [aspectRatio,   setAspectRatio]   = useState<AspectRatio>("16:9");
  const [textStyle,     setTextStyle]     = useState<TextStyle>("captions");
  const [fontChoice,    setFontChoice]    = useState<FontChoice>("inter");
  const [textPosition,  setTextPosition]  = useState<TextPos>("bottom");
  const [accentColor,   setAccentColor]   = useState("#D4A843");

  // Transcription
  const [transcribing,    setTranscribing]    = useState(false);
  const [transcribeErr,   setTranscribeErr]   = useState<string | null>(null);
  const [transcribeData,  setTranscribeData]  = useState<{
    words: TranscribedWord[];
    segments: TranscribedSegment[];
    text: string;
  } | null>(null);
  const [editedSegments,  setEditedSegments]  = useState<TranscribedSegment[]>([]);

  // Job
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [activeJobId,  setActiveJobId]  = useState<string | null>(null);
  const [jobData,      setJobData]      = useState<PollData | null>(null);

  // Uploads
  const { startUpload: uploadTrack, isUploading: trackUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => { const url = res[0]?.url; if (url) setTrackUrl(url); },
  });
  const { startUpload: uploadBg, isUploading: bgUploading } = useUploadThing(
    "lyricVideoBg",
    { onClientUploadComplete: (res) => { const url = res[0]?.url; if (url) setBgUrl(url); } },
  );

  // Load roster
  useEffect(() => {
    fetch("/api/studio/artists")
      .then(r => r.ok ? r.json() : { contacts: [] })
      .then(d => setRoster(d.contacts ?? []))
      .finally(() => setRosterLoading(false));
  }, []);

  // Poll active job
  useEffect(() => {
    if (!activeJobId) return;
    if (jobData?.status === "COMPLETE" || jobData?.status === "FAILED") return;

    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-jobs/${activeJobId}`);
        if (!res.ok) return;
        const data: PollData = await res.json();
        setJobData(data);
        if (data.transcriptionReady && data.words && step === "setup") {
          setTranscribeData({ words: data.words, segments: data.segments ?? [], text: data.text ?? "" });
          setEditedSegments(data.segments ?? []);
          setStep("lyrics");
        }
      } catch { /* transient */ }
    }, 4000);

    return () => clearInterval(t);
  }, [activeJobId, jobData?.status, step]);

  async function handleTranscribe() {
    if (!trackUrl.trim()) return;
    setTranscribing(true);
    setTranscribeErr(null);
    try {
      const res = await fetch("/api/dashboard/lyric-video/transcribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        // Pass trackUrl directly (studio doesn't have a track record)
        body:    JSON.stringify({ trackUrl: trackUrl.trim() }),
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

  function buildCorrectedWords(): TranscribedWord[] {
    if (!transcribeData) return [];
    const allWords = transcribeData.words;
    if (editedSegments.length === 0) return allWords;

    const result: TranscribedWord[] = [];
    for (const seg of editedSegments) {
      const segWords = allWords.filter(
        w => w.start >= seg.start - 0.05 && w.end <= seg.end + 0.05,
      );
      const editedTokens = seg.text.trim().split(/\s+/);
      editedTokens.forEach((token, i) => {
        if (segWords[i]) {
          result.push({ word: token, start: segWords[i].start, end: segWords[i].end });
        } else if (segWords.length > 0) {
          const last = segWords[segWords.length - 1];
          result.push({ word: token, start: last.start, end: last.end });
        }
      });
    }
    return result;
  }

  async function handleGenerate() {
    if (!trackUrl.trim() || !transcribeData) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const correctedWords = buildCorrectedWords();
      const inputData = {
        trackUrl,
        textStyle,
        fontChoice,
        accentColor,
        aspectRatio,
        textPosition,
        backgroundUrl:  bgUrl || "",
        backgroundType: bgType === "video" ? "video" : "image",
        trackTitle:     "Untitled",
        artistName:     selectedArtist?.name ?? "",
        correctedWords,
        aiBackground:   bgType === "ai",
      };

      const res = await fetch("/api/studio/ai-tools", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type:      "LYRIC_VIDEO",
          inputData,
          contactId: selectedArtist?.id ?? undefined,
        }),
      });

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

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const isActive = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");
  function dismissJob() { setJobData(null); setActiveJobId(null); setStep("setup"); }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Film size={20} style={{ color: "#D4A843" }} />
        <div>
          <h1 className="text-xl font-bold text-foreground">Lyric Video</h1>
          <p className="text-sm text-muted-foreground">
            Upload a track, transcribe lyrics, and render an animated lyric video.
          </p>
        </div>
      </div>

      {/* Artist selector */}
      <div className="rounded-2xl border p-4 space-y-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Users size={13} style={{ color: "#D4A843" }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist (optional)</span>
        </div>
        {rosterLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={12} className="animate-spin" /> Loading roster…</div>
        ) : (
          <select
            value={selectedArtist?.id ?? ""}
            onChange={e => setSelectedArtist(roster.find(a => a.id === e.target.value) ?? null)}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground outline-none"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— No artist (studio job) —</option>
            {roster.map(a => <option key={a.id} value={a.id}>{a.name ?? a.email ?? a.id}</option>)}
          </select>
        )}
      </div>

      {/* Step 1 — Setup */}
      {step === "setup" && (
        <div className="space-y-5">
          {/* Track upload */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Music size={13} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold text-foreground">Audio Track</h2>
            </div>
            {trackUrl ? (
              <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-foreground truncate flex-1">Track uploaded</p>
                <button type="button" onClick={() => setTrackUrl("")} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                {trackUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload WAV, MP3, or FLAC</>}
                <input type="file" accept="audio/*" className="sr-only" disabled={trackUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadTrack([f]); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          {/* Background */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold text-foreground">Background</h2>
            <div className="flex gap-2">
              {([
                { value: "photo" as BgType, label: "Photo" },
                { value: "video" as BgType, label: "Video" },
                { value: "ai"    as BgType, label: "AI (+$5)" },
              ] as { value: BgType; label: string }[]).map(opt => (
                <button key={opt.value} type="button" onClick={() => { setBgType(opt.value); setBgUrl(""); }}
                  className="flex-1 rounded-xl border py-2 text-xs font-medium transition-all"
                  style={{
                    borderColor:     bgType === opt.value ? "#D4A843" : "var(--border)",
                    backgroundColor: bgType === opt.value ? "rgba(212,168,67,0.08)" : "transparent",
                    color:           bgType === opt.value ? "#D4A843" : "var(--muted-foreground)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bgType !== "ai" && !bgUrl && (
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-sm cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                {bgUploading ? <><Loader2 size={13} className="animate-spin" /> Uploading…</> : <><Upload size={13} /> Upload background</>}
                <input type="file" accept={bgType === "video" ? "video/*" : "image/*"} className="sr-only" disabled={bgUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadBg([f]); e.target.value = ""; }}
                />
              </label>
            )}
            {bgUrl && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 size={12} /> Background uploaded
                <button onClick={() => setBgUrl("")} className="ml-auto text-muted-foreground hover:text-foreground"><X size={11} /></button>
              </div>
            )}
          </div>

          {/* Format + Style quick options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border p-4 space-y-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</h2>
              {ASPECT_RATIOS.map(r => (
                <button key={r.value} type="button" onClick={() => setAspectRatio(r.value)}
                  className="w-full rounded-lg border px-3 py-1.5 text-xs text-left transition-all"
                  style={{
                    borderColor:     aspectRatio === r.value ? "#D4A843" : "transparent",
                    backgroundColor: aspectRatio === r.value ? "rgba(212,168,67,0.08)" : "var(--border)",
                    color:           aspectRatio === r.value ? "#D4A843" : "var(--foreground)",
                  }}
                >
                  {r.label} · {r.sub}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border p-4 space-y-2" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Text Style</h2>
              {TEXT_STYLES.map(s => (
                <button key={s.value} type="button" onClick={() => setTextStyle(s.value)}
                  className="w-full rounded-lg border px-3 py-1.5 text-xs text-left transition-all"
                  style={{
                    borderColor:     textStyle === s.value ? "#D4A843" : "transparent",
                    backgroundColor: textStyle === s.value ? "rgba(212,168,67,0.08)" : "var(--border)",
                    color:           textStyle === s.value ? "#D4A843" : "var(--foreground)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {transcribeErr && (
            <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={14} />{transcribeErr}</div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{PRICING_DEFAULTS.AI_LYRIC_VIDEO.display} charged to artist</p>
            <button
              type="button"
              disabled={!trackUrl.trim() || transcribing}
              onClick={handleTranscribe}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {transcribing ? <><Loader2 size={14} className="animate-spin" /> Transcribing…</> : <><Film size={14} /> Transcribe Lyrics</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Lyrics review */}
      {step === "lyrics" && transcribeData && (
        <div className="space-y-5">
          <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Transcription ready — {transcribeData.words.length} words
              </h2>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {editedSegments.map((seg, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-2.5 w-12">[{formatTime(seg.start)}]</span>
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
                  />
                </div>
              ))}
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={14} />{submitError}</div>
          )}

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStep("setup")} className="text-xs text-muted-foreground hover:text-foreground transition">← Back</button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleGenerate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : <><Zap size={14} /> Generate Video</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Job status */}
      {(step === "generate" || isActive || (jobData && !isActive)) && jobData && (
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {isActive && (
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="animate-spin mt-0.5 shrink-0" style={{ color: "#D4A843" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {jobData.status === "QUEUED" ? "Queued…" : "Rendering lyric video…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Takes 5–10 minutes</p>
              </div>
            </div>
          )}

          {jobData.status === "COMPLETE" && jobData.finalVideoUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">Lyric video ready!</p>
              </div>
              <video src={jobData.finalVideoUrl} controls className="w-full rounded-xl" />
              <div className="flex gap-3">
                <a href={jobData.finalVideoUrl} download="lyric-video.mp4" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  <Download size={14} /> Download
                </a>
                <button type="button" onClick={dismissJob}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  <RefreshCw size={14} /> New Video
                </button>
              </div>
            </div>
          )}

          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Failed</p>
                <p className="text-xs text-red-400/70 mt-0.5">{jobData.errorMessage ?? "Unknown error"}</p>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground mt-2 transition">Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper ──────────────────────────────────────────────────────────────

export default function StudioLyricVideoPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    }>
      <StudioLyricVideoContent />
    </Suspense>
  );
}
