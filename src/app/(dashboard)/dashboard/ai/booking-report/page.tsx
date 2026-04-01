"use client";

import { useEffect, useState }      from "react";
import { AIToolsNav }               from "@/components/dashboard/AIToolsNav";
import { PRICING_DEFAULTS }         from "@/lib/pricing";
import {
  MapPin, Mic2, Radio, BookOpen, Podcast,
  CalendarDays, ExternalLink, Loader2, Music2, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingOpportunity {
  name:     string;
  type:     string;
  location: string;
  deadline: string | null;
  link:     string | null;
  fit:      string;
}

interface BookingReport {
  generatedAt:   string;
  mode:          "ARTIST" | "DJ";
  genre:         string | null;
  city:          string | null;
  opportunities: BookingOpportunity[];
  summary:       string;
}

// ─── Opportunity type icon ────────────────────────────────────────────────────

function OppIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("radio"))    return <Radio   size={14} />;
  if (t.includes("podcast"))  return <Podcast size={14} />;
  if (t.includes("blog"))     return <BookOpen size={14} />;
  if (t.includes("festival")) return <Music2  size={14} />;
  return <Mic2 size={14} />;
}

const TYPE_COLORS: Record<string, string> = {
  "open mic":   "bg-emerald-500/15 text-emerald-400",
  "festival":   "bg-yellow-500/15 text-yellow-400",
  "competition":"bg-red-500/15 text-red-400",
  "showcase":   "bg-purple-500/15 text-purple-400",
  "radio":      "bg-blue-500/15 text-blue-400",
  "blog":       "bg-pink-500/15 text-pink-400",
  "podcast":    "bg-orange-500/15 text-orange-400",
  "club night": "bg-indigo-500/15 text-indigo-400",
  "mix show":   "bg-cyan-500/15 text-cyan-400",
};

function typeClass(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? "bg-[#D4A843]/15 text-[#D4A843]";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const [report,  setReport]  = useState<BookingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying,  setBuying]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const priceDisplay = PRICING_DEFAULTS.BOOKING_REPORT.display;

  useEffect(() => {
    searchParams.then((sp) => {
      if (sp.success === "1") {
        setSuccess(true);
        setPending(true);
      }
    });

    fetch("/api/dashboard/ai/booking-report?mode=ARTIST")
      .then((r) => r.json())
      .then((d) => setReport(d.report ?? null))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [searchParams]);

  async function handleBuy() {
    setBuying(true);
    try {
      const res  = await fetch("/api/dashboard/ai/booking-report/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "ARTIST" }),
      });
      const data = await res.json();
      if (data.free) {
        setPending(true);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      /* ignore */
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <AIToolsNav />

      <div>
        <h1 className="text-2xl font-bold text-white">Booking Opportunities</h1>
        <p className="text-sm text-neutral-400 mt-1">
          10 curated performance and exposure opportunities tailored to your sound and location.
        </p>
      </div>

      {/* Success / pending notice */}
      {(success || pending) && !report && (
        <div className="rounded-xl border border-[#D4A843]/30 bg-[#D4A843]/10 p-4 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-[#D4A843]" />
          <p className="text-sm text-[#D4A843]">
            We&apos;re finding opportunities for you — check back in a moment.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-neutral-500" />
        </div>
      )}

      {!loading && !report && !pending && (
        /* Empty state — purchase CTA */
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-[#D4A843]/15 flex items-center justify-center">
            <Mic2 size={26} className="text-[#D4A843]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Find Your Next Break</h2>
            <p className="text-sm text-neutral-400 max-w-md">
              Get 10 curated opportunities: open mics, festivals accepting applications,
              radio stations, music blogs, and podcasts — all matched to your genre and city.
            </p>
          </div>
          <ul className="text-sm text-neutral-400 space-y-1 text-left w-full max-w-xs">
            {[
              "Open mics & local showcases",
              "Festivals with open applications",
              "Radio stations & podcasts",
              "Music blogs accepting features",
              "Battle of the bands & competitions",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Zap size={13} className="text-[#D4A843] shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={handleBuy}
            disabled={buying}
            className="mt-2 px-6 py-2.5 rounded-lg bg-[#D4A843] text-[#0A0A0A] font-semibold text-sm hover:bg-[#c49b3b] transition disabled:opacity-60 flex items-center gap-2"
          >
            {buying ? <Loader2 size={16} className="animate-spin" /> : null}
            Find My Opportunities — {priceDisplay}
          </button>
          <p className="text-xs text-neutral-500">Reign plan members get this free.</p>
        </div>
      )}

      {!loading && report && (
        <div className="flex flex-col gap-4">
          {/* Report header */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap gap-4 items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Report generated</p>
              <p className="text-sm text-white font-medium">
                {new Date(report.generatedAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
            {report.genre && (
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Genre</p>
                <p className="text-sm text-white capitalize font-medium">{report.genre}</p>
              </div>
            )}
            {report.city && (
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-neutral-500" />
                <p className="text-sm text-white font-medium">{report.city}</p>
              </div>
            )}
            <button
              onClick={handleBuy}
              disabled={buying}
              className="ml-auto px-4 py-2 rounded-lg border border-[#D4A843]/40 text-[#D4A843] text-sm font-medium hover:bg-[#D4A843]/10 transition disabled:opacity-60 flex items-center gap-2"
            >
              {buying ? <Loader2 size={14} className="animate-spin" /> : null}
              Refresh Report
            </button>
          </div>

          {/* Summary */}
          <p className="text-sm text-neutral-300 px-1">{report.summary}</p>

          {/* Opportunity cards */}
          <div className="grid gap-3">
            {report.opportunities.map((opp, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2 hover:border-white/20 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-neutral-500 text-xs font-mono w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-white font-semibold text-sm truncate">{opp.name}</p>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${typeClass(opp.type)}`}>
                    <OppIcon type={opp.type} />
                    {opp.type}
                  </span>
                </div>

                <p className="text-sm text-neutral-300 pl-7">{opp.fit}</p>

                <div className="flex flex-wrap gap-3 pl-7 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {opp.location}
                  </span>
                  {opp.deadline && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <CalendarDays size={11} />
                      Deadline: {new Date(opp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {opp.link && (
                    <a
                      href={opp.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#D4A843] hover:underline"
                    >
                      <ExternalLink size={11} />
                      Apply / Contact
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
