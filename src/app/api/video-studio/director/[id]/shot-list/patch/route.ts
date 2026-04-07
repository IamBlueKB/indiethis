/**
 * PATCH /api/video-studio/director/[id]/shot-list/patch
 *
 * Updates the shot list (reorder, edit prompt of a scene).
 * Body: { shotList: ShotListScene[] }
 */

import { db }                  from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }    = await params;
    const { shotList } = await req.json() as { shotList: unknown[] };

    if (!Array.isArray(shotList)) {
      return NextResponse.json({ error: "shotList must be an array" }, { status: 400 });
    }

    await db.musicVideo.update({
      where: { id },
      data:  { shotList: shotList as object[] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
