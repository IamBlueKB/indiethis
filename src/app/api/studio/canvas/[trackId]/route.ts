/**
 * DELETE /api/studio/canvas/[trackId]
 *
 * Removes canvasVideoUrl from a track. Studio admin only —
 * verifies the track's artist is on this studio's roster.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trackId } = await params;

  // Resolve studio
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  // Verify roster membership
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
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

  await db.track.update({
    where: { id: trackId },
    data: { canvasVideoUrl: null },
  });

  return NextResponse.json({ success: true });
}
