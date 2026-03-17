"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { Music, Loader2, CheckCircle2, Clock, AlertCircle, Plus, X, Download, Upload, ChevronDown } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

type SavedTrack = {
  id: string;
  title: string;
  fileUrl: string;
  projectName: string | null;
};

type MasteringJob = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputData: { trackUrl?: string; tier?: string; preset?: string; trackTitle?: string } | null;
  outputUrl: string | null;
  outputData: { loudness?: number; error?: string } | null;
  createdAt: string;
};

const STATUS_CONFIG = {
  QUEUED:     { color: "text-yellow-400", icon: Clock,        label: "Queued" },
  PROCESSING: { color: "text-blue-400",   icon: Loader2,      label: "Processing" },
  COMPLETED:  { color: "text-emerald-400",icon: CheckCircle2, label: "Completed" },
  FAILED:     { color: "text-red-400",    icon: AlertCircle,  label: "Failed" },
};

const PRESETS = [
  { value: "A", label: "Balanced",    desc: "General-purpose, most genres" },
  { value: "B", label: "Bright",      desc: "Pop-forward, high-freq boost" },
  { value: "C", label: "Warm",        desc: "Bass-forward, smooth highs" },
  { value: "D", label: "Dynamic",     desc: "Acoustic / jazz, natural feel" },
  { value: "E", label: "Electronic",  desc: "Aggressive, heavy-hitting" },
  { value: "F", label: "Film",        desc: "Cinematic, wide stereo" },
];

export default function MasteringPage() {
  const [jobs, setJobs]           = useState<MasteringJob[]>([]);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [loading, setLoading]     = useState(true);
  const [composing, setComposing] = useState(false);
  const [trackUrl, setTrackUrl]   = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [trackSource, setTrackSource] = useState<"upload" | "existing">("upload");
  const [tier, setTier]           = useState<"quick" | "studio">("quick");
  const [preset, setPreset]       = useState("A");
  const [submitting, setSubmitting] = useState(false);

  const { startUpload: uploadTrack, isUploading: trackUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setTrackUrl(url);
    },
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/mastering").then(r => r.json()),
      fetch("/api/dashboard/tracks").then(r => r.json()),
    ]).then(([mastData, trackData]) => {
      setJobs(mastData.jobs ?? []);
      setSavedTracks(trackData.tracks ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!trackUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/mastering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUrl: trackUrl.trim(),
          tier,
          preset,
          trackTitle: trackTitle.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(prev => [{
          id: data.jobId,
          status: "QUEUED",
          inputData: { trackUrl: trackUrl.trim(), tier, preset, trackTitle: trackTitle.trim() || "Untitled" },
          outputUrl: null,
          outputData: null,
          createdAt: new Date().toISOString(),
        }, ...prev]);
        setTrackUrl(""); setTrackTitle(""); setTrackSource("upload"); setComposing(false);
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
          <h1 className="text-2xl font-bold text-foreground">AI Mastering</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Professional loudness and EQ mastering for streaming and radio
          </p>
        </div>
        <button
          onClick={() => setComposing(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> Master a Track
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
              <Music size={15} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold text-foreground">New Mastering Job</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          {/* Track source */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Track Source</label>
            <div className="flex gap-1 p-0.5 rounded-lg border w-fit" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              {(["upload", "existing"] as const).map(src => (
                <button
                  key={src}
                  onClick={() => { setTrackSource(src); setTrackUrl(""); setTrackTitle(""); }}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={trackSource === src
                    ? { backgroundColor: "var(--card)", color: "var(--foreground)" }
                    : { color: "var(--muted-foreground)" }}
                >
                  {src === "upload" ? "Upload File" : "My Tracks"}
                </button>
              ))}
            </div>

            {trackSource === "upload" ? (
              <div className="flex items-center gap-3">
                {trackUrl ? (
                  <div className="flex items-center gap-3 flex-1 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-sm text-foreground truncate flex-1">File uploaded</p>
                    <button onClick={() => setTrackUrl("")} className="text-muted-foreground hover:text-foreground shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-colors flex-1 justify-center"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                  >
                    {trackUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload WAV, MP3, or FLAC</>}
                    <input type="file" accept="audio/*" className="sr-only" disabled={trackUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadTrack([f]); setTrackTitle(f.name.replace(/\.[^/.]+$/, "")); } e.target.value = ""; }} />
                  </label>
                )}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={trackUrl}
                  onChange={e => {
                    const t = savedTracks.find(t => t.fileUrl === e.target.value);
                    setTrackUrl(e.target.value);
                    if (t) setTrackTitle(t.title);
                  }}
                  className="w-full rounded-xl border px-3 py-2.5 pr-8 text-sm text-foreground outline-none appearance-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  <option value="">Select a track…</option>
                  {savedTracks.map(t => (
                    <option key={t.id} value={t.fileUrl}>
                      {t.title}{t.projectName ? ` — ${t.projectName}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Track Title (optional)</label>
            <input
              value={trackTitle}
              onChange={e => setTrackTitle(e.target.value)}
              placeholder="e.g. Summer Nights"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Tier */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mastering Tier</label>
            <div className="grid grid-cols-2 gap-3">
              {(["quick", "studio"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className="rounded-xl border p-3 text-left transition-all"
                  style={{
                    borderColor: tier === t ? "#D4A843" : "var(--border)",
                    backgroundColor: tier === t ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {t === "quick" ? "Quick Master" : "Studio Grade"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t === "quick" ? "−14 LUFS · Streaming standard" : "−9 LUFS · Commercial / radio"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preset */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sound Profile</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className="rounded-lg border px-3 py-2 text-left transition-all"
                  style={{
                    borderColor: preset === p.value ? "#D4A843" : "var(--border)",
                    backgroundColor: preset === p.value ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                >
                  <p className="text-xs font-semibold text-foreground">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || trackUploading || !trackUrl.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Queuing…</>
              : trackUploading
              ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
              : <><Music size={14} /> Start Mastering</>}
          </button>
        </div>
      )}

      {/* Jobs list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : jobs.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Music size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No mastering jobs yet</p>
          <p className="text-xs text-muted-foreground">
            Upload a track or pick from your music library to get a professional master in minutes.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mastering Jobs</p>
          </div>
          {jobs.map(job => {
            const cfg  = STATUS_CONFIG[job.status];
            const Icon = cfg.icon;
            const title  = job.inputData?.trackTitle || "Untitled";
            const tierLabel   = job.inputData?.tier === "studio" ? "Studio Grade" : "Quick Master";
            const presetLabel = PRESETS.find(p => p.value === job.inputData?.preset)?.label ?? job.inputData?.preset ?? "A";
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
                  <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                  <p className="text-xs text-muted-foreground">{tierLabel} · {presetLabel}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                  {job.outputData?.loudness ? (
                    <p className="text-[10px] text-muted-foreground">
                      {job.outputData.loudness.toFixed(1)} LUFS
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
                {job.status === "COMPLETED" && job.outputUrl && (
                  <a
                    href={job.outputUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold no-underline shrink-0"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    <Download size={12} /> Download
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
