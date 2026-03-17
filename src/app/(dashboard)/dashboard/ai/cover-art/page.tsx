"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { Image, Loader2, CheckCircle2, Clock, AlertCircle, Plus, X, Download } from "lucide-react";

type CoverArtJob = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputData: { prompt?: string; style?: string; mood?: string } | null;
  outputUrl: string | null;
  outputData: { revisedPrompt?: string; error?: string } | null;
  createdAt: string;
};

const STATUS_CONFIG = {
  QUEUED:     { color: "text-yellow-400", icon: Clock,        label: "Queued" },
  PROCESSING: { color: "text-blue-400",   icon: Loader2,      label: "Processing" },
  COMPLETED:  { color: "text-emerald-400",icon: CheckCircle2, label: "Completed" },
  FAILED:     { color: "text-red-400",    icon: AlertCircle,  label: "Failed" },
};

const STYLES = ["Photorealistic", "Digital Art", "Oil Painting", "Watercolor", "Minimalist", "Abstract", "Retro / Vintage", "Anime / Illustrated"];
const MOODS  = ["Dark & Moody", "Vibrant & Colorful", "Dreamy", "Gritty", "Ethereal", "Bold & Graphic", "Nostalgic", "Futuristic"];

export default function CoverArtPage() {
  const [jobs, setJobs]           = useState<CoverArtJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [composing, setComposing] = useState(false);
  const [prompt, setPrompt]       = useState("");
  const [style, setStyle]         = useState("Photorealistic");
  const [mood, setMood]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview]     = useState<CoverArtJob | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/cover-art")
      .then(r => r.json())
      .then(d => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/cover-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), style, mood }),
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(prev => [{
          id: data.jobId,
          status: "QUEUED",
          inputData: { prompt: prompt.trim(), style, mood },
          outputUrl: null,
          outputData: null,
          createdAt: new Date().toISOString(),
        }, ...prev]);
        setPrompt(""); setMood(""); setComposing(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cover Art Generator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated album and single artwork, ready to use
          </p>
        </div>
        <button
          onClick={() => setComposing(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> Generate Art
        </button>
      </div>

      {/* Compose form */}
      {composing && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image size={15} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold text-foreground">New Cover Art</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Describe your cover art
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. A lone figure on a neon-lit city rooftop at midnight, rain-soaked streets below…"
              rows={3}
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
                  onClick={() => setStyle(s)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    borderColor: style === s ? "#D4A843" : "var(--border)",
                    backgroundColor: style === s ? "rgba(212,168,67,0.1)" : "transparent",
                    color: style === s ? "#D4A843" : "var(--muted-foreground)",
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
              Mood <span className="normal-case text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? "" : m)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    borderColor: mood === m ? "#D4A843" : "var(--border)",
                    backgroundColor: mood === m ? "rgba(212,168,67,0.1)" : "transparent",
                    color: mood === m ? "#D4A843" : "var(--muted-foreground)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitting || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><Image size={14} /> Generate Cover</>}
          </button>
        </div>
      )}

      {/* Image preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.outputUrl!} alt="Generated cover art" className="w-full aspect-square object-cover" />
            <div
              className="p-4 flex items-center justify-between"
              style={{ backgroundColor: "var(--card)" }}
            >
              <p className="text-xs text-muted-foreground truncate flex-1 mr-3">
                {preview.inputData?.prompt}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={preview.outputUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold no-underline"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  <Download size={12} /> Save
                </a>
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                  style={{ backgroundColor: "var(--border)" }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gallery / list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : jobs.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Image size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No cover art generated yet</p>
          <p className="text-xs text-muted-foreground">
            Describe your vision and let AI bring your artwork to life.
          </p>
        </div>
      ) : (
        <>
          {/* Completed images grid */}
          {jobs.some(j => j.status === "COMPLETED" && j.outputUrl) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {jobs
                .filter(j => j.status === "COMPLETED" && j.outputUrl)
                .map(job => (
                  <button
                    key={job.id}
                    onClick={() => setPreview(job)}
                    className="relative aspect-square rounded-xl overflow-hidden group"
                    style={{ backgroundColor: "var(--border)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={job.outputUrl!}
                      alt={job.inputData?.prompt ?? "Cover art"}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-[10px] text-white leading-tight line-clamp-2">
                        {job.inputData?.prompt}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          )}

          {/* Pending / failed jobs */}
          {jobs.some(j => j.status !== "COMPLETED") && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Progress</p>
              </div>
              {jobs.filter(j => j.status !== "COMPLETED").map(job => {
                const cfg  = STATUS_CONFIG[job.status];
                const Icon = cfg.icon;
                return (
                  <div
                    key={job.id}
                    className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "var(--border)" }}
                    >
                      <Icon
                        size={16}
                        className={job.status === "PROCESSING" ? `${cfg.color} animate-spin` : cfg.color}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{job.inputData?.prompt ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{job.inputData?.style} · {job.inputData?.mood || "No mood"}</p>
                    </div>
                    <p className={`text-xs font-semibold shrink-0 ${cfg.color}`}>{cfg.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
