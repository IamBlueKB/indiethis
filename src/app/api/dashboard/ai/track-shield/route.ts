/**
 * GET /api/dashboard/ai/track-shield
 * Returns user's TrackShieldScans with results and track titles, most recent first.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scans = await db.trackShieldScan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      tracks: {
        include: {
          track: { select: { id: true, title: true, coverArtUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({ scans });
}
