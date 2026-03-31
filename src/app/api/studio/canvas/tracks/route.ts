/**
 * GET /api/studio/canvas/tracks?artistUserId=xxx
 *
 * Returns tracks for an IndieThis artist that is on this studio's roster.
 * Studio admin only — verifies roster membership before exposing track data.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const artistUserId = searchParams.get("artistUserId");
  if (!artistUserId) {
    return NextResponse.json({ error: "artistUserId is required" }, { status: 400 });
  }

  // Resolve studio
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  // Verify the artist is on this studio's roster (via Contact email match)
  const artistUser = await db.user.findUnique({
    where: { id: artistUserId },
    select: { id: true, email: true, role: true },
  });
  if (!artistUser || artistUser.role !== "ARTIST") {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  if (artistUser.email) {
    const contact = await db.contact.findFirst({
      where: { studioId: studio.id, email: artistUser.email },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Artist is not on your roster" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Artist has no email — cannot verify roster membership" }, { status: 403 });
  }

  // Fetch tracks
  const tracks = await db.track.findMany({
    where: { artistId: artistUserId },
    select: {
      id: true,
      title: true,
      fileUrl: true,
      coverArtUrl: true,
      canvasVideoUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ tracks });
}
