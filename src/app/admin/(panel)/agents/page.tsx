import { db }                   from "@/lib/db";
import { requireAdminAccess }   from "@/lib/require-admin-access";
import Link                     from "next/link";
import { Bot, Filter }          from "lucide-react";
import type { AgentType }       from "@prisma/client";

const AGENT_LABELS: Record<AgentType, string> = {
  CHURN_PREVENTION:    "Churn Prevention",
  REVENUE_OPTIMIZATION:"Revenue Optimization",
  RELEASE_STRATEGY:    "Release Strategy",
  FAN_ENGAGEMENT:      "Fan Engagement",
  SESSION_FOLLOWUP:    "Session Follow-up",
  AR_INTELLIGENCE:     "A&R Intelligence",
  CONTENT_MODERATION:  "Content Moderation",
  LEAD_SCORING:        "Lead Scoring",
};

const AGENT_COLORS: Record<AgentType, string> = {
  CHURN_PREVENTION:    "#F87171",
  REVENUE_OPTIMIZATION:"#4ADE80",
  RELEASE_STRATEGY:    "#60A5FA",
  FAN_ENGAGEMENT:      "#A78BFA",
  SESSION_FOLLOWUP:    "#34D399",
  AR_INTELLIGENCE:     "#FBBF24",
  CONTENT_MODERATION:  "#FB923C",
  LEAD_SCORING:        "#38BDF8",
};

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

  const where = agentFilter
    ? { agentType: agentFilter as AgentType }
    : {};

  const [logs, total, summary] = await Promise.all([
    db.agentLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take:    perPage,
      skip,
    }),
    db.agentLog.count({ where }),
    // Summary: count per agent type in last 7 days
    db.agentLog.groupBy({
      by:        ["agentType"],
      _count:    { _all: true },
      where:     { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy:   { _count: { agentType: "desc" } },
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={20} style={{ color: "#D4A843" }} />
          <h1 className="text-xl font-bold text-foreground">Platform Agents</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
            {total.toLocaleString()} total actions
          </span>
        </div>
      </div>

      {/* 7-day summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Link
            key={s.agentType}
            href={`/admin/agents?agent=${s.agentType}`}
            className="rounded-xl border p-4 hover:bg-white/[0.02] transition-colors"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: AGENT_COLORS[s.agentType] }}>
              {AGENT_LABELS[s.agentType]}
            </p>
            <p className="text-2xl font-bold text-foreground">{s._count._all}</p>
            <p className="text-xs text-muted-foreground mt-0.5">actions (7d)</p>
          </Link>
        ))}
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
            border:           "1px solid var(--border)",
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
              border:           "1px solid var(--border)",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Log table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Agent</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Target</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No agent actions yet.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${AGENT_COLORS[log.agentType]}20`,
                      color:           AGENT_COLORS[log.agentType],
                    }}
                  >
                    {AGENT_LABELS[log.agentType]}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground font-mono text-xs">{log.action}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {log.targetType && log.targetId
                    ? `${log.targetType} · ${log.targetId.slice(0, 8)}…`
                    : log.targetType ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {log.createdAt.toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
