import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/dashboard/music/canvas/upload
 *
 * Body: { trackId: string; videoUrl: string }
 *
 * Called after the client uploads the video via UploadThing (trackCanvas endpoint).
 * Validates ownership and saves the URL to Track.canvasVideoUrl.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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

  // Verify ownership
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { id: true, artistId: true },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  if (track.artistId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Save canvas URL
  await db.track.update({
    where: { id: trackId },
    data: { canvasVideoUrl: videoUrl },
  });

  return NextResponse.json({ success: true, canvasVideoUrl: videoUrl });
}
