/**
 * GET /api/dashboard/ai/trend-report
 *
 * Returns the most recent trend report generated for the authenticated user.
 * Report is stored in AgentLog.metadata (action: TREND_REPORT_GENERATED).
 *
 * Returns: { report: TrendReport } | { report: null }
 */

import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { NextResponse }              from "next/server";
import type { TrendReport }          from "@/lib/agents/trend-forecaster";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await db.agentLog.findFirst({
    where:   { agentType: "TREND_FORECASTER", action: "TREND_REPORT_GENERATED", targetId: session.user.id },
    orderBy: { createdAt: "desc" },
    select:  { details: true, createdAt: true },
  });

  if (!log) return NextResponse.json({ report: null });

  return NextResponse.json({
    report: { ...(log.details as unknown as TrendReport), generatedAt: log.createdAt.toISOString() },
  });
}
