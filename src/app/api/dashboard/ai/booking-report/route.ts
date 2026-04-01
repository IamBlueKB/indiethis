/**
 * GET /api/dashboard/ai/booking-report?mode=ARTIST|DJ
 *
 * Returns the most recent booking report for the authenticated user.
 * Report is stored in AgentLog.details (action: REPORT_GENERATED).
 *
 * Returns: { report: BookingReport } | { report: null }
 */

import { auth }           from "@/lib/auth";
import { db }             from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { BookingReport }        from "@/lib/agents/booking-agent";
import { AT }             from "@/lib/agents";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "ARTIST";

  const log = await db.agentLog.findFirst({
    where: {
      agentType: AT("BOOKING_AGENT"),
      action:    "REPORT_GENERATED",
      targetId:  session.user.id,
      // Filter by mode stored in the details JSON
      details: mode ? { path: ["mode"], equals: mode } : undefined,
    },
    orderBy: { createdAt: "desc" },
    select:  { details: true, createdAt: true },
  });

  if (!log) return NextResponse.json({ report: null });

  return NextResponse.json({
    report: {
      ...(log.details as unknown as BookingReport),
      generatedAt: log.createdAt.toISOString(),
    },
  });
}
