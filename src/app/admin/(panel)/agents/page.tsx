import { db }                 from "@/lib/db";
import { requireAdminAccess } from "@/lib/require-admin-access";
import Link                   from "next/link";
import {
  Bot, Filter, AlertTriangle, ShieldAlert, TrendingUp,
  Activity, Clock, Users, Mic2, Users2, FileSearch,
  MessageSquare, DollarSign, Music2,
} from "lucide-react";
import type { AgentType }     from "@prisma/client";

const AGENT_LABELS: Record<string, string> = {
  CHURN_PREVENTION:         "Churn Prevention",
  REVENUE_OPTIMIZATION:     "Revenue Optimization",
  RELEASE_STRATEGY:         "Release Strategy",
  FAN_ENGAGEMENT:           "Fan Engagement",
  SESSION_FOLLOWUP:         "Session Follow-up",
  AR_INTELLIGENCE:          "A&R Intelligence",
  CONTENT_MODERATION:       "Content Moderation",
  LEAD_SCORING:             "Lead Scoring",
  CREATIVE_PROMPT:          "Creative Prompt",
  INACTIVE_CONTENT:         "Inactive Content",
  PAYMENT_RECOVERY:         "Payment Recovery",
  TREND_FORECASTER:         "Trend Forecaster",
  PRODUCER_ARTIST_MATCH:    "Producer-Artist Match",
  BOOKING_AGENT:            "Booking Agent",
  COLLABORATION_MATCHMAKER: "Collaboration Matchmaker",
};

const AGENT_COLORS: Record<string, string> = {
  CHURN_PREVENTION:         "#F87171",
  REVENUE_OPTIMIZATION:     "#4ADE80",
  RELEASE_STRATEGY:         "#60A5FA",
  FAN_ENGAGEMENT:           "#A78BFA",
  SESSION_FOLLOWUP:         "#34D399",
  AR_INTELLIGENCE:          "#FBBF24",
  CONTENT_MODERATION:       "#FB923C",
  LEAD_SCORING:             "#38BDF8",
  CREATIVE_PROMPT:          "#D4A843",
  INACTIVE_CONTENT:         "#E879F9",
  PAYMENT_RECOVERY:         "#F87171",
  TREND_FORECASTER:         "#34D399",
  PRODUCER_ARTIST_MATCH:    "#60A5FA",
  BOOKING_AGENT:            "#FB923C",
  COLLABORATION_MATCHMAKER: "#A78BFA",
};

const ALL_AGENT_TYPES = Object.keys(AGENT_LABELS) as AgentType[];

function fmtDate(d: Date) {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeSince(d: Date): string {
  const ms  = Date.now() - d.getTime();
  const hrs = ms / 3600_000;
  if (hrs < 1)  return `${Math.round(ms / 60_000)}m ago`;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function pct(num: number, denom: number): string {
  if (!denom) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; page?: string }>;
}) {
  await requireAdminAccess("agents");

  const { agent: agentFilter, page: pageStr } = await searchParams;
  const page    = Math.max(1, parseInt(pageStr ?? "1", 10));
  const perPage = 50;
  const skip    = (page - 1) * perPage;

  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now.getTime() - 7  * 86_400_000);
  const monthStart = new Date(now.getTime() - 30 * 86_400_000);

  const where = agentFilter ? { agentType: agentFilter as AgentType } : {};

  const [
    logs,
    total,
    todayCount,
    weekCount,
    monthCount,
    weekSummary,
    lastRuns,
    churnCounts,
    pendingFlags,
    // ── Payment Recovery stats ──────────────────────────────────────────────
    payRecoveryStarted,
    payWinBackSent,
    payDay2Sent,
    payDay5Sent,
    // ── Trend Forecaster stats ──────────────────────────────────────────────
    trendReportsWeek,
    trendTeasersWeek,
    // ── Booking Agent stats ─────────────────────────────────────────────────
    bookingReportsTotal,
    bookingReportsWeek,
    // ── Collaboration Matchmaker stats ──────────────────────────────────────
    collabMatchesMonth,
    collabOptInCount,
    // ── Inactive Content stats ──────────────────────────────────────────────
    inactiveDigestWeek,
    inactiveBundleSuggestWeek,
  ] = await Promise.all([
    // Paginated activity feed
    db.agentLog.findMany({ where, orderBy: { createdAt: "desc" }, take: perPage, skip }),
    db.agentLog.count({ where }),

    // Overview counts
    db.agentLog.count({ where: { createdAt: { gte: todayStart } } }),
    db.agentLog.count({ where: { createdAt: { gte: weekStart  } } }),
    db.agentLog.count({ where: { createdAt: { gte: monthStart } } }),

    // Per-agent summary (7 days)
    db.agentLog.groupBy({
      by:      ["agentType"],
      _count:  { _all: true },
      where:   { createdAt: { gte: weekStart } },
      orderBy: { _count: { agentType: "desc" } },
    }),

    // Last run time per agent
    db.agentLog.findMany({
      where:    { action: "AGENT_RUN_START" },
      orderBy:  { createdAt: "desc" },
      distinct: ["agentType"],
      select:   { agentType: true, createdAt: true },
    }),

    // Churn risk distribution
    db.user.groupBy({ by: ["churnRiskScore"], _count: { _all: true } }).then((rows) => {
      let healthy = 0, atRisk = 0, high = 0, critical = 0;
      for (const r of rows) {
        const s = r.churnRiskScore ?? 0;
        if (s <= 30)       healthy  += r._count._all;
        else if (s <= 60)  atRisk   += r._count._all;
        else if (s <= 80)  high     += r._count._all;
        else               critical += r._count._all;
      }
      return { healthy, atRisk, high, critical };
    }),

    // Pending moderation flags
    db.moderationFlag.count({ where: { status: "PENDING" } }),

    // ── Payment Recovery ────────────────────────────────────────────────────
    db.agentLog.count({
      where: { agentType: "PAYMENT_RECOVERY" as AgentType, action: "RECOVERY_STARTED", createdAt: { gte: monthStart } },
    }),
    db.agentLog.count({
      where: { agentType: "PAYMENT_RECOVERY" as AgentType, action: "WIN_BACK_SENT", createdAt: { gte: monthStart } },
    }),
    db.agentLog.count({
      where: { agentType: "PAYMENT_RECOVERY" as AgentType, action: "DAY2_EMAIL_SENT", createdAt: { gte: monthStart } },
    }),
    db.agentLog.count({
      where: { agentType: "PAYMENT_RECOVERY" as AgentType, action: "DAY5_EMAIL_SENT", createdAt: { gte: monthStart } },
    }),

    // ── Trend Forecaster ────────────────────────────────────────────────────
    db.agentLog.count({
      where: { agentType: "TREND_FORECASTER" as AgentType, action: "TREND_REPORT_GENERATED", createdAt: { gte: weekStart } },
    }),
    db.agentLog.count({
      where: { agentType: "TREND_FORECASTER" as AgentType, action: "TEASER_SENT", createdAt: { gte: weekStart } },
    }),

    // ── Booking Agent ───────────────────────────────────────────────────────
    db.agentLog.count({
      where: { agentType: "BOOKING_AGENT" as AgentType, action: "REPORT_GENERATED" },
    }),
    db.agentLog.count({
      where: { agentType: "BOOKING_AGENT" as AgentType, action: "REPORT_GENERATED", createdAt: { gte: weekStart } },
    }),

    // ── Collaboration Matchmaker ────────────────────────────────────────────
    db.agentLog.count({
      where: { agentType: "COLLABORATION_MATCHMAKER" as AgentType, action: "MATCH_SENT", createdAt: { gte: monthStart } },
    }),
    db.user.count({ where: { openToCollaborations: true, role: "ARTIST" } }),

    // ── Inactive Content ────────────────────────────────────────────────────
    db.agentLog.count({
      where: { agentType: "INACTIVE_CONTENT" as AgentType, action: "DIGEST_SENT", createdAt: { gte: weekStart } },
    }),
    // Bundle suggestions = DIGEST_SENT logs this week (suggestions stored in details)
    db.agentLog.findMany({
      where: { agentType: "INACTIVE_CONTENT" as AgentType, action: "DIGEST_SENT", createdAt: { gte: weekStart } },
      select: { details: true },
    }).then((rows) =>
      rows.reduce((sum, r) => {
        const d = r.details as Record<string, unknown> | null;
        const suggestions = d?.suggestions;
        return sum + (Array.isArray(suggestions) ? suggestions.length : 0);
      }, 0)
    ),
  ]);

  const totalPages   = Math.ceil(total / perPage);
  const lastRunMap   = new Map(lastRuns.map((r) => [r.agentType, r.createdAt]));
  const weekCountMap = new Map(weekSummary.map((s) => [s.agentType, s._count._all]));
  const STALE_HOURS  = 48;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot size={20} style={{ color: "#D4A843" }} />
        <h1 className="text-xl font-bold text-foreground">Platform Agents</h1>
        {pendingFlags > 0 && (
          <Link
            href="/admin/moderation?tab=flags"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A", border: "1px solid rgba(232,93,74,0.3)" }}
          >
            <ShieldAlert size={11} />
            {pendingFlags} pending flag{pendingFlags !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Actions today",     value: todayCount,  icon: Activity,   color: "#D4A843" },
          { label: "Actions this week", value: weekCount,   icon: TrendingUp, color: "#4ADE80" },
          { label: "Actions this month",value: monthCount,  icon: Clock,      color: "#60A5FA" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon size={14} style={{ color }} />
            </div>
            <p className="text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Agent health grid */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agent Health</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ALL_AGENT_TYPES.map((type) => {
            const lastRun  = lastRunMap.get(type);
            const count7d  = weekCountMap.get(type) ?? 0;
            const hoursAgo = lastRun ? (Date.now() - lastRun.getTime()) / 3600_000 : Infinity;
            const isStale  = hoursAgo > STALE_HOURS;
            const color    = AGENT_COLORS[type];
            return (
              <Link
                key={type}
                href={`/admin/agents?agent=${type}`}
                className="rounded-xl border p-3 hover:bg-white/[0.02] transition-colors"
                style={{
                  borderColor:     isStale ? "rgba(248,113,113,0.4)" : "var(--border)",
                  backgroundColor: "var(--card)",
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold" style={{ color }}>{AGENT_LABELS[type]}</p>
                  {isStale && (
                    <span title={`No run in ${Math.round(hoursAgo)}h`}>
                      <AlertTriangle size={11} className="shrink-0" style={{ color: "#F87171" }} />
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-foreground">{count7d}</p>
                <p className="text-[10px] text-muted-foreground">
                  {lastRun ? `Last run ${timeSince(lastRun)}` : "Never run"}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Agent-specific stat panels ──────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agent Metrics</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Payment Recovery */}
          <StatCard title="Payment Recovery" color="#F87171" icon={<DollarSign size={14} />}>
            <StatRow label="Sequences started (30d)"  value={payRecoveryStarted} />
            <StatRow label="Day 2 emails sent (30d)"  value={payDay2Sent} />
            <StatRow label="Day 5 emails sent (30d)"  value={payDay5Sent} />
            <StatRow label="Win-back codes issued (30d)" value={payWinBackSent} />
            <StatRow label="Recovery rate (est.)"
              value={pct(payRecoveryStarted - payDay5Sent, payRecoveryStarted)}
              note="sequences that didn't reach Day 5" />
          </StatCard>

          {/* Trend Forecaster */}
          <StatCard title="Trend Forecaster" color="#34D399" icon={<TrendingUp size={14} />}>
            <StatRow label="Reports generated (7d)" value={trendReportsWeek} />
            <StatRow label="Teaser notifications (7d)" value={trendTeasersWeek} />
            <StatRow label="Conversion rate (est.)"
              value={pct(trendReportsWeek, trendTeasersWeek)}
              note="teasers → paid reports" />
          </StatCard>

          {/* Booking Agent */}
          <StatCard title="Booking Agent" color="#FB923C" icon={<Mic2 size={14} />}>
            <StatRow label="Reports generated (total)" value={bookingReportsTotal} />
            <StatRow label="Reports generated (7d)"    value={bookingReportsWeek} />
            <StatRow label="Opportunities surfaced (est.)"
              value={bookingReportsTotal * 10}
              note="10 per report" />
          </StatCard>

          {/* Collaboration Matchmaker */}
          <StatCard title="Collaboration Matchmaker" color="#A78BFA" icon={<Users2 size={14} />}>
            <StatRow label="Match notifications (30d)" value={collabMatchesMonth} />
            <StatRow label="Artists opted in"          value={collabOptInCount} />
            <StatRow label="Pairs introduced (est.)"
              value={Math.floor(collabMatchesMonth / 2)}
              note="2 notifications per pair" />
          </StatCard>

          {/* Inactive Content */}
          <StatCard title="Inactive Content" color="#E879F9" icon={<FileSearch size={14} />}>
            <StatRow label="Digest notifications (7d)" value={inactiveDigestWeek} />
            <StatRow label="Suggestions sent (7d)"     value={inactiveBundleSuggestWeek} />
            <StatRow label="Avg suggestions / artist"
              value={inactiveDigestWeek ? (inactiveBundleSuggestWeek / inactiveDigestWeek).toFixed(1) : "—"} />
          </StatCard>

          {/* Collaboration opt-in trend */}
          <StatCard title="Platform Collaboration Pool" color="#A78BFA" icon={<Music2 size={14} />}>
            <StatRow label="Artists open to collabs" value={collabOptInCount} />
            <StatRow label="Match pairs this month"  value={Math.floor(collabMatchesMonth / 2)} />
            <StatRow label="Notifications sent (30d)" value={collabMatchesMonth} />
          </StatCard>

        </div>
      </div>

      {/* Churn risk + moderation row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Churn risk overview */}
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} style={{ color: "#F87171" }} />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Churn Risk Overview</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Healthy",   value: churnCounts.healthy,  color: "#4ADE80" },
              { label: "At Risk",   value: churnCounts.atRisk,   color: "#FBBF24" },
              { label: "High Risk", value: churnCounts.high,     color: "#FB923C" },
              { label: "Critical",  value: churnCounts.critical, color: "#F87171" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Moderation queue */}
        <div className="rounded-xl border p-4" style={{ borderColor: pendingFlags > 0 ? "rgba(232,93,74,0.4)" : "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={14} style={{ color: "#FB923C" }} />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Moderation Queue</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold" style={{ color: pendingFlags > 0 ? "#E85D4A" : "#4ADE80" }}>
                {pendingFlags}
              </p>
              <p className="text-xs text-muted-foreground">pending review</p>
            </div>
            <Link
              href="/admin/moderation?tab=flags"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={{
                backgroundColor: pendingFlags > 0 ? "rgba(232,93,74,0.12)" : "rgba(255,255,255,0.05)",
                color:           pendingFlags > 0 ? "#E85D4A" : "var(--muted-foreground)",
                border:          `1px solid ${pendingFlags > 0 ? "rgba(232,93,74,0.3)" : "var(--border)"}`,
              }}
            >
              Review →
            </Link>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-muted-foreground" />
        <Link
          href="/admin/agents"
          className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: !agentFilter ? "#D4A843" : "var(--card)",
            color:            !agentFilter ? "#0A0A0A"  : "var(--muted-foreground)",
            border: "1px solid var(--border)",
          }}
        >
          All
        </Link>
        {Object.entries(AGENT_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/agents?agent=${key}`}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: agentFilter === key ? AGENT_COLORS[key as AgentType] : "var(--card)",
              color:            agentFilter === key ? "#0A0A0A" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Recent activity feed */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recent Activity
          {agentFilter && (
            <span className="ml-2 font-normal normal-case" style={{ color: AGENT_COLORS[agentFilter as AgentType] }}>
              — {AGENT_LABELS[agentFilter as AgentType]}
            </span>
          )}
        </p>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No agent actions yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const color     = AGENT_COLORS[log.agentType];
                const details   = log.details as Record<string, unknown> | null;
                const detailStr = details
                  ? Object.entries(details)
                      .filter(([, v]) => v != null && v !== "" && !Array.isArray(v) && typeof v !== "object")
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")
                  : null;
                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {AGENT_LABELS[log.agentType] ?? log.agentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {log.targetType && log.targetId
                        ? `${log.targetType} · ${log.targetId.slice(0, 8)}…`
                        : log.targetType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[220px] truncate" title={detailStr ?? ""}>
                      {detailStr ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {fmtDate(log.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end text-sm">
          {page > 1 && (
            <Link href={`/admin/agents?${agentFilter ? `agent=${agentFilter}&` : ""}page=${page - 1}`}
              className="px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--border)" }}>← Prev</Link>
          )}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/agents?${agentFilter ? `agent=${agentFilter}&` : ""}page=${page + 1}`}
              className="px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--border)" }}>Next →</Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title, color, icon, children,
}: {
  title: string; color: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        <span style={{ color }}>{icon}</span>
        <p className="text-xs font-semibold" style={{ color }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function StatRow({
  label, value, note,
}: {
  label: string; value: number | string; note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {note && <p className="text-[10px] text-muted-foreground/60">{note}</p>}
      </div>
      <p className="text-sm font-bold text-foreground tabular-nums shrink-0">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
