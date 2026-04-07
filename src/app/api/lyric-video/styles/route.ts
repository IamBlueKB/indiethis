/**
 * GET /api/lyric-video/styles
 *
 * Returns all active TypographyStyle records, ordered by sortOrder.
 * Public — no auth required.
 */

import { NextResponse } from "next/server";
import { db }           from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const styles = await db.typographyStyle.findMany({
      where:   { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id:             true,
        name:           true,
        displayName:    true,
        description:    true,
        previewCss:     true,
        remotionConfig: true,
        sortOrder:      true,
      },
    });
    return NextResponse.json({ styles });
  } catch (err) {
    console.error("[lyric-video/styles] error:", err);
    return NextResponse.json({ error: "Failed to load styles." }, { status: 500 });
  }
}
