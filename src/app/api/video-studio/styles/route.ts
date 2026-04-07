/**
 * GET /api/video-studio/styles
 *
 * Returns all active VideoStyle records for the style picker.
 * Public — no auth required.
 */

import { db }            from "@/lib/db";
import { NextResponse }  from "next/server";

export async function GET() {
  const styles = await db.videoStyle.findMany({
    where:   { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id:         true,
      name:       true,
      category:   true,
      previewUrl: true,
      sortOrder:  true,
    },
  });

  return NextResponse.json({ styles });
}
