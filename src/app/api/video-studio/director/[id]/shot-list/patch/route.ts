/**
 * PATCH /api/video-studio/director/[id]/shot-list/patch
 *
 * Updates the shot list (reorder, edit prompt of a scene).
 * Body: { shotList: ShotListScene[] }
 */

import { db }                  from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireOwnedMusicVideo } from "@/lib/auth/ownership";

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

    // Phase 1.2 IDOR fix — anyone with cuid could rewrite another user's shot list.
    const guard = await requireOwnedMusicVideo(id);
    if (!guard.ok) return guard.response;

    await db.musicVideo.update({
      where: { id },
      data:  { shotList: shotList as object[] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
