"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { Music, Loader2, CheckCircle2, Clock, AlertCircle, Download, Upload, X, ChevronDown, ChevronUp } from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import { useUploadThing } from "@/lib/uploadthing-client";
import MasteringComparisonPlayer, { type MasteringVersion } from "@/components/audio/MasteringComparisonPlayer";
import CreditExhaustedBanner from "@/components/dashboard/CreditExhaustedBanner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface MasteringOutput {
  label:        string;   // "Warm" | "Punchy" | "Broadcast Ready"
  description:  string;
  loudnessLUFS: number;
  measuredLUFS: number | null;
  downloadUrl:  string | null;
  status:       string;
}

interface PollData {
  jobId:        string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  completedAt:  string | null;
  errorMessage: string | null;
  outputData?: {
    outputs?:      MasteringOutput[];
    successCount?: number;
  } | null;
}

interface HistoryItem {
  id:           string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  outputData:   { outputs?: MasteringOutput[]; successCount?: number } | null;
  errorMessage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const NEXT_CREDITS: Record<string, number> = { launch: 3, push: 10 };

// ─── Profile colour map ────────────────────────────────────────────────────────

const PROFILE_COLORS: Record<string, string> = {
  "Warm":              "#F59E0B",
  "Punchy":            "#EF4444",
  "Broadcast Ready":   "#10B981",
};

// ─── History row player (lazy — WaveSurfer only mounts when expanded) ──────────

function HistoryJobPlayer({ versions }: { versions: MasteringVersion[] }) {
  const [open, setOpen] = useState(false);
  if (versions.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-foreground"
        style={{ color: "var(--muted-foreground)" }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Hide Player" : "Compare & Listen"}
      </button>
      {open && <MasteringComparisonPlayer versions={versions} />}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MasteringPage() {
  // Form
  const [trackUrl,   setTrackUrl]   = useState("");
  const [trackTitle, setTrackTitle] = useState("");

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

  // UploadThing
  const { startUpload: uploadTrack, isUploading: trackUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setTrackUrl(url);
    },
  });

  // ── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/ai/mastering")
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
    if (!trackUrl.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/dashboard/ai/mastering", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ trackUrl: trackUrl.trim() }),
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
      setTrackTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  const isActive = jobData && (jobData.status === "QUEUED" || jobData.status === "PROCESSING");
  const outputs  = jobData?.outputData?.outputs ?? [];

  function dismissJob() { setJobData(null); setActiveJobId(null); }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Mastering</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Professional mastering in 3 styles — Warm, Punchy, and Broadcast Ready — delivered in minutes.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Music size={15} style={{ color: "#D4A843" }} />
          <h2 className="text-sm font-semibold text-foreground">Master a Track</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audio File *</label>

            {trackUrl ? (
              <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-foreground truncate flex-1">
                  {trackTitle || "File ready"}
                </p>
                <button
                  type="button"
                  onClick={() => { setTrackUrl(""); setTrackTitle(""); }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  disabled={!!isActive}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                {trackUploading
                  ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                  : <><Upload size={14} /> Upload WAV, MP3, or FLAC</>}
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  disabled={trackUploading || !!isActive}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      uploadTrack([f]);
                      setTrackTitle(f.name.replace(/\.[^/.]+$/, ""));
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            {/* OR paste URL */}
            {!trackUrl && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground text-center">— or paste a URL —</p>
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

          {/* Info about what's generated */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Warm",            desc: "−14 LUFS · Smooth lows",        color: "#F59E0B" },
              { label: "Punchy",          desc: "−9 LUFS · Club-ready",          color: "#EF4444" },
              { label: "Broadcast Ready", desc: "−14 LUFS · Streaming compliant", color: "#10B981" },
            ].map(p => (
              <div key={p.label} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
                <div className="w-1.5 h-1.5 rounded-full mb-1.5" style={{ backgroundColor: p.color }} />
                <p className="text-xs font-semibold text-foreground">{p.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} className="flex-shrink-0" />
              {submitError}
            </div>
          )}

          {creditExhausted && creditInfo && (
            <CreditExhaustedBanner
              toolLabel="mastering"
              creditsLimit={creditInfo.limit}
              ppuPrice={creditInfo.priceDisplay || PRICING_DEFAULTS.AI_MASTERING.display}
              nextTierName={creditInfo.tier === "launch" ? "Push" : "Reign"}
              nextTierCredits={NEXT_CREDITS[creditInfo.tier as "launch" | "push"] ?? 0}
              nextTierPrice={creditInfo.tier === "launch" ? "$49/mo" : "$149/mo"}
              isMaxTier={creditInfo.tier === "reign"}
            />
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">3 masters · {PRICING_DEFAULTS.AI_MASTERING.display} or 1 credit · ~10 min</p>
            <button
              type="submit"
              disabled={submitting || trackUploading || !!isActive || !trackUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
              Start Mastering
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
                  {jobData.status === "QUEUED" ? "Queued — starting soon…" : "Mastering your track…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {jobData.status === "PROCESSING"
                    ? "Running 3 Dolby mastering profiles in parallel. This usually takes 5–10 minutes."
                    : "Job is waiting to start…"}
                </p>
              </div>
            </div>
          )}

          {jobData.status === "COMPLETE" && outputs.length > 0 && (() => {
            const readyVersions: MasteringVersion[] = outputs
              .filter(o => o.status === "Success" && o.downloadUrl)
              .map(o => ({ label: o.label, url: o.downloadUrl! }));
            const failedCount = outputs.length - readyVersions.length;

            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-400">
                      {jobData.outputData?.successCount ?? readyVersions.length} masters ready
                    </p>
                  </div>
                  <button
                    onClick={dismissJob}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Dismiss
                  </button>
                </div>

                {/* Comparison player — instant A/B switching at same playback position */}
                {readyVersions.length >= 1 && (
                  <MasteringComparisonPlayer versions={readyVersions} />
                )}

                {/* Per-profile LUFS detail cards */}
                <div className="grid grid-cols-3 gap-2">
                  {outputs.map(output => (
                    <div key={output.label} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROFILE_COLORS[output.label] ?? "#D4A843" }} />
                        <p className="text-xs font-semibold text-foreground">{output.label}</p>
                      </div>
                      {output.status === "Success" ? (
                        <>
                          {output.measuredLUFS != null && (
                            <p className="text-[11px] text-muted-foreground">{output.measuredLUFS.toFixed(1)} LUFS measured</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">{output.loudnessLUFS} LUFS target</p>
                        </>
                      ) : (
                        <p className="text-[11px] text-red-400/70">Failed to process</p>
                      )}
                    </div>
                  ))}
                </div>

                {failedCount > 0 && (
                  <p className="text-xs text-red-400/70">
                    {failedCount} profile{failedCount > 1 ? "s" : ""} failed to process.
                  </p>
                )}
              </div>
            );
          })()}

          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Mastering failed</p>
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Mastering Jobs</p>
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            {history.map(job => {
              const jobOutputs = job.outputData?.outputs ?? [];
              const successOutputs = jobOutputs.filter(o => o.status === "Success" && o.downloadUrl);
              return (
                <div key={job.id} className="p-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {job.status === "COMPLETE"   && <CheckCircle2 size={13} className="text-emerald-400" />}
                      {job.status === "PROCESSING" && <Loader2 size={13} className="text-blue-400 animate-spin" />}
                      {job.status === "QUEUED"     && <Clock size={13} className="text-yellow-400" />}
                      {job.status === "FAILED"     && <AlertCircle size={13} className="text-red-400" />}
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                      {job.status === "COMPLETE" && (
                        <span className="text-xs text-muted-foreground">
                          · {successOutputs.length} of 3 profiles succeeded
                        </span>
                      )}
                    </div>
                    {job.priceCharged != null && job.priceCharged > 0 && (
                      <span className="text-xs text-muted-foreground">${job.priceCharged.toFixed(2)}</span>
                    )}
                  </div>

                  {successOutputs.length > 0 && (
                    <div className="space-y-2">
                      {/* Download links row */}
                      <div className="flex flex-wrap gap-2">
                        {successOutputs.map(o => (
                          <a
                            key={o.label}
                            href={o.downloadUrl!}
                            download={`${o.label.toLowerCase().replace(/\s+/g, "-")}-master.wav`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            style={{ backgroundColor: "var(--border)", color: "var(--foreground)" }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROFILE_COLORS[o.label] ?? "#D4A843" }} />
                            <Download size={11} /> {o.label}
                          </a>
                        ))}
                      </div>
                      {/* Expandable comparison player */}
                      <HistoryJobPlayer
                        versions={successOutputs.map(o => ({ label: o.label, url: o.downloadUrl! }))}
                      />
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
