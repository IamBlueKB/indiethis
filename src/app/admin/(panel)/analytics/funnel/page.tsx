import { db } from "@/lib/db";
import Link from "next/link";
import { subDays } from "date-fns";
import { Users, TrendingDown, ArrowDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d" | "all";

interface Props {
  searchParams: Promise<{ range?: string; step?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rangeStart(range: Range): Date | undefined {
  if (range === "all") return undefined;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return subDays(new Date(), days);
}

function dropPct(from: number, to: number) {
  if (from === 0) return "—";
  return `${Math.round((to / from) * 100)}%`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FunnelPage({ searchParams }: Props) {
  const { range: rawRange, step: focusStep } = await searchParams;
  const range: Range = ["7d", "30d", "90d", "all"].includes(rawRange ?? "")
    ? (rawRange as Range)
    : "30d";

  const since = rangeStart(range);
  const createdFilter = since ? { gte: since } : undefined;

  // ── Funnel counts (users who signed up within range) ──────────────────────
  const [
    visited,
    created,
    planned,
    setup,
    content,
    published,
    active30,
  ] = await Promise.all([
    // Visited site (firstVisitAt set — only tracked for new signups)
    db.user.count({ where: { createdAt: createdFilter, firstVisitAt: { not: null } } }),
    // Created account
    db.user.count({ where: { createdAt: createdFilter } }),
    // Selected plan
    db.user.count({ where: { createdAt: createdFilter, planSelectedAt: { not: null } } }),
    // Completed setup
    db.user.count({ where: { createdAt: createdFilter, setupCompletedAt: { not: null } } }),
    // Uploaded first content
    db.user.count({ where: { createdAt: createdFilter, firstContentAt: { not: null } } }),
    // Published artist page
    db.user.count({ where: { createdAt: createdFilter, pagePublishedAt: { not: null } } }),
    // Still active after 30 days (logged in at least once 30+ days after signup)
    db.user.count({
      where: {
        createdAt: createdFilter,
        lastLoginAt: { not: null },
        AND: [
          { lastLoginAt: { gte: subDays(new Date(), 30) } },
        ],
      },
    }),
  ]);

  // ── Acquisition source breakdown ──────────────────────────────────────────
  const [referral, promo, ambassador, organic] = await Promise.all([
    db.user.count({ where: { createdAt: createdFilter, referredByCode: { not: null } } }),
    db.user.count({ where: { createdAt: createdFilter, attribution: { ref: { not: null } } } }),
    db.user.count({ where: { createdAt: createdFilter, attribution: { affiliateId: { not: null } } } }),
    db.user.count({
      where: {
        createdAt: createdFilter,
        referredByCode: null,
        AND: [
          { OR: [{ attribution: null }, { attribution: { affiliateId: null, ref: null } }] },
        ],
      },
    }),
  ]);

  // ── Users stuck at a step (for drill-down) ────────────────────────────────
  type StuckUser = { id: string; name: string | null; email: string; createdAt: Date };
  let stuckUsers: StuckUser[] = [];
  let stuckLabel = "";

  if (focusStep) {
    const baseWhere = { createdAt: createdFilter };
    const stepWhere: Record<string, unknown> = { ...baseWhere };

    if (focusStep === "visited") {
      stuckLabel = "Created account but no visit tracked";
      stepWhere.firstVisitAt = null;
    } else if (focusStep === "created") {
      stuckLabel = "Created account but never selected a plan";
      stepWhere.planSelectedAt = null;
    } else if (focusStep === "planned") {
      stuckLabel = "Selected a plan but never completed setup";
      stepWhere.planSelectedAt = { not: null };
      stepWhere.setupCompletedAt = null;
    } else if (focusStep === "setup") {
      stuckLabel = "Completed setup but never uploaded content";
      stepWhere.setupCompletedAt = { not: null };
      stepWhere.firstContentAt = null;
    } else if (focusStep === "content") {
      stuckLabel = "Uploaded content but never published their page";
      stepWhere.firstContentAt = { not: null };
      stepWhere.pagePublishedAt = null;
    } else if (focusStep === "published") {
      stuckLabel = "Published page but not active after 30 days";
      stepWhere.pagePublishedAt = { not: null };
      stepWhere.lastLoginAt = null;
    }

    stuckUsers = await db.user.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: stepWhere as any,
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  // ── Funnel steps definition ────────────────────────────────────────────────
  const steps = [
    { key: "visited",   label: "Visited site",              count: visited,   note: "tracked from new signups only" },
    { key: "created",   label: "Created account",           count: created,   note: "" },
    { key: "planned",   label: "Selected plan",             count: planned,   note: "" },
    { key: "setup",     label: "Completed setup",           count: setup,     note: "" },
    { key: "content",   label: "Uploaded first content",    count: content,   note: "" },
    { key: "published", label: "Published artist page",     count: published, note: "" },
    { key: "active",    label: "Still active after 30 days",count: active30,  note: "" },
  ];

  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Signup Funnel</h1>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>
            Drop-off at each step of the user journey
          </p>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1.5 rounded-lg p-1" style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          {(["7d", "30d", "90d", "all"] as Range[]).map((r) => (
            <Link
              key={r}
              href={`/admin/analytics/funnel?range=${r}`}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
              style={range === r
                ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                : { color: "#888" }}
            >
              {r === "all" ? "All time" : r}
            </Link>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}>
        {steps.map((step, i) => {
          const prev      = i > 0 ? steps[i - 1].count : step.count;
          const pct       = dropPct(prev, step.count);
          const barWidth  = Math.round((step.count / maxCount) * 100);
          const isActive  = focusStep === step.key;

          return (
            <div key={step.key}>
              {/* Drop-off arrow between steps */}
              {i > 0 && (
                <div className="flex items-center gap-3 px-6 py-1.5" style={{ backgroundColor: "#0d0d0d" }}>
                  <ArrowDown size={13} style={{ color: "#444" }} />
                  <span className="text-xs font-semibold" style={{ color: step.count < prev ? "#E85D4A" : "#34C759" }}>
                    {pct} conversion · {prev - step.count} dropped off
                  </span>
                </div>
              )}

              {/* Step row */}
              <Link
                href={`/admin/analytics/funnel?range=${range}&step=${focusStep === step.key ? "" : step.key}`}
                className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5 block"
                style={isActive ? { backgroundColor: "rgba(212,168,67,0.08)" } : {}}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ backgroundColor: "#1a1a1a", color: "#D4A843", border: "1px solid #2a2a2a" }}>
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-semibold text-white">{step.label}</span>
                      {step.note && (
                        <span className="ml-2 text-[10px]" style={{ color: "#555" }}>{step.note}</span>
                      )}
                    </div>
                    <span className="text-sm font-bold tabular-nums" style={{ color: "#D4A843" }}>
                      {step.count.toLocaleString()}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: "#1a1a1a" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: barWidth > 60 ? "#34C759" : barWidth > 30 ? "#D4A843" : "#E85D4A",
                      }}
                    />
                  </div>
                </div>

                <TrendingDown size={14} className="shrink-0" style={{ color: "#444" }} />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Acquisition sources */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}>
        <h2 className="text-sm font-bold text-white">Acquisition Source</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Organic",     count: organic,    color: "#34C759" },
            { label: "Referral",    count: referral,   color: "#D4A843" },
            { label: "Promo Code",  count: promo,      color: "#60a5fa" },
            { label: "Ambassador",  count: ambassador, color: "#a78bfa" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-lg p-4 space-y-1" style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}>
              <p className="text-xs font-medium" style={{ color: "#888" }}>{label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{count.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: "#555" }}>
                {dropPct(created, count)} of signups
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Drill-down: users stuck at a step */}
      {focusStep && stuckUsers.length > 0 && (
        <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">{stuckLabel}</h2>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                {stuckUsers.length} users — click a user to view their profile
              </p>
            </div>
            <Users size={16} style={{ color: "#D4A843" }} />
          </div>

          <div className="divide-y" style={{ borderColor: "#2a2a2a" }}>
            {stuckUsers.map((u) => (
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="flex items-center justify-between py-2.5 hover:bg-white/5 transition-colors px-2 rounded"
              >
                <div>
                  <p className="text-sm font-medium text-white">{u.name ?? "—"}</p>
                  <p className="text-xs" style={{ color: "#666" }}>{u.email}</p>
                </div>
                <p className="text-xs" style={{ color: "#555" }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {focusStep && stuckUsers.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: "#111", borderColor: "#2a2a2a" }}>
          <p className="text-sm" style={{ color: "#888" }}>No users stuck at this step in the selected range.</p>
        </div>
      )}
    </div>
  );
}
