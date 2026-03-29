"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import {
  FileText, Loader2, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Copy, Check, ExternalLink, Plus, X,
} from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import CreditExhaustedBanner from "@/components/dashboard/CreditExhaustedBanner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

interface Bio   { short: string; medium: string; long: string }
interface Contact { email: string | null; bookingEmail: string | null; phone: string | null }
interface PressQuote { quote: string; source: string }

interface PressKitContent {
  artistName:     string;
  tagline?:       string;
  genre?:         string;
  bio:            Bio;
  achievements:   string[];
  pressQuotes:    PressQuote[];
  technicalRider: string | null;
  contact:        Contact;
  socialLinks:    Record<string, string | null>;
}

interface PollData {
  jobId:        string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  completedAt:  string | null;
  errorMessage: string | null;
  outputData?: {
    content?:  PressKitContent;
    pdfUrl?:   string;
    photoUrl?: string | null;
  } | null;
}

interface HistoryItem {
  id:           string;
  status:       JobStatus;
  priceCharged: number | null;
  createdAt:    string;
  outputData:   { content?: PressKitContent; pdfUrl?: string } | null;
  errorMessage: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const NEXT_CREDITS: Record<string, number> = { launch: 1, push: 3 };

const GENRES = [
  "Hip-Hop / Rap", "R&B / Soul", "Pop", "Alternative / Indie",
  "Electronic / EDM", "Rock", "Country", "Jazz", "Afrobeats", "Latin", "Other",
];
const TONES = ["Professional", "Creative", "Bold & Direct", "Industry-Focused", "Conversational"];

// ─── Press Kit Display ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

function PressKitDisplay({ content, pdfUrl }: { content: PressKitContent; pdfUrl?: string }) {
  const [bioLen, setBioLen] = useState<"short" | "medium" | "long">("medium");

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">{content.artistName}</h3>
          {content.tagline && <p className="text-sm text-muted-foreground mt-0.5">{content.tagline}</p>}
          {content.genre  && <p className="text-xs text-muted-foreground mt-0.5">{content.genre}</p>}
        </div>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <ExternalLink size={12} /> Download PDF
          </a>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {/* Bio */}
        <Section title="Artist Bio">
          <div className="space-y-3">
            <div className="flex gap-1">
              {(["short", "medium", "long"] as const).map(len => (
                <button
                  key={len}
                  onClick={() => setBioLen(len)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition capitalize"
                  style={bioLen === len
                    ? { backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }
                    : { color: "var(--muted-foreground)" }}
                >
                  {len}
                </button>
              ))}
            </div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{content.bio[bioLen]}</p>
              <CopyButton text={content.bio[bioLen]} />
            </div>
          </div>
        </Section>

        {/* Achievements */}
        {content.achievements?.length > 0 && (
          <Section title="Key Achievements">
            <ul className="space-y-1.5">
              {content.achievements.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-[#D4A843] mt-0.5 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Press Quotes */}
        {content.pressQuotes?.length > 0 && (
          <Section title="Press Quotes">
            <div className="space-y-3">
              {content.pressQuotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 pl-3" style={{ borderColor: "#D4A843" }}>
                  <p className="text-sm text-foreground italic">&ldquo;{q.quote}&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">— {q.source}</p>
                </blockquote>
              ))}
            </div>
          </Section>
        )}

        {/* Contact */}
        <Section title="Contact">
          <div className="space-y-1.5">
            {content.contact?.email && (
              <p className="text-sm text-foreground">General: <a href={`mailto:${content.contact.email}`} className="text-[#D4A843] hover:underline">{content.contact.email}</a></p>
            )}
            {content.contact?.bookingEmail && (
              <p className="text-sm text-foreground">Booking: <a href={`mailto:${content.contact.bookingEmail}`} className="text-[#D4A843] hover:underline">{content.contact.bookingEmail}</a></p>
            )}
            {Object.entries(content.socialLinks ?? {}).filter(([, v]) => v).map(([k, v]) => (
              <p key={k} className="text-sm text-foreground capitalize">{k}: <span className="text-muted-foreground">{v}</span></p>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PressKitPage() {
  // Form
  const [artistName,   setArtistName]   = useState("");
  const [bio,          setBio]          = useState("");
  const [genre,        setGenre]        = useState("");
  const [achievements, setAchievements] = useState("");
  const [tone,         setTone]         = useState("Professional");
  const [bookingEmail, setBookingEmail] = useState("");
  const [instagram,    setInstagram]    = useState("");
  const [spotify,      setSpotify]      = useState("");
  const [youtube,      setYoutube]      = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Job state
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData,     setJobData]     = useState<PollData | null>(null);

  // History
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);

  // Credits
  const [creditExhausted, setCreditExhausted] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{ used: number; limit: number; tier: string; priceDisplay: string } | null>(null);

  // ── Load history + credits on mount ────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dashboard/ai/press-kit")
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
            outputData:   data.outputData ? { content: data.outputData.content, pdfUrl: data.outputData.pdfUrl } : null,
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
    if (!artistName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/dashboard/ai/press-kit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          artistName:   artistName.trim(),
          bio,
          genre,
          achievements,
          tone,
          bookingEmail: bookingEmail.trim() || undefined,
          instagram:    instagram.trim()    || undefined,
          spotify:      spotify.trim()      || undefined,
          youtube:      youtube.trim()      || undefined,
          socialLinks:  {
            instagram: instagram.trim() || null,
            spotify:   spotify.trim()   || null,
            youtube:   youtube.trim()   || null,
          },
          contactEmail: bookingEmail.trim() || undefined,
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
        <h1 className="text-2xl font-bold text-foreground">Press Kit Generator</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate a complete Electronic Press Kit (EPK) with bio, press quotes, achievements, and PDF download.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <FileText size={15} style={{ color: "#D4A843" }} />
          <h2 className="text-sm font-semibold text-foreground">New Press Kit</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Artist name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist / Band Name *</label>
            <input
              value={artistName}
              onChange={e => setArtistName(e.target.value)}
              placeholder="e.g. The Midnight, Jxdn"
              required
              disabled={!!isActive}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bio / Background <span className="normal-case font-normal">(optional but recommended)</span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about the artist — their story, sound, influences, career highlights…"
              rows={3}
              disabled={!!isActive}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  <option value="">Select genre</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Tone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Writing Tone</label>
              <div className="relative">
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  disabled={!!isActive}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none appearance-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                >
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Achievements <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={achievements}
              onChange={e => setAchievements(e.target.value)}
              placeholder="e.g. 1M streams on Spotify, opened for [Artist], featured on [Blog], charted #3 on Hype Machine…"
              rows={2}
              disabled={!!isActive}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {showAdvanced ? <X size={12} /> : <Plus size={12} />}
            {showAdvanced ? "Hide" : "Add"} contact & social links
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booking Email</label>
                  <input value={bookingEmail} onChange={e => setBookingEmail(e.target.value)} placeholder="booking@artist.com" disabled={!!isActive}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instagram Handle</label>
                  <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@artistname" disabled={!!isActive}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spotify URL</label>
                  <input value={spotify} onChange={e => setSpotify(e.target.value)} placeholder="open.spotify.com/…" disabled={!!isActive}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">YouTube URL</label>
                  <input value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="youtube.com/@…" disabled={!!isActive}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }} />
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} className="flex-shrink-0" />
              {submitError}
            </div>
          )}

          {creditExhausted && creditInfo && (
            <CreditExhaustedBanner
              toolLabel="press kit"
              creditsLimit={creditInfo.limit}
              ppuPrice={creditInfo.priceDisplay || PRICING_DEFAULTS.AI_PRESS_KIT.display}
              nextTierName={creditInfo.tier === "launch" ? "Push" : "Reign"}
              nextTierCredits={NEXT_CREDITS[creditInfo.tier as "launch" | "push"] ?? 0}
              nextTierPrice={creditInfo.tier === "launch" ? "$49/mo" : "$99/mo"}
              isMaxTier={creditInfo.tier === "reign"}
            />
          )}

          <div className="flex items-center justify-between pt-1">
            {creditInfo && creditInfo.limit > 0 ? (
              <p className="text-xs text-muted-foreground">
                Full EPK + PDF ·{" "}
                <span style={{ color: (creditInfo.limit - creditInfo.used) > 0 ? "#34C759" : "#E85D4A" }}>
                  {Math.max(0, creditInfo.limit - creditInfo.used)} of {creditInfo.limit} included this month
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Full EPK + PDF · Pay per use — {creditInfo?.priceDisplay || PRICING_DEFAULTS.AI_PRESS_KIT.display}</p>
            )}
            <button
              type="submit"
              disabled={submitting || !!isActive || !artistName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Generate Press Kit
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
                  {jobData.status === "QUEUED" ? "Queued — generating press kit…" : "Crafting your press kit…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Claude is writing your bio, achievements, press quotes, and contact block. Takes ~30 seconds.
                </p>
              </div>
            </div>
          )}

          {jobData.status === "COMPLETE" && jobData.outputData?.content && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">Press kit ready</p>
                </div>
                <button onClick={dismissJob} className="text-xs text-muted-foreground hover:text-foreground transition">
                  Dismiss
                </button>
              </div>
              <PressKitDisplay content={jobData.outputData.content} pdfUrl={jobData.outputData.pdfUrl} />
            </div>
          )}

          {jobData.status === "FAILED" && (
            <div className="flex items-start gap-3 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Generation failed</p>
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past Press Kits</p>
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
                      {job.outputData?.content?.artistName ?? "Press Kit"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {job.outputData?.content?.genre && ` · ${job.outputData.content.genre}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.priceCharged != null && job.priceCharged > 0 && (
                      <span className="text-xs text-muted-foreground">${job.priceCharged.toFixed(2)}</span>
                    )}
                    {job.outputData?.pdfUrl && (
                      <a
                        href={job.outputData.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: "#D4A843" }}
                      >
                        <ExternalLink size={11} /> PDF
                      </a>
                    )}
                    {job.status === "COMPLETE" && job.outputData?.content && (
                      expandedId === job.id
                        ? <ChevronUp size={14} className="text-muted-foreground" />
                        : <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedId === job.id && job.outputData?.content && (
                  <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
                    <PressKitDisplay content={job.outputData.content} pdfUrl={job.outputData.pdfUrl} />
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
