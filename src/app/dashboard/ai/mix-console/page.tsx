/**
 * /dashboard/ai/mix-console — Subscriber entry for the AI Mix Console
 *
 * Shows recent mix history and a CTA to start a new mix.
 * Requires authentication.
 */

import type { Metadata } from "next";
import { redirect }      from "next/navigation";
import Link              from "next/link";
import { auth }          from "@/lib/auth";
import { db as prisma }  from "@/lib/db";
import { Sliders, ChevronRight, Download, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Mix Console — IndieThis Dashboard",
  description: "Your AI-powered mixing studio. Start a new mix or download previous mixes.",
};

// ─── Status badge colors ───────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:            { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Queued"      },
  SEPARATING:         { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Separating"  },
  ANALYZING:          { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Analyzing"   },
  AWAITING_DIRECTION: { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Awaiting direction" },
  MIXING:             { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Mixing"      },
  PREVIEWING:         { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Previewing"  },
  REVISING:           { bg: "rgba(212,168,67,0.1)",  text: "#D4A843", label: "Revising"    },
  COMPLETE:           { bg: "rgba(74,222,128,0.1)",  text: "#4ade80", label: "Complete"    },
  FAILED:             { bg: "rgba(248,113,113,0.1)", text: "#f87171", label: "Failed"      },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MixConsoleDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Fetch last 10 mix jobs for this user
  const jobs = await prisma.mixJob.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take:    10,
    select: {
      id:          true,
      mode:        true,
      tier:        true,
      status:      true,
      createdAt:   true,
      amount:      true,
      mixFilePath:       true,
      cleanFilePath:     true,
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.25)" }}
            >
              <Sliders size={18} style={{ color: "#D4A843" }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">AI Mix Console</h1>
          </div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Professional mixing powered by Claude — vocal chain, section-aware processing, lyric-driven delay throws.
          </p>
        </div>
      </div>

      {/* ── Start new mix CTA ── */}
      <Link
        href="/mix-console/wizard"
        className="flex items-center justify-between p-5 rounded-2xl border transition-all no-underline mb-8 group hover:border-[#D4A843]"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="font-semibold text-sm mb-0.5">Start a New Mix</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Vocal + Beat or Tracked Stems · Standard / Premium / Pro
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all group-hover:opacity-90"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          Mix My Track <ChevronRight size={15} />
        </div>
      </Link>

      {/* ── Recent mixes ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-foreground)" }}>
          Recent mixes
        </h2>

        {jobs.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            <Sliders size={28} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
            <p className="text-sm font-semibold mb-1">No mixes yet</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Start your first mix to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const statusStyle = STATUS_STYLE[job.status] ?? STATUS_STYLE.PENDING;
              const isComplete  = job.status === "COMPLETE";
              const hasFile     = isComplete && (job.mixFilePath ?? job.cleanFilePath);

              const createdAt = new Date(job.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              });

              const priceLabel = job.amount
                ? `$${(job.amount / 100).toFixed(2)}`
                : null;

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border p-4 flex items-center gap-4 transition-all"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.15)" }}
                  >
                    <Sliders size={14} style={{ color: "#D4A843" }} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">
                        {job.mode === "VOCAL_BEAT" ? "Vocal + Beat" : "Tracked Stems"}
                      </p>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                      >
                        {statusStyle.label}
                      </span>
                      <span className="text-[10px] capitalize" style={{ color: "var(--muted-foreground)" }}>
                        {job.tier.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        <Clock size={10} />
                        {createdAt}
                      </span>
                      {priceLabel && (
                        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {priceLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isComplete && (
                      <Link
                        href={`/mix-console/wizard?resume=${job.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:border-[#D4A843] no-underline"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      >
                        View
                      </Link>
                    )}
                    {hasFile && (
                      <a
                        href={`/api/mix-console/job/${job.id}/download?version=${job.mixFilePath ? "mix" : "clean"}&format=wav_24_44`}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-90 no-underline"
                        style={{ backgroundColor: "#D4A843", color: "#0A0A0A", fontWeight: 600 }}
                        download
                      >
                        <Download size={11} />
                        WAV
                      </a>
                    )}
                    {!isComplete && job.status !== "FAILED" && (
                      <Link
                        href={`/mix-console/wizard?resume=${job.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:border-[#D4A843] no-underline"
                        style={{ borderColor: "var(--border)", color: "#D4A843" }}
                      >
                        Track →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Info cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        {[
          {
            label: "Standard",
            price: "$59.99",
            bullet: "3 variations · All formats",
          },
          {
            label: "Premium",
            price: "$79.99",
            bullet: "AI mix + 2 revisions · Reference matching",
          },
          {
            label: "Pro",
            price: "$99.99",
            bullet: "Lyric delay throws · 3 revisions",
          },
        ].map((plan) => (
          <div
            key={plan.label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>
              {plan.label}
            </p>
            <p className="text-xl font-black mb-1" style={{ color: "#D4A843" }}>{plan.price}</p>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{plan.bullet}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
