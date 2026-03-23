import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/videos/products
// Returns the artist's tracks, beats, and merch for the "Link to Product" modal.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tracks, beats, merch] = await Promise.all([
    // Regular tracks — no beatLeaseSettings
    db.track.findMany({
      where: {
        artistId: session.user.id,
        beatLeaseSettings: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, coverArtUrl: true },
      take: 100,
    }),
    // Beats — have beatLeaseSettings
    db.track.findMany({
      where: {
        artistId: session.user.id,
        beatLeaseSettings: { isNot: null },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, coverArtUrl: true },
      take: 100,
    }),
    // Merch
    db.merchProduct.findMany({
      where: { artistId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, imageUrl: true },
      take: 100,
    }),
  ]);

  return NextResponse.json({ tracks, beats, merch });
}
