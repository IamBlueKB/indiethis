import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/explore/recently-played
 * Returns the authenticated user's 8 most recently played tracks.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ plays: [] });
  }

  const plays = await db.recentPlay.findMany({
    where: { userId: session.user.id },
    include: {
      track: {
        select: {
          id: true,
          title: true,
          coverArtUrl: true,
          fileUrl: true,
          genre: true,
          plays: true,
          artist: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { playedAt: "desc" },
    distinct: ["trackId"],
    take: 8,
  });

  return NextResponse.json({ plays: plays.map((p) => p.track) });
}
