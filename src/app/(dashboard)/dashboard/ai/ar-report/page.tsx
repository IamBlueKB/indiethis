"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { BarChart3, Loader2, CheckCircle2, Clock, AlertCircle, Plus, X, ChevronDown, ChevronUp } from "lucide-react";

type ARReportJob = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputData: {
    artistName?: string;
    genre?: string;
    bio?: string;
    trackUrls?: string[];
    targetMarket?: string;
  } | null;
  outputData: { report?: string; artistName?: string; genre?: string; error?: string } | null;
  createdAt: string;
};

const STATUS_CONFIG = {
  QUEUED:     { color: "text-yellow-400", icon: Clock,        label: "Queued" },
  PROCESSING: { color: "text-blue-400",   icon: Loader2,      label: "Processing" },
  COMPLETED:  { color: "text-emerald-400",icon: CheckCircle2, label: "Completed" },
  FAILED:     { color: "text-red-400",    icon: AlertCircle,  label: "Failed" },
};

const GENRES = ["Hip-Hop / Rap", "R&B / Soul", "Pop", "Alternative / Indie", "Electronic / EDM", "Rock", "Country", "Jazz", "Gospel / Christian", "Latin", "Afrobeats", "Other"];

function ReportCard({ job }: { job: ARReportJob }) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = STATUS_CONFIG[job.status];
  const Icon = cfg.icon;
  const name   = job.outputData?.artistName ?? job.inputData?.artistName ?? "Report";
  const genre  = job.outputData?.genre ?? job.inputData?.genre ?? "";
  const report = job.outputData?.report ?? "";

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer"
        onClick={() => job.status === "COMPLETED" && setExpanded(v => !v)}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)" }}
        >
          <Icon
            size={16}
            className={job.status === "PROCESSING" ? `${cfg.color} animate-spin` : cfg.color}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {genre || "Genre not specified"} · {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
          {job.status === "COMPLETED" && (
            expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && report && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div
            className="prose prose-sm prose-invert max-w-none text-foreground leading-relaxed"
            style={{ fontSize: "13px" }}
          >
            {report.split("\n").map((line, i) => {
              if (line.startsWith("## ") || line.startsWith("# ")) {
                const text = line.replace(/^#+\s/, "");
                return <h3 key={i} className="text-sm font-bold text-foreground mt-4 mb-1 first:mt-0">{text}</h3>;
              }
              if (line.startsWith("**") && line.endsWith("**")) {
                const text = line.slice(2, -2);
                return <p key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{text}</p>;
              }
              if (line.match(/^\*\*[^*]+\*\*/)) {
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <p key={i} className="text-sm text-foreground mb-1">
                    {parts.map((part, j) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </p>
                );
              }
              if (line.startsWith("- ") || line.startsWith("• ")) {
                return (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-muted-foreground shrink-0 mt-0.5" style={{ color: "#D4A843" }}>·</span>
                    <p className="text-sm text-foreground">{line.slice(2)}</p>
                  </div>
                );
              }
              if (line.match(/^\d+\.\s/)) {
                const text = line.replace(/^\d+\.\s/, "");
                const num  = line.match(/^(\d+)/)?.[1];
                return (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-[10px] font-bold shrink-0 mt-1" style={{ color: "#D4A843" }}>{num}.</span>
                    <p className="text-sm text-foreground">{text}</p>
                  </div>
                );
              }
              if (!line.trim()) return <div key={i} className="h-2" />;
              return <p key={i} className="text-sm text-foreground mb-1">{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ARReportPage() {
  const [jobs, setJobs]               = useState<ARReportJob[]>([]);
  const [loading, setLoading]         = useState(true);
  const [composing, setComposing]     = useState(false);
  const [artistName, setArtistName]   = useState("");
  const [genre, setGenre]             = useState("");
  const [bio, setBio]                 = useState("");
  const [trackUrls, setTrackUrls]     = useState(["", "", ""]);
  const [targetMarket, setTargetMarket] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/ar-report")
      .then(r => r.json())
      .then(d => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function updateTrackUrl(index: number, value: string) {
    setTrackUrls(prev => prev.map((u, i) => i === index ? value : u));
  }

  async function handleGenerate() {
    if (!artistName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/ar-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: artistName.trim(),
          genre,
          bio: bio.trim(),
          trackUrls: trackUrls.filter(u => u.trim()),
          targetMarket: targetMarket.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(prev => [{
          id: data.jobId,
          status: "QUEUED",
          inputData: { artistName: artistName.trim(), genre, bio: bio.trim(), trackUrls: trackUrls.filter(u => u.trim()), targetMarket: targetMarket.trim() },
          outputData: null,
          createdAt: new Date().toISOString(),
        }, ...prev]);
        setArtistName(""); setGenre(""); setBio(""); setTrackUrls(["", "", ""]); setTargetMarket(""); setComposing(false);
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
          <h1 className="text-2xl font-bold text-foreground">A&R Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated A&R evaluation — executive summary, market position, and recommendations
          </p>
        </div>
        <button
          onClick={() => setComposing(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> New Report
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
              <BarChart3 size={15} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold text-foreground">Generate A&R Report</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Artist Name <span style={{ color: "#E85D4A" }}>*</span>
              </label>
              <input
                value={artistName}
                onChange={e => setArtistName(e.target.value)}
                placeholder="Your artist name or alias"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Genre</label>
              <select
                value={genre}
                onChange={e => setGenre(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                <option value="">Select genre…</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Brief background — where you're from, your sound, your story, any notable achievements…"
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Track URLs <span className="normal-case font-normal text-muted-foreground">(up to 3)</span>
            </label>
            <div className="space-y-2">
              {trackUrls.map((url, i) => (
                <input
                  key={i}
                  value={url}
                  onChange={e => updateTrackUrl(i, e.target.value)}
                  placeholder={`Track ${i + 1} — Spotify, SoundCloud, or YouTube link`}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Market</label>
            <input
              value={targetMarket}
              onChange={e => setTargetMarket(e.target.value)}
              placeholder="e.g. 18–24 urban listeners in Atlanta and Houston, TikTok-driven audience"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitting || !artistName.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><BarChart3 size={14} /> Generate Report</>}
          </button>
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : jobs.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <BarChart3 size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No reports generated yet</p>
          <p className="text-xs text-muted-foreground">
            Generate your first A&R report to see how you stack up in the market.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => <ReportCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}
