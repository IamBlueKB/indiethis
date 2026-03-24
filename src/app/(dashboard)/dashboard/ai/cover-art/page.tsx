"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useState, useEffect } from "react";
import { Sparkles, Download, Loader2, CheckCircle2, Clock, AlertCircle, RotateCcw } from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import CreditExhaustedBanner from "@/components/dashboard/CreditExhaustedBanner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface PollData {
  jobId:        string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  completedAt:  string | null;
  errorMessage: string | null;
  imageUrls?:   string[];
  outputData?: {
    imageUrls?:       string[];
    optimizedPrompt?: string;
  } | null;
}

interface HistoryItem {
  id:           string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  outputData:   { imageUrls?: string[] } | null;
  errorMessage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const NEXT_CREDITS: Record<string, number> = { launch: 10, push: 15 };

const STYLES = [
  "Photorealistic", "Digital Art", "Oil Painting", "Watercolor",
  "Minimalist", "Abstract", "Retro / Vintage", "Cinematic",
];

const MOODS = [
  "Dark & Moody", "Vibrant & Colorful", "Dreamy", "Gritty",
  "Ethereal", "Bold & Graphic", "Nostalgic", "Futuristic",
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoverArtPage() {
  // Form
  const [artistPrompt, setArtistPrompt] = useState("");
  const [style,        setStyle]        = useState("Photorealistic");
  const [mood,         setMood]         = useState("");

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

  // ── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/ai/cover-art")
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
            outputData:   data.outputData ?? null,
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
    if (!artistPrompt.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/dashboard/ai/cover-art", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ artistPrompt: artistPrompt.trim(), style, mood }),
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
      setArtistPrompt("");
    } finally {
      setSubmitting(false);
    }
  }

  const isActive  = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");
  const imageUrls = jobData?.outputData?.imageUrls ?? jobData?.imageUrls ?? [];

  function dismissJob() { setJobData(null); setActiveJobId(null); }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Cover Art</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate 4 professional album cover variations from your description.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Describe your cover art *
            </label>
            <textarea
              value={artistPrompt}
              onChange={e => setArtistPrompt(e.target.value)}
              placeholder="e.g. A lone figure on a neon-lit city rooftop at midnight, rain-soaked streets below…"
              rows={3}
              required
              disabled={!!isActive}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Style chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  disabled={!!isActive}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-40"
                  style={{
                    borderColor:       style === s ? "#D4A843" : "var(--border)",
                    backgroundColor:   style === s ? "rgba(212,168,67,0.1)" : "transparent",
                    color:             style === s ? "#D4A843" : "var(--muted-foreground)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Mood chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mood <span className="normal-case font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(mood === m ? "" : m)}
                  disabled={!!isActive}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-40"
                  style={{
                    borderColor:       mood === m ? "#D4A843" : "var(--border)",
                    backgroundColor:   mood === m ? "rgba(212,168,67,0.1)" : "transparent",
                    color:             mood === m ? "#D4A843" : "var(--muted-foreground)",
                  }}
                >
                  {m}
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

          {creditExhausted && creditInfo && (
            <CreditExhaustedBanner
              toolLabel="cover art"
              creditsLimit={creditInfo.limit}
              ppuPrice={creditInfo.priceDisplay || PRICING_DEFAULTS.AI_COVER_ART.display}
              nextTierName={creditInfo.tier === "launch" ? "Push" : "Reign"}
              nextTierCredits={NEXT_CREDITS[creditInfo.tier as "launch" | "push"] ?? 0}
              nextTierPrice={creditInfo.tier === "launch" ? "$49/mo" : "$149/mo"}
              isMaxTier={creditInfo.tier === "reign"}
            />
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">4 variations · {PRICING_DEFAULTS.AI_COVER_ART.display} or 1 credit</p>
            <button
              type="submit"
              disabled={submitting || !!isActive || !artistPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate Cover Art
            </button>
          </div>
        </form>
      </div>

      {/* Active job status */}
      {jobData && (
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {isActive && (
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="animate-spin mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {jobData.status === "QUEUED" ? "Queued — starting soon…" : "Generating your cover art…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {jobData.status === "PROCESSING"
                    ? "Optimizing your prompt with Claude, then generating 4 images via SDXL. Takes ~45 seconds."
                    : "Job is waiting to start…"}
                </p>
              </div>
            </div>
          )}

          {jobData.status === "COMPLETE" && imageUrls.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">{imageUrls.length} images generated</p>
                </div>
                <button
                  onClick={dismissJob}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  <RotateCcw size={12} /> New generation
                </button>
              </div>

              {/* 2×2 image grid */}
              <div className="grid grid-cols-2 gap-3">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden aspect-square" style={{ backgroundColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Cover art variation ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <a
                        href={url}
                        download={`cover-art-${i + 1}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                      >
                        <Download size={14} /> Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {jobData.outputData?.optimizedPrompt && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground select-none">View AI-optimized prompt</summary>
                  <p className="mt-2 leading-relaxed border rounded-lg p-3" style={{ borderColor: "var(--border)" }}>
                    {jobData.outputData.optimizedPrompt}
                  </p>
                </details>
              )}
            </div>
          )}

          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Generation failed</p>
                <p className="text-xs text-red-400/70">{jobData.errorMessage ?? "Unknown error occurred"}</p>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {!historyLoading && history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Generations</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.map((job, idx) => {
              const urls = job.outputData?.imageUrls ?? [];
              return (
                <div
                  key={job.id}
                  className="p-4 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {job.status === "COMPLETE"   && <CheckCircle2 size={13} className="text-emerald-400" />}
                      {job.status === "PROCESSING" && <Loader2 size={13} className="text-blue-400 animate-spin" />}
                      {job.status === "QUEUED"     && <Clock size={13} className="text-yellow-400" />}
                      {job.status === "FAILED"     && <AlertCircle size={13} className="text-red-400" />}
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {job.priceCharged != null && job.priceCharged > 0 && (
                      <span className="text-xs text-muted-foreground">${job.priceCharged.toFixed(2)}</span>
                    )}
                  </div>

                  {urls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {urls.slice(0, 4).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden block"
                          style={{ backgroundColor: "var(--border)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  )}

                  {job.status === "FAILED" && (
                    <p className="text-xs text-red-400/70">{job.errorMessage ?? "Failed"}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
