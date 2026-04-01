"use client";

import { AIToolsNav }          from "@/components/dashboard/AIToolsNav";
import { useEffect, useState } from "react";
import {
  Users, Loader2, CheckCircle2, Music2, ExternalLink, Zap, Star,
} from "lucide-react";
import { PRICING_DEFAULTS }    from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchCandidate {
  userId:       string;
  name:         string;
  artistName:   string | null;
  artistSlug:   string | null;
  sharedGenres: string[];
  topGenre:     string | null;
  rationale:    string;
}

interface MatchReport {
  generatedAt:  string;
  mode:         "ARTIST_SEEKING_PRODUCER" | "PRODUCER_SEEKING_ARTIST";
  buyerGenres:  string[];
  matches:      MatchCandidate[];
  summary:      string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProducerMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const [report,  setReport]  = useState<MatchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying,  setBuying]  = useState(false);
  const [success, setSuccess] = useState(false);
  const priceDisplay = PRICING_DEFAULTS.PRODUCER_ARTIST_MATCH.display;

  useEffect(() => {
    searchParams.then((sp) => {
      if (sp.success === "1") setSuccess(true);
    });

    fetch("/api/dashboard/ai/producer-match")
      .then((r) => r.json())
      .then((data: { report: MatchReport | null }) => setReport(data.report ?? null))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [searchParams]);

  async function handleBuy() {
    setBuying(true);
    try {
      const res  = await fetch("/api/dashboard/ai/producer-match/checkout", { method: "POST" });
      const data = await res.json() as { url?: string; free?: boolean };
      if (data.free) {
        // Reign plan — generating for free; show pending state
        setSuccess(true);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      /* no-op */
    } finally {
      setBuying(false);
    }
  }

  const modeLabel = report?.mode === "PRODUCER_SEEKING_ARTIST"
    ? "Artists for your beats"
    : "Producers for your sound";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <AIToolsNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#D4A843]/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#D4A843]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Producer-Artist Match</h1>
            <p className="text-sm text-gray-400 mt-0.5">Find your best collaborators on IndieThis</p>
          </div>
        </div>

        {/* Success */}
        {success && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-300 text-sm">Payment successful!</p>
              <p className="text-xs text-gray-400 mt-0.5">Your match report is being generated. Check back in a moment.</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 py-10">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading your matches…</span>
          </div>
        )}

        {/* Report */}
        {!loading && report && (
          <div className="space-y-5">
            {/* Meta */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {modeLabel} · Generated{" "}
                {new Date(report.generatedAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
              {report.buyerGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {report.buyerGenres.slice(0, 4).map((g) => (
                    <span key={g} className="px-2 py-0.5 bg-white/8 rounded-full text-xs text-gray-300 capitalize">{g}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-[#D4A843]/08 border border-[#D4A843]/25 rounded-2xl p-4">
              <p className="text-sm text-gray-200 leading-relaxed">{report.summary}</p>
            </div>

            {/* Matches */}
            {report.matches.length > 0 ? (
              <div className="space-y-3">
                {report.matches.map((m, i) => {
                  const displayName = m.artistName ?? m.name;
                  const profileUrl  = m.artistSlug ? `/${m.artistSlug}` : null;
                  return (
                    <div
                      key={m.userId}
                      className="bg-white/4 border border-white/8 rounded-2xl p-4 flex gap-4"
                    >
                      {/* Rank */}
                      <div className="w-8 h-8 rounded-lg bg-[#D4A843]/15 flex items-center justify-center shrink-0">
                        {i === 0
                          ? <Star className="w-4 h-4 text-[#D4A843]" />
                          : <span className="text-xs font-bold text-[#D4A843]">{i + 1}</span>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">{displayName}</p>
                          {profileUrl && (
                            <a
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-[#D4A843] transition-colors shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{m.rationale}</p>
                        {m.sharedGenres.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {m.sharedGenres.map((g) => (
                              <span key={g} className="px-1.5 py-0.5 bg-[#D4A843]/12 border border-[#D4A843]/20 rounded text-xs text-[#D4A843] capitalize">{g}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                No direct genre matches found yet — try adding genres to your profile to improve matching.
              </p>
            )}

            {/* Refresh */}
            <button
              onClick={handleBuy}
              disabled={buying}
              className="w-full py-3 rounded-xl border border-[#D4A843]/40 text-[#D4A843] text-sm font-semibold hover:bg-[#D4A843]/8 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {buying ? "Redirecting…" : `Refresh report — ${priceDisplay}`}
            </button>
          </div>
        )}

        {/* No report yet */}
        {!loading && !report && !success && (
          <div className="bg-white/4 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D4A843]/15 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-[#D4A843]" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Find your match</h2>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              Get matched with producers or artists on IndieThis based on your genres and catalogue.
              Perfect for finding collab partners, beat sources, or new clients.
            </p>

            <div className="text-left bg-white/4 rounded-xl p-4 mb-6 max-w-sm mx-auto space-y-2">
              {[
                { icon: Music2, text: "Genre-based matching across the full platform" },
                { icon: Star,   text: "Top 5 ranked candidates with match rationale" },
                { icon: Users,  text: "Works both ways — artists AND producers" },
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
              {buying ? "Redirecting…" : `Get My Match Report — ${priceDisplay}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
