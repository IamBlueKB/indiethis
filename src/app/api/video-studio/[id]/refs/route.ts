/**
 * POST /api/video-studio/[id]/refs
 *
 * Saves reference image URLs for character consistency (Director Mode).
 * Called after the user uploads images via the UploadThing videoStudioRef key.
 *
 * Body: { imageUrls: string[] }
 * Returns: { characterRefs: string[] }
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }       = await params;
    const { imageUrls } = await req.json() as { imageUrls: string[] };
    const session      = await auth();

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "imageUrls array required" }, { status: 400 });
    }

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, userId: true, characterRefs: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership check (guests can update their own videos too)
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Merge with existing refs, deduplicate, cap at 5
    const existing = (video.characterRefs as string[] | null) ?? [];
    const merged   = Array.from(new Set([...existing, ...imageUrls])).slice(0, 5);

    await db.musicVideo.update({
      where: { id },
      data:  { characterRefs: merged },
    });

    return NextResponse.json({ characterRefs: merged });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
