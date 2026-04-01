"use client";

import { AIToolsNav }          from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import { TrendingUp, Loader2, Clock, CheckCircle2, Music2, DollarSign, Zap } from "lucide-react";
import { PRICING_DEFAULTS }    from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendReport {
  generatedAt:       string;
  artistGenre:       string | null;
  topPlatformGenres: Array<{ genre: string; playCount: number }>;
  releaseTimingTip:  string;
  monetisationTip:   string;
  personalInsight:   string;
  callToAction:      string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrendReportPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const [report,   setReport]   = useState<TrendReport | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [buying,   setBuying]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const priceDisplay = PRICING_DEFAULTS.TREND_REPORT.display;

  useEffect(() => {
    // Check for ?success=1 from Stripe redirect
    searchParams.then((sp) => {
      if (sp.success === "1") setSuccess(true);
    });

    fetch("/api/dashboard/ai/trend-report")
      .then((r) => r.json())
      .then((data: { report: TrendReport | null }) => setReport(data.report ?? null))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [searchParams]);

  async function handleBuy() {
    setBuying(true);
    try {
      const res  = await fetch("/api/dashboard/ai/trend-report/checkout", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      /* no-op */
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <AIToolsNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#D4A843]/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#D4A843]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Trend Report</h1>
            <p className="text-sm text-gray-400 mt-0.5">Personalised platform trends + release insights</p>
          </div>
        </div>

        {/* Success banner */}
        {success && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300 text-sm">Payment successful!</p>
              <p className="text-xs text-gray-400 mt-0.5">Your personalised trend report is being generated. Check back in a moment.</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 py-10">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading your report…</span>
          </div>
        )}

        {/* Report */}
        {!loading && report && (
          <div className="space-y-5">
            {/* Generated at */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Generated{" "}
                {new Date(report.generatedAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
                {report.artistGenre && ` · Your genre: ${report.artistGenre}`}
              </span>
            </div>

            {/* Personal insight */}
            <div className="bg-[#D4A843]/08 border border-[#D4A843]/25 rounded-2xl p-5">
              <p className="text-xs font-semibold text-[#D4A843] uppercase tracking-widest mb-2">📊 Your Platform Position</p>
              <p className="text-sm leading-relaxed text-gray-200">{report.personalInsight}</p>
            </div>

            {/* Top platform genres */}
            {report.topPlatformGenres.length > 0 && (
              <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-3">🔥 Top Genres on IndieThis Right Now</p>
                <div className="space-y-2">
                  {report.topPlatformGenres.map((g, i) => {
                    const max = report.topPlatformGenres[0]?.playCount ?? 1;
                    const pct = Math.round((g.playCount / max) * 100);
                    return (
                      <div key={g.genre} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{g.genre}</span>
                            <span className="text-xs text-gray-400">{g.playCount.toLocaleString()} plays</span>
                          </div>
                          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#D4A843] rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Release Timing</p>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{report.releaseTimingTip}</p>
              </div>
              <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Monetisation</p>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{report.monetisationTip}</p>
              </div>
            </div>

            {/* Call to action text */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#D4A843]" />
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Next Step</p>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{report.callToAction}</p>
            </div>

            {/* Refresh CTA */}
            <button
              onClick={handleBuy}
              disabled={buying}
              className="w-full py-3 rounded-xl border border-[#D4A843]/40 text-[#D4A843] text-sm font-semibold hover:bg-[#D4A843]/8 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {buying ? "Redirecting…" : `Generate fresh report — ${priceDisplay}`}
            </button>
          </div>
        )}

        {/* No report yet */}
        {!loading && !report && !success && (
          <div className="bg-white/4 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D4A843]/15 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-[#D4A843]" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No report yet</h2>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              Get a personalised breakdown of platform trends, optimal release timing for your genre,
              and monetisation tips — tailored to your catalogue.
            </p>

            {/* What's included */}
            <div className="text-left bg-white/4 rounded-xl p-4 mb-6 max-w-sm mx-auto space-y-2">
              {[
                { icon: Music2,      text: "Top genres trending on IndieThis right now" },
                { icon: Clock,       text: "Best release day & time for your genre" },
                { icon: DollarSign,  text: "Personalised monetisation tip" },
                { icon: TrendingUp,  text: "Your catalogue vs. platform benchmark" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-[#D4A843] shrink-0" />
                  <span className="text-sm text-gray-300">{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleBuy}
              disabled={buying}
              className="bg-[#D4A843] text-[#0A0A0A] font-bold py-3 px-8 rounded-xl text-sm hover:bg-[#C49833] transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {buying ? "Redirecting…" : `Get My Trend Report — ${priceDisplay}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
