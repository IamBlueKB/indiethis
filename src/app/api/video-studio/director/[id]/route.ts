/**
 * GET /api/video-studio/director/[id]
 *
 * Returns the full director mode state for a music video:
 * conversationLog, creativeBrief, shotList, song analysis data.
 */

import { db }           from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const video = await db.musicVideo.findUnique({
    where:  { id },
    select: {
      id:              true,
      trackTitle:      true,
      mode:            true,
      status:          true,
      videoLength:     true,
      aspectRatio:     true,
      style:           true,
      bpm:             true,
      musicalKey:      true,
      energy:          true,
      conversationLog: true,
      creativeBrief:   true,
      shotList:        true,
      amount:          true,
      userId:          true,
    },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(video);
}
