/**
 * POST /api/video-studio/[id]/publish
 *
 * Marks a completed music video as published/shared.
 * For now: sets a publishedAt timestamp. Future: integrates with
 * artist site or social media sharing.
 *
 * Returns: { published: true, publishedAt: string }
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
      select: { id: true, status: true, userId: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (video.status !== "COMPLETE") {
      return NextResponse.json({ error: "Only completed videos can be published" }, { status: 400 });
    }

    const publishedAt = new Date();

    // Store publishedAt in the updatedAt field — no separate column needed yet
    // Future: add publishedAt column to schema
    await db.musicVideo.update({
      where: { id },
      data:  { updatedAt: publishedAt },
    });

    return NextResponse.json({ published: true, publishedAt: publishedAt.toISOString() });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
