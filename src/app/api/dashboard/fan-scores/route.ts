/**
 * GET  /api/dashboard/fan-scores
 *   Returns the top fans for the authenticated artist, ranked by totalSpend.
 *   Default limit: 50.
 *
 * POST /api/dashboard/fan-scores
 *   Triggers a full recompute from historical data (backfill / repair).
 *   Returns { rebuilt: number } — count of fan rows created.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeAllFanScores } from "@/lib/fan-scores";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fans = await db.fanScore.findMany({
      where:   { artistId: session.user.id },
      orderBy: { totalSpend: "desc" },
      take:    50,
      select: {
        id:          true,
        email:       true,
        totalSpend:  true,
        merchSpend:  true,
        tipSpend:    true,
        orderCount:  true,
        tipCount:    true,
        lastSpentAt: true,
      },
    });

    const totalRevenue = fans.reduce((s, f) => s + f.totalSpend, 0);

    return NextResponse.json({ fans, totalRevenue });
  } catch (err) {
    console.error("[fan-scores GET]", err);
    return NextResponse.json({ error: "Failed to load fan scores" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rebuilt = await recomputeAllFanScores(session.user.id);
    return NextResponse.json({ ok: true, rebuilt });
  } catch (err) {
    console.error("[fan-scores POST]", err);
    return NextResponse.json({ error: "Failed to rebuild fan scores" }, { status: 500 });
  }
}
