import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/marketplace/top-beats
// Returns the top 10 beats ranked by number of active stream leases.
// Used by the Beat Marketplace leaderboard and feeds into the future Explore page.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch published tracks that have at least one active stream lease.
  // We take top 50 then sort + slice in JS because Prisma _count orderBy
  // cannot filter by relation fields (isActive) at the database level.
  const tracks = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      streamLeases: { some: { isActive: true } },
    },
    take: 50,
    select: {
      id: true,
      title: true,
      coverArtUrl: true,
      artist: {
        select: {
          id: true,
          name: true,
          artistName: true,
          artistSlug: true,
        },
      },
      _count: {
        select: {
          // Only count active leases
          streamLeases: { where: { isActive: true } },
        },
      },
    },
  });

  const ranked = tracks
    .map(({ _count, ...t }) => ({ ...t, activeLeaseCount: _count.streamLeases }))
    .sort((a, b) => b.activeLeaseCount - a.activeLeaseCount)
    .slice(0, 10);

  return NextResponse.json({ beats: ranked });
}
