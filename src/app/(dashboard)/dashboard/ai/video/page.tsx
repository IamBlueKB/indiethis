"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { Wand2, Youtube, Loader2, CheckCircle2, Clock, AlertCircle, Plus, X, Upload, ChevronDown } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

type SavedTrack = {
  id: string;
  title: string;
  fileUrl: string;
  projectName: string | null;
};

type AIGeneration = {
  id: string;
  type: string;
  inputData: { songUrl?: string; style?: string; aspectRatio?: string } | null;
  outputUrl: string | null;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
};

type Subscription = {
  tier: string;
  aiVideoCreditsUsed: number;
  aiVideoCreditsLimit: number;
};

const STATUS_CONFIG = {
  QUEUED:     { color: "text-yellow-400", icon: Clock,         label: "Queued" },
  PROCESSING: { color: "text-blue-400",   icon: Loader2,       label: "Processing" },
  COMPLETED:  { color: "text-emerald-400",icon: CheckCircle2,  label: "Completed" },
  FAILED:     { color: "text-red-400",    icon: AlertCircle,   label: "Failed" },
};

const STYLES = ["Visualizer", "Lyric Video", "Beat Sync", "Cinematic", "Waveform"];
const ASPECT_RATIOS = ["16:9 (YouTube)", "9:16 (Reels/TikTok)", "1:1 (Instagram)"];

export default function AIVideoPage() {
  const [generations, setGenerations] = useState<AIGeneration[]>([]);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [songUrl, setSongUrl] = useState("");
  const [songSource, setSongSource] = useState<"url" | "upload" | "existing">("url");
  const [style, setStyle] = useState("Visualizer");
  const [aspectRatio, setAspectRatio] = useState("16:9 (YouTube)");
  const [generating, setGenerating] = useState(false);

  const { startUpload: uploadTrack, isUploading: trackUploading } = useUploadThing("artistTrack", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setSongUrl(url);
    },
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/ai").then(r => r.json()),
      fetch("/api/dashboard/tracks").then(r => r.json()),
    ]).then(([aiData, trackData]) => {
      setGenerations((aiData.generations ?? []).filter((g: AIGeneration) => g.type === "VIDEO"));
      setSubscription(aiData.subscription);
      setSavedTracks(trackData.tracks ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const creditsLeft = subscription
    ? subscription.aiVideoCreditsLimit - subscription.aiVideoCreditsUsed
    : 0;

  async function handleGenerate() {
    if (!songUrl.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/dashboard/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "VIDEO",
          inputData: { songUrl: songUrl.trim(), style, aspectRatio },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGenerations((prev) => [data.generation, ...prev]);
        setSongUrl(""); setComposing(false);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Video</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate music videos from your tracks</p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> New Video
        </button>
      </div>

      {/* Credits bar */}
      {subscription && (
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 size={15} className="text-accent" />
              <span className="text-sm font-semibold text-foreground">Video Credits</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {subscription.aiVideoCreditsUsed} / {subscription.aiVideoCreditsLimit} used
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (subscription.aiVideoCreditsUsed / subscription.aiVideoCreditsLimit) * 100)}%`,
                backgroundColor: creditsLeft <= 1 ? "#f87171" : "var(--accent)",
              }}
            />
          </div>
          {creditsLeft === 0 && (
            <p className="text-xs text-red-400">No credits remaining. Upgrade your plan to generate more videos.</p>
          )}
        </div>
      )}

      {/* Compose form */}
      {composing && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Youtube size={15} className="text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">Generate New Video</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          {/* Song source */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Song Source</label>
            <div className="flex gap-1 p-0.5 rounded-lg border w-fit" style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}>
              {(["url", "upload", "existing"] as const).map(src => (
                <button key={src}
                  onClick={() => { setSongSource(src); setSongUrl(""); }}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={songSource === src
                    ? { backgroundColor: "var(--card)", color: "var(--foreground)" }
                    : { color: "var(--muted-foreground)" }}
                >
                  {src === "url" ? "Paste URL" : src === "upload" ? "Upload File" : "My Tracks"}
                </button>
              ))}
            </div>

            {songSource === "url" && (
              <input value={songUrl} onChange={e => setSongUrl(e.target.value)}
                placeholder="YouTube, SoundCloud, or direct audio URL"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            )}

            {songSource === "upload" && (
              songUrl ? (
                <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "#34C759", backgroundColor: "rgba(52,199,89,0.06)" }}>
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <p className="text-sm text-foreground truncate flex-1">File uploaded</p>
                  <button onClick={() => setSongUrl("")} className="text-muted-foreground hover:text-foreground shrink-0"><X size={13} /></button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold cursor-pointer transition-colors justify-center"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  {trackUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload WAV, MP3, or FLAC</>}
                  <input type="file" accept="audio/*" className="sr-only" disabled={trackUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrack([f]); e.target.value = ""; }} />
                </label>
              )
            )}

            {songSource === "existing" && (
              <div className="relative">
                <select value={songUrl} onChange={e => setSongUrl(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 pr-8 text-sm text-foreground outline-none appearance-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                  <option value="">Select a track…</option>
                  {savedTracks.map(t => (
                    <option key={t.id} value={t.fileUrl}>{t.title}{t.projectName ? ` — ${t.projectName}` : ""}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || trackUploading || !songUrl.trim() || creditsLeft === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            {generating ? <><Loader2 size={14} className="animate-spin" /> Queuing…</>
            : trackUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
            : <><Wand2 size={14} /> Generate Video</>}
          </button>
        </div>
      )}

      {/* Generations list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : generations.length === 0 ? (
        <div
          className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <Wand2 size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No videos generated yet</p>
          <p className="text-xs text-muted-foreground">Click "New Video" and paste a song URL to get started.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Videos</p>
          </div>
          {generations.map((g) => {
            const cfg = STATUS_CONFIG[g.status];
            const Icon = cfg.icon;
            const inputUrl = g.inputData?.songUrl ?? "—";
            const label = `${g.inputData?.style ?? "Visualizer"} · ${g.inputData?.aspectRatio ?? "16:9"}`;
            return (
              <div
                key={g.id}
                className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "var(--border)" }}
                >
                  <Icon size={16} className={g.status === "PROCESSING" ? `${cfg.color} animate-spin` : cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{inputUrl}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                {g.status === "COMPLETED" && g.outputUrl && (
                  <a
                    href={g.outputUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold no-underline"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    Download
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
