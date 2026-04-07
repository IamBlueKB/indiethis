/**
 * GET  /api/video-studio/[id]/brief  — get the creative brief
 * POST /api/video-studio/[id]/brief  — update/save the creative brief
 *
 * Used by Director Mode to display + allow editing of the Claude-generated brief.
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, creativeBrief: true, mode: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.mode !== "DIRECTOR") {
      return NextResponse.json({ error: "Brief only available for Director Mode videos" }, { status: 400 });
    }

    return NextResponse.json({ brief: video.creativeBrief ?? null });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }  = await params;
    const body    = await req.json() as { brief: object };
    const session = await auth();

    if (!body.brief || typeof body.brief !== "object") {
      return NextResponse.json({ error: "brief object required" }, { status: 400 });
    }

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: { id: true, userId: true, mode: true },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.mode !== "DIRECTOR") {
      return NextResponse.json({ error: "Brief only available for Director Mode videos" }, { status: 400 });
    }
    if (video.userId && session?.user?.id !== video.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.musicVideo.update({
      where: { id },
      data:  { creativeBrief: body.brief },
    });

    return NextResponse.json({ brief: body.brief });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
