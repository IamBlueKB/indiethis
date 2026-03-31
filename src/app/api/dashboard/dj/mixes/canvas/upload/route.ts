import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/dashboard/dj/mixes/canvas/upload
 *
 * Body: { mixId: string; videoUrl: string }
 *
 * Called after the client uploads the video via UploadThing (trackCanvas endpoint).
 * Validates DJ ownership and saves the URL to DJMix.canvasVideoUrl.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mixId?: string; videoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mixId, videoUrl } = body;
  if (!mixId || !videoUrl) {
    return NextResponse.json({ error: "mixId and videoUrl are required" }, { status: 400 });
  }

  // Resolve DJ profile for this user
  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!djProfile) {
    return NextResponse.json({ error: "No DJ profile found" }, { status: 403 });
  }

  // Verify ownership of the mix
  const mix = await db.dJMix.findUnique({
    where: { id: mixId },
    select: { id: true, djProfileId: true },
  });

  if (!mix) {
    return NextResponse.json({ error: "Mix not found" }, { status: 404 });
  }
  if (mix.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Save canvas URL
  await db.dJMix.update({
    where: { id: mixId },
    data: { canvasVideoUrl: videoUrl },
  });

  return NextResponse.json({ success: true, canvasVideoUrl: videoUrl });
}
