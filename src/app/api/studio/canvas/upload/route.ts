/**
 * POST /api/studio/canvas/upload
 *
 * Called after the studio uploads a canvas video via UploadThing (trackCanvas endpoint).
 * Validates roster membership and saves the URL to Track.canvasVideoUrl.
 *
 * Body: { trackId: string; videoUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trackId?: string; videoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trackId, videoUrl } = body;
  if (!trackId || !videoUrl) {
    return NextResponse.json({ error: "trackId and videoUrl are required" }, { status: 400 });
  }

  // Resolve studio
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  // Verify the track's artist is on this studio's roster
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      artistId: true,
      artist: { select: { email: true, role: true } },
    },
  });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.artist.role !== "ARTIST") {
    return NextResponse.json({ error: "Track does not belong to an artist" }, { status: 403 });
  }

  if (track.artist.email) {
    const contact = await db.contact.findFirst({
      where: { studioId: studio.id, email: track.artist.email },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Artist is not on your roster" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Artist has no email — cannot verify roster membership" }, { status: 403 });
  }

  // Save canvas URL
  await db.track.update({
    where: { id: trackId },
    data: { canvasVideoUrl: videoUrl },
  });

  return NextResponse.json({ success: true, canvasVideoUrl: videoUrl });
}
