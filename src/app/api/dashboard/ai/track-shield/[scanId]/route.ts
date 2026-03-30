/**
 * GET /api/dashboard/ai/track-shield/[scanId]
 * Returns a single scan with all results, track titles, and match details.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await params;

  const scan = await db.trackShieldScan.findFirst({
    where: { id: scanId, userId: session.user.id },
    include: {
      tracks: {
        include: {
          track: { select: { id: true, title: true, coverArtUrl: true } },
        },
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({ scan });
}
