"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText, Loader2, CheckCircle2, Clock, AlertCircle,
  Plus, X, ChevronDown, ChevronUp, CreditCard, Copy, Check,
} from "lucide-react";

type PressKitJob = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputData: { artistName?: string; genre?: string; tone?: string } | null;
  outputData: { pressKit?: string; artistName?: string; genre?: string; error?: string } | null;
  createdAt: string;
};

type Subscription = {
  tier: string;
  pressKitCreditsUsed: number;
  pressKitCreditsLimit: number;
};

const STATUS_CONFIG = {
  QUEUED:     { color: "text-yellow-400", icon: Clock,        label: "Queued" },
  PROCESSING: { color: "text-blue-400",   icon: Loader2,      label: "Generating…" },
  COMPLETED:  { color: "text-emerald-400",icon: CheckCircle2, label: "Completed" },
  FAILED:     { color: "text-red-400",    icon: AlertCircle,  label: "Failed" },
};

const GENRES = ["Hip-Hop / Rap","R&B / Soul","Pop","Alternative / Indie","Electronic / EDM","Rock","Country","Jazz","Gospel / Christian","Latin","Afrobeats","Other"];
const TONES = ["Professional", "Creative", "Bold & Direct", "Industry-Focused"];

function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ") || line.startsWith("# ")) {
          return <h3 key={i} className="text-sm font-bold text-foreground mt-4 mb-1 first:mt-0">{line.replace(/^#+\s/, "")}</h3>;
        }
        if (line.match(/^\*\*[^*]+\*\*/)) {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i} className="text-sm text-foreground mb-1">
              {parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 mb-1">
              <span className="shrink-0 mt-0.5" style={{ color: "#D4A843" }}>·</span>
              <p className="text-sm text-foreground">{line.slice(2)}</p>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-foreground mb-1 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

function PressKitCard({ job }: { job: PressKitJob }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg  = STATUS_CONFIG[job.status];
  const Icon = cfg.icon;
  const name = job.outputData?.artistName ?? job.inputData?.artistName ?? "Press Kit";
  const genre = job.outputData?.genre ?? job.inputData?.genre ?? "";
  const pressKit = job.outputData?.pressKit ?? "";

  async function copyToClipboard() {
    await navigator.clipboard.writeText(pressKit);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer"
        onClick={() => job.status === "COMPLETED" && setExpanded(v => !v)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)" }}>
          <Icon size={16} className={job.status === "PROCESSING" ? `${cfg.color} animate-spin` : cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">
            {genre || "—"} · {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
          {job.status === "COMPLETED" && (
            expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && pressKit && (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Electronic Press Kit</p>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
          <div className="px-5 py-4">
            <MarkdownBlock text={pressKit} />
          </div>
        </div>
      )}
    </div>
  );
}

function PressKitContent() {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("paid") === "1";

  const [jobs, setJobs] = useState<PressKitJob[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(justPaid);
  const [buyLoading, setBuyLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [achievements, setAchievements] = useState("");
  const [trackList, setTrackList] = useState([{ title: "", url: "" }, { title: "", url: "" }, { title: "", url: "" }]);
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [spotify, setSpotify] = useState("");
  const [appleMusic, setAppleMusic] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [tone, setTone] = useState("Professional");

  useEffect(() => {
    fetch("/api/dashboard/press-kit")
      .then(r => r.json())
      .then(d => { setJobs(d.jobs ?? []); setSubscription(d.subscription ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const creditsUsed  = subscription?.pressKitCreditsUsed  ?? 0;
  const creditsLimit = subscription?.pressKitCreditsLimit ?? 0;
  const creditsLeft  = creditsLimit - creditsUsed;
  const hasCredits   = creditsLeft > 0;

  function updateTrack(i: number, field: "title" | "url", value: string) {
    setTrackList(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  async function handleBuy() {
    setBuyLoading(true);
    try {
      const res = await fetch("/api/stripe/pay-per-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "PRESS_KIT" }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Could not start checkout.");
    } finally {
      setBuyLoading(false);
    }
  }

  async function handleGenerate() {
    if (!artistName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/press-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: artistName.trim(), genre, location: location.trim(),
          bio: bio.trim(), achievements: achievements.trim(),
          trackList: trackList.filter(t => t.title.trim()),
          instagram: instagram.trim(), tiktok: tiktok.trim(),
          youtube: youtube.trim(), spotify: spotify.trim(),
          appleMusic: appleMusic.trim(), bookingEmail: bookingEmail.trim(), tone,
        }),
      });
      const data = await res.json() as { job?: PressKitJob; error?: string };
      if (res.ok && data.job) {
        setJobs(prev => [data.job!, ...prev]);
        setArtistName(""); setGenre(""); setLocation(""); setBio(""); setAchievements("");
        setTrackList([{title:"",url:""},{title:"",url:""},{title:"",url:""}]);
        setInstagram(""); setTiktok(""); setYoutube(""); setSpotify(""); setAppleMusic(""); setBookingEmail("");
        setComposing(false);
        // Refresh credits
        const sub = await fetch("/api/dashboard/press-kit").then(r => r.json());
        setSubscription(sub.subscription ?? null);
      } else {
        alert(data.error ?? "Generation failed.");
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
          <h1 className="text-2xl font-bold text-foreground">Press Kit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-generated electronic press kit, ready to send to labels and venues</p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={14} /> New Press Kit
        </button>
      </div>

      {/* Payment success banner */}
      {justPaid && (
        <div className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ backgroundColor: "#D4A84314", borderColor: "#D4A84360" }}>
          <CheckCircle2 size={16} style={{ color: "#D4A843" }} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Payment successful!</p>
            <p className="text-xs text-muted-foreground">1 press kit credit added. Fill in your details below and generate.</p>
          </div>
        </div>
      )}

      {/* Pricing card */}
      {!loading && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--border)" }}>
            {/* Credits */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Credits</p>
              {creditsLimit > 0 ? (
                <>
                  <p className="text-sm text-foreground">
                    <span className="text-2xl font-bold">{creditsLeft}</span>
                    <span className="text-muted-foreground"> remaining</span>
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(100,(creditsUsed/creditsLimit)*100)}%`, backgroundColor: creditsLeft <= 0 ? "#f87171" : "#D4A843" }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{creditsUsed} of {creditsLimit} used</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No credits yet. Purchase below to get started.</p>
              )}
            </div>

            {/* Pay per use */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pay Per Use</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">$19.99</p>
                <p className="text-xs text-muted-foreground mt-0.5">one press kit · full EPK copy</p>
              </div>
              <button
                onClick={handleBuy}
                disabled={buyLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "var(--border)", color: "var(--foreground)" }}
              >
                {buyLoading ? <><Loader2 size={12} className="animate-spin" /> Redirecting…</> : <><CreditCard size={12} /> Buy for $19.99</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose form */}
      {composing && (
        <div className="rounded-2xl border p-5 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold text-foreground">Generate Press Kit</h2>
            </div>
            <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist Name <span style={{ color: "#E85D4A" }}>*</span></label>
              <input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Your stage name"
                className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Genre</label>
              <select value={genre} onChange={e => setGenre(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                <option value="">Select genre…</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State / Country"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Your story, sound, and background…"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)" }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notable Achievements</label>
            <input value={achievements} onChange={e => setAchievements(e.target.value)}
              placeholder="Streams, placements, shows, features, press coverage…"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }} />
          </div>

          {/* Tracks */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Featured Tracks (up to 3)</label>
            {trackList.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input value={t.title} onChange={e => updateTrack(i, "title", e.target.value)} placeholder={`Track ${i + 1} title`}
                  className="rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }} />
                <input value={t.url} onChange={e => updateTrack(i, "url", e.target.value)} placeholder="Spotify / YouTube / SoundCloud URL"
                  className="rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                  style={{ borderColor: "var(--border)" }} />
              </div>
            ))}
          </div>

          {/* Social links */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social & Streaming Links</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Instagram", val: instagram, set: setInstagram, ph: "@yourhandle" },
                { label: "TikTok",    val: tiktok,    set: setTiktok,    ph: "@yourhandle" },
                { label: "YouTube",   val: youtube,   set: setYoutube,   ph: "Channel URL" },
                { label: "Spotify",   val: spotify,   set: setSpotify,   ph: "Artist URL" },
                { label: "Apple Music", val: appleMusic, set: setAppleMusic, ph: "Artist URL" },
                { label: "Booking Email", val: bookingEmail, set: setBookingEmail, ph: "booking@email.com" },
              ].map(({ label, val, set, ph }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ backgroundColor: tone === t ? "#D4A843" : "var(--border)", color: tone === t ? "#0A0A0A" : "var(--muted-foreground)" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          {hasCredits ? (
            <button onClick={handleGenerate} disabled={submitting || !artistName.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><FileText size={14} /> Generate Press Kit</>}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={handleBuy} disabled={buyLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                {buyLoading ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</> : <><CreditCard size={14} /> Buy for $19.99 &amp; Generate</>}
              </button>
              <p className="text-xs text-muted-foreground">Your inputs will be saved when you return</p>
            </div>
          )}
        </div>
      )}

      {/* Jobs list */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border py-14 text-center space-y-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <FileText size={32} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">No press kits generated yet</p>
          <p className="text-xs text-muted-foreground">Generate your first EPK to send to labels, venues, and playlists.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => <PressKitCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}

export default function PressKitPage() {
  return (
    <Suspense>
      <PressKitContent />
    </Suspense>
  );
}
