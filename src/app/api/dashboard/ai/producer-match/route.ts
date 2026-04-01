/**
 * GET /api/dashboard/ai/producer-match
 *
 * Returns the most recent producer-artist match report for the authenticated user.
 * Report is stored in AgentLog.details (action: MATCH_REPORT_GENERATED).
 *
 * Returns: { report: ProducerArtistMatchReport } | { report: null }
 */

import { auth }                        from "@/lib/auth";
import { db }                          from "@/lib/db";
import { NextResponse }                from "next/server";
import type { ProducerArtistMatchReport } from "@/lib/agents/producer-artist-match";
import { AT }                          from "@/lib/agents";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await db.agentLog.findFirst({
    where: {
      agentType: AT("PRODUCER_ARTIST_MATCH"),
      action:    "MATCH_REPORT_GENERATED",
      targetId:  session.user.id,
    },
    orderBy: { createdAt: "desc" },
    select:  { details: true, createdAt: true },
  });

  if (!log) return NextResponse.json({ report: null });

  return NextResponse.json({
    report: {
      ...(log.details as unknown as ProducerArtistMatchReport),
      generatedAt: log.createdAt.toISOString(),
    },
  });
}
