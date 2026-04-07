/**
 * GET /api/video-studio/presets
 *
 * Returns all active VideoPreset records ordered by sortOrder.
 * Public — no auth required.
 */

import { db }            from "@/lib/db";
import { NextResponse }  from "next/server";

export async function GET() {
  try {
    const presets = await db.videoPreset.findMany({
      where:   { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id:             true,
        name:           true,
        genre:          true,
        description:    true,
        previewUrl:     true,
        styleName:      true,
        moodArc:        true,
        cameraSequence: true,
        briefTemplate:  true,
        sortOrder:      true,
      },
    });

    return NextResponse.json({ presets });
  } catch (err) {
    console.error("[video-studio/presets]", err);
    return NextResponse.json({ presets: [] });
  }
}
