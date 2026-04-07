/**
 * POST /api/video-studio/[id]/brief/lock
 *
 * Locks the creative brief so the Director can proceed to shot list generation.
 * Sets a briefLockedAt timestamp; shot list generation endpoint checks this.
 *
 * Returns: { locked: true }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }  = await params;
    const session = await auth();

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, userId: true, mode: true, creativeBrief: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.mode !== "DIRECTOR") {
      return NextResponse.json({ error: "Brief lock only available for Director Mode" }, { status: 400 });
    }
    if (!video.creativeBrief) {
      return NextResponse.json({ error: "No brief to lock — complete the chat first" }, { status: 400 });
    }
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Add a locked marker to the brief itself (schema-free approach)
    const lockedBrief = {
      ...(video.creativeBrief as object),
      _lockedAt: new Date().toISOString(),
    };

    await db.musicVideo.update({
      where: { id },
      data:  { creativeBrief: lockedBrief },
    });

    return NextResponse.json({ locked: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
