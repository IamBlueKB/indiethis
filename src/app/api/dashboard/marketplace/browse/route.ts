import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/marketplace/browse
// Returns all published, priced tracks from other artists (available for licensing)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracks = await db.track.findMany({
    where: {
      status: "PUBLISHED",
      price: { not: null, gt: 0 },
      artistId: { not: session.user.id }, // exclude own tracks
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      coverArtUrl: true,
      price: true,
      projectName: true,
      plays: true,
      createdAt: true,
      artist: {
        select: {
          id: true,
          name: true,
          artistName: true,
          artistSlug: true,
          photo: true,
        },
      },
    },
  });

  return NextResponse.json({ tracks });
}
