"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { BarChart3, Loader2, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, Upload, X } from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import { useUploadThing } from "@/lib/uploadthing-client";
import CreditExhaustedBanner from "@/components/dashboard/CreditExhaustedBanner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface AudioAnalysis {
  loudness?:     number | null;
  tempo?:        number | null;
  key?:          string | null;
  mode?:         string | null;
  energy?:       number | null;
  danceability?: number | null;
}

interface PollData {
  jobId:        string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  completedAt:  string | null;
  errorMessage: string | null;
  outputData?: {
    report?:               string;
    lyrics?:               string;
    audioAnalysis?:        AudioAnalysis;
    audioDurationMinutes?: number;
  } | null;
}

interface HistoryItem {
  id:           string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  outputData:   { report?: string } | null;
  errorMessage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const NEXT_CREDITS: Record<string, number> = { launch: 2, push: 5 };

const GENRES = [
  "Hip-Hop / Rap", "R&B / Soul", "Pop", "Alternative / Indie",
  "Electronic / EDM", "Rock", "Country", "Jazz", "Afrobeats", "Latin", "Other",
];

// ─── Markdown renderer (basic) ─────────────────────────────────────────────────

function ReportSection({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:opacity-80 transition"
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{body.trim()}</p>
        </div>
      )}
    </div>
  );
}

function ReportDisplay({ report }: { report: string }) {
  // Split on ## section headers
  const sections: { title: string; body: string }[] = [];
  const lines = report.split("\n");
  let currentTitle = "Report";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentLines.length > 0) {
        sections.push({ title: currentTitle, body: currentLines.join("\n") });
      }
      currentTitle = line.replace(/^##\s+/, "").replace(/\*\*/g, "");
      currentLines = [];
    } else {
      currentLines.push(line.replace(/^\*\*(.+?)\*\*/, "**$1**"));
    }
  }
  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, body: currentLines.join("\n") });
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line px-5 pb-4">{report}</p>;
  }

  return (
    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
      {sections.filter(s => s.body.trim()).map((s, i) => (
        <ReportSection key={i} title={s.title} body={s.body} />
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ARReportPage() {
  // Form
  const [trackUrl,           setTrackUrl]           = useState("");
  const [genre,              setGenre]              = useState("");
  const [artistBio,          setArtistBio]          = useState("");
  const [targetMarket,       setTargetMarket]       = useState("");
  const [comparableArtists,  setComparableArtists]  = useState("");

  // Job state
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData,     setJobData]     = useState<PollData | null>(null);

  // Credits
  const [creditExhausted, setCreditExhausted] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{ used: number; limit: number; tier: string; priceDisplay: string } | null>(null);

  // History
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);

  // UploadThing
  const { startUpload: uploadTrack, isUploading: trackUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setTrackUrl(url);
    },
  });

  // ── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/ai/ar-report")
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
            outputData:   data.outputData ? { report: data.outputData.report } : null,
            errorMessage: null,
          }, ...prev]);
        }
      } catch { /* transient */ }
    }, 4000);

    return () => clearInterval(t);
  }, [activeJobId, jobData?.status]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/dashboard/ai/ar-report", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          trackUrl:          trackUrl.trim(),
          genre,
          artistBio,
          targetMarket,
          comparableArtists,
        }),
      });

      if (res.status === 402) {
        setCreditExhausted(true);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Failed to start job"); return; }

      const init: PollData = {
        jobId: data.jobId, status: "QUEUED", priceCharged: null,
        createdAt: new Date().toISOString(), completedAt: null, errorMessage: null,
      };
      setActiveJobId(data.jobId);
      setJobData(init);
      setTrackUrl("");
    } finally {
      setSubmitting(false);
    }
  }

  const isActive = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");

  function dismissJob() { setJobData(null); setActiveJobId(null); }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">A&R Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deep A&R analysis covering commercial viability, lyric breakdown, audio quality, and marketing strategy.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <BarChart3 size={15} style={{ color: "#D4A843" }} />
          <h2 className="text-sm font-semibold text-foreground">Submit a Track for Analysis</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Track upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Track Audio *</label>
            {trackUrl ? (
              <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-foreground truncate flex-1">Track ready</p>
                <button type="button" onClick={() => setTrackUrl("")} disabled={!!isActive} className="text-muted-foreground hover:text-foreground shrink-0">
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
                  <input type="file" accept="audio/*" className="sr-only" disabled={trackUploading || !!isActive}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrack([f]); e.target.value = ""; }}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                </div>
                <input
                  type="url"
                  value={trackUrl}
                  onChange={e => setTrackUrl(e.target.value)}
                  placeholder="https://example.com/track.mp3"
                  disabled={!!isActive}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            )}
          </div>

          {/* Genre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Genre</label>
            <div className="relative">
              <select
                value={genre}
                onChange={e => setGenre(e.target.value)}
                disabled={!!isActive}
                className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none appearance-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                <option value="">Select genre (optional)</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Artist bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Artist Bio / Background <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={artistBio}
              onChange={e => setArtistBio(e.target.value)}
              placeholder="Brief background about the artist — influences, career stage, goals…"
              rows={2}
              disabled={!!isActive}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Two columns for optional fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Market</label>
              <input
                value={targetMarket}
                onChange={e => setTargetMarket(e.target.value)}
                placeholder="e.g. 18–24, global"
                disabled={!!isActive}
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comparable Artists</label>
              <input
                value={comparableArtists}
                onChange={e => setComparableArtists(e.target.value)}
                placeholder="e.g. Drake, Kendrick"
                disabled={!!isActive}
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} className="flex-shrink-0" />
              {submitError}
            </div>
          )}

          {creditExhausted && creditInfo && (
            <CreditExhaustedBanner
              toolLabel="AR report"
              creditsLimit={creditInfo.limit}
              ppuPrice={creditInfo.priceDisplay || PRICING_DEFAULTS.AI_AAR_REPORT.display}
              nextTierName={creditInfo.tier === "launch" ? "Push" : "Reign"}
              nextTierCredits={NEXT_CREDITS[creditInfo.tier as "launch" | "push"] ?? 0}
              nextTierPrice={creditInfo.tier === "launch" ? "$49/mo" : "$99/mo"}
              isMaxTier={creditInfo.tier === "reign"}
            />
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">Full analysis · {PRICING_DEFAULTS.AI_AAR_REPORT.display} or 1 credit · ~5 min</p>
            <button
              type="submit"
              disabled={submitting || trackUploading || !!isActive || !trackUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
              Generate A&R Report
            </button>
          </div>
        </form>
      </div>

      {/* Active job */}
      {jobData && (
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {isActive && (
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="animate-spin mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {jobData.status === "QUEUED" ? "Queued — starting analysis…" : "Analyzing your track…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {jobData.status === "PROCESSING"
                    ? "Transcribing audio → analyzing frequency response → generating A&R report. Takes ~5 minutes."
                    : "Job is waiting to start…"}
                </p>
              </div>
            </div>
          )}

          {jobData.status === "COMPLETE" && jobData.outputData?.report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">A&R Report complete</p>
                </div>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">
                  Dismiss
                </button>
              </div>

              {/* Audio stats */}
              {jobData.outputData?.audioAnalysis && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Loudness",    value: jobData.outputData.audioAnalysis.loudness != null     ? `${(jobData.outputData.audioAnalysis.loudness as number).toFixed(1)} LUFS` : "—" },
                    { label: "Tempo",       value: jobData.outputData.audioAnalysis.tempo != null        ? `${jobData.outputData.audioAnalysis.tempo} BPM` : "—" },
                    { label: "Key",         value: jobData.outputData.audioAnalysis.key != null          ? `${jobData.outputData.audioAnalysis.key} ${jobData.outputData.audioAnalysis.mode ?? ""}`.trim() : "—" },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--border)" }}>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Report sections */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <ReportDisplay report={jobData.outputData.report} />
              </div>
            </div>
          )}

          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Analysis failed</p>
                <p className="text-xs text-red-400/70">{jobData.errorMessage ?? "Unknown error occurred"}</p>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {!historyLoading && history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Reports</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.map(job => (
              <div key={job.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-80 transition"
                >
                  {job.status === "COMPLETE"   && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                  {job.status === "PROCESSING" && <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />}
                  {job.status === "QUEUED"     && <Clock size={14} className="text-yellow-400 shrink-0" />}
                  {job.status === "FAILED"     && <AlertCircle size={14} className="text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {job.outputData?.report && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {job.outputData.report.slice(0, 100)}…
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.priceCharged != null && job.priceCharged > 0 && (
                      <span className="text-xs text-muted-foreground">${job.priceCharged.toFixed(2)}</span>
                    )}
                    {job.status === "COMPLETE" && job.outputData?.report && (
                      expandedId === job.id
                        ? <ChevronUp size={14} className="text-muted-foreground" />
                        : <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedId === job.id && job.outputData?.report && (
                  <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
                    <ReportDisplay report={job.outputData.report} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
