import { NextRequest, NextResponse } from "next/server";
import { getLastRun, logAgentAction } from "@/lib/agents";

/**
 * POST /api/cron/agents
 * Master cron route — protected by CRON_SECRET.
 * Runs all platform agents on their individual schedules.
 * Each agent has a shouldRun() check based on when it last ran.
 *
 * Recommended Vercel cron schedule: every hour ("0 * * * *")
 * Agents decide internally whether to actually execute based on their own cadence.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now     = Date.now();
  const results: Record<string, string> = {};

  // ── Churn Prevention — runs daily ────────────────────────────────────────
  const shouldRunChurn = await shouldRun("CHURN_PREVENTION", 22); // 22h guard
  if (shouldRunChurn) {
    try {
      const { runChurnPreventionAgent } = await import("@/lib/agents/churn-prevention");
      await logAgentAction("CHURN_PREVENTION", "AGENT_RUN_START");
      const result = await runChurnPreventionAgent();
      results.churnPrevention = `acted on ${result.acted} users`;
    } catch (err) {
      results.churnPrevention = `error: ${String(err)}`;
    }
  } else {
    results.churnPrevention = "skipped (not due)";
  }

  // ── Revenue Optimization — runs weekly (Mon) ──────────────────────────────
  const isMonday = new Date().getDay() === 1;
  const shouldRunRevenue = isMonday && await shouldRun("REVENUE_OPTIMIZATION", 6 * 24); // 6d guard
  if (shouldRunRevenue) {
    try {
      const { runRevenueOptimizationAgent } = await import("@/lib/agents/revenue-optimization");
      await logAgentAction("REVENUE_OPTIMIZATION", "AGENT_RUN_START");
      const result = await runRevenueOptimizationAgent();
      results.revenueOptimization = `acted on ${result.acted} users`;
    } catch (err) {
      results.revenueOptimization = `error: ${String(err)}`;
    }
  } else {
    results.revenueOptimization = isMonday ? "skipped (not due)" : "skipped (not Monday)";
  }

  return NextResponse.json({
    ok:       true,
    duration: `${Date.now() - now}ms`,
    results,
  });
}

// ─── Helper: shouldRun ────────────────────────────────────────────────────────

async function shouldRun(agentType: Parameters<typeof getLastRun>[0], minHoursBetween: number): Promise<boolean> {
  const lastRun = await getLastRun(agentType);
  if (!lastRun) return true;
  return Date.now() - lastRun.getTime() > minHoursBetween * 60 * 60 * 1000;
}
