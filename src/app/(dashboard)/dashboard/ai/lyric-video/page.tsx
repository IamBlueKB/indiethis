"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Film, Loader2, CheckCircle2, Clock, AlertCircle, Plus, X, Download, Zap, CreditCard } from "lucide-react";

type LyricVideoJob = {
  id: string;
  inputData: {
    songTitle?: string;
    fontStyle?: string;
    background?: string;
    accentColor?: string;
    aspectRatio?: string;
  } | null;
  outputUrl: string | null;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
};

type Subscription = {
  tier: string;
  lyricVideoCreditsUsed: number;
  lyricVideoCreditsLimit: number;
};

const STATUS_CONFIG = {
  QUEUED:     { color: "text-yellow-400", icon: Clock,        label: "Queued" },
  PROCESSING: { color: "text-blue-400",   icon: Loader2,      label: "Processing" },
  COMPLETED:  { color: "text-emerald-400",icon: CheckCircle2, label: "Completed" },
  FAILED:     { color: "text-red-400",    icon: AlertCircle,  label: "Failed" },
};

const FONT_STYLES  = ["Minimal", "Bold", "Elegant", "Neon", "Handwritten"];
const BACKGROUNDS  = ["Pure Black", "Gradient", "Abstract", "Bokeh", "Cinematic"];
const ACCENT_COLORS = ["White", "Gold", "Cyan", "Rose", "Lime"];
const ASPECT_RATIOS = ["16:9 (YouTube)", "9:16 (Reels/TikTok)", "1:1 (Instagram)"];

function LyricVideoContent() {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("paid") === "1";

  const [jobs, setJobs] = useState<LyricVideoJob[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(justPaid); // open form on return from payment

  const [songTitle, setSongTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [fontStyle, setFontStyle] = useState("Minimal");
  const [background, setBackground] = useState("Pure Black");
  const [accentColor, setAccentColor] = useState("White");
  const [aspectRatio, setAspectRatio] = useState("16:9 (YouTube)");
  const [generating, setGenerating] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/lyric-video")
      .then((r) => r.json())
      .then((d) => {
        setJobs(d.jobs ?? []);
        setSubscription(d.subscription ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const creditsUsed  = subscription?.lyricVideoCreditsUsed  ?? 0;
  const creditsLimit = subscription?.lyricVideoCreditsLimit ?? 0;
  const creditsLeft  = creditsLimit - creditsUsed;
  const hasCredits   = creditsLeft > 0;

  async function handleGenerate() {
    if (!lyrics.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/dashboard/lyric-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songTitle: songTitle.trim(), lyrics: lyrics.trim(), fontStyle, background, accentColor, aspectRatio }),
      });
      if (res.ok) {
        const data = await res.json() as { job: LyricVideoJob };
        setJobs((prev) => [data.job, ...prev]);
        setSongTitle(""); setLyrics(""); setComposing(false);
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? "Something went wrong.");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleBuy() {
    setBuyLoading(true);
    try {
      const res = await fetch("/api/stripe/pay-per-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "LYRIC_VIDEO" }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Could not start checkout.");
      }
    } finally {
      setBuyLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <AIToolsNav />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lyric Video</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Animated lyric videos synced to your music
          </p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> New Lyric Video
        </button>
      </div>

      {/* Payment success banner */}
      {justPaid && (
        <div
          className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ backgroundColor: "#D4A84314", borderColor: "#D4A84360" }}
        >
          <CheckCircle2 size={16} style={{ color: "#D4A843" }} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Payment successful!</p>
            <p className="text-xs text-muted-foreground">1 lyric video credit added. Fill in your details below and generate.</p>
          </div>
        </div>
      )}

      {/* Pricing & credits card */}
      {!loading && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--border)" }}>
            {/* Left: plan credit */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: "#D4A843" }} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Included with Plan</span>
              </div>
              {creditsLimit > 0 ? (
                <>
                  <p className="text-sm text-foreground">
                    <span className="font-bold text-foreground">{creditsLeft}</span>
                    <span className="text-muted-foreground"> / {creditsLimit} credit{creditsLimit !== 1 ? "s" : ""} remaining</span>
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (creditsUsed / creditsLimit) * 100)}%`,
                        backgroundColor: creditsLeft <= 0 ? "#f87171" : "#D4A843",
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground capitalize">{subscription?.tier.toLowerCase()} plan</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Not included in your current plan.</p>
                  <a
                    href="/dashboard/upgrade"
                    className="inline-flex items-center gap-1 text-xs font-semibold no-underline"
                    style={{ color: "#D4A843" }}
                  >
                    Upgrade to Push or Reign →
                  </a>
                </>
              )}
            </div>

            {/* Right: pay per use */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pay Per Use</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">$24.99</p>
                <p className="text-xs text-muted-foreground mt-0.5">one lyric video · no subscription needed</p>
              </div>
              <button
                onClick={handleBuy}
                disabled={buyLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--border)", color: "var(--foreground)" }}
              >
                {buyLoading
                  ? <><Loader2 size={12} className="animate-spin" /> Redirecting…</>
                  : <><CreditCard size={12} /> Buy for $24.99</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose form */}
      {composing && (
        <div
          className="rounded-2xl border p-5 space-y-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Create Lyric Video</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Song Title</label>
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="e.g. Midnight Drive"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lyrics <span className="text-muted-foreground font-normal normal-case">(paste full lyrics)</span>
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={"[Verse 1]\nDriving through the neon glow\n..."}
              rows={8}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none font-mono"
              style={{ borderColor: "var(--border)" }}
            />
            <p className="text-[11px] text-muted-foreground">{lyrics.split("\n").filter(Boolean).length} lines</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Font Style</label>
              <div className="flex flex-wrap gap-1.5">
                {FONT_STYLES.map((f) => (
                  <button key={f} onClick={() => setFontStyle(f)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: fontStyle === f ? "#D4A843" : "var(--border)", color: fontStyle === f ? "#0A0A0A" : "var(--muted-foreground)" }}
                  >{f}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background</label>
              <div className="flex flex-wrap gap-1.5">
                {BACKGROUNDS.map((b) => (
                  <button key={b} onClick={() => setBackground(b)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: background === b ? "#D4A843" : "var(--border)", color: background === b ? "#0A0A0A" : "var(--muted-foreground)" }}
                  >{b}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accent Color</label>
              <div className="flex flex-wrap gap-1.5">
                {ACCENT_COLORS.map((c) => (
                  <button key={c} onClick={() => setAccentColor(c)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: accentColor === c ? "#D4A843" : "var(--border)", color: accentColor === c ? "#0A0A0A" : "var(--muted-foreground)" }}
                  >{c}</button>
                ))}
              </div>
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

          {/* Dynamic submit — generate (with credits) or buy (without) */}
          {hasCredits ? (
            <button
              onClick={handleGenerate}
              disabled={generating || !lyrics.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {generating
                ? <><Loader2 size={14} className="animate-spin" /> Queuing…</>
                : <><Film size={14} /> Generate Lyric Video</>}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleBuy}
                disabled={buyLoading || !lyrics.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {buyLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                  : <><CreditCard size={14} /> Buy for $24.99 &amp; Generate</>}
              </button>
              <p className="text-xs text-muted-foreground">Your lyrics will be ready when you return</p>
            </div>
          )}
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
          <Film size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No lyric videos yet</p>
          <p className="text-xs text-muted-foreground">Paste your lyrics and pick a style to get started.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Videos</p>
          </div>
          {jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status];
            const Icon = cfg.icon;
            const title = job.inputData?.songTitle || "Untitled";
            const label = `${job.inputData?.fontStyle ?? "Minimal"} · ${job.inputData?.background ?? "Pure Black"} · ${job.inputData?.aspectRatio ?? "16:9"}`;
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
                  <Icon size={16} className={job.status === "PROCESSING" ? `${cfg.color} animate-spin` : cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                  <p className="text-xs text-muted-foreground truncate">{label}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                {job.status === "COMPLETED" && job.outputUrl && (
                  <a
                    href={job.outputUrl}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold no-underline"
                    style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                  >
                    <Download size={11} /> Download
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

export default function LyricVideoPage() {
  return (
    <Suspense>
      <LyricVideoContent />
    </Suspense>
  );
}
