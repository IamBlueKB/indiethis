import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/marketplace/browse
// Returns all published, priced tracks from other artists (available for licensing).
// Each track includes `isOwned: true` when the current user holds an active BeatLicense.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch tracks and user's owned licenses in parallel
  const [tracks, ownedLicenses] = await Promise.all([
    db.track.findMany({
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
        canvasVideoUrl: true,
        price: true,
        projectName: true,
        plays: true,
        bpm: true,
        musicalKey: true,
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
        beatLeaseSettings: {
          select: { streamLeaseEnabled: true, maxStreamLeases: true },
        },
        _count: {
          select: { streamLeases: { where: { isActive: true } } },
        },
      },
    }),
    db.beatLicense.findMany({
      where: { artistId: session.user.id, status: "ACTIVE" },
      select: { trackId: true },
    }),
  ]);

  const ownedTrackIds = new Set(ownedLicenses.map((l) => l.trackId));

  const tracksWithOwnership = tracks.map(({ _count, beatLeaseSettings, ...t }) => ({
    ...t,
    isOwned:            ownedTrackIds.has(t.id),
    activeLeaseCount:   _count.streamLeases,
    streamLeaseEnabled: beatLeaseSettings?.streamLeaseEnabled ?? true,
    maxStreamLeases:    beatLeaseSettings?.maxStreamLeases    ?? null,
  }));

  return NextResponse.json({ tracks: tracksWithOwnership });
}
