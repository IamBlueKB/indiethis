/**
 * GET /api/cover-art/styles
 *
 * Returns all active CoverArtStyle records ordered by sortOrder.
 * Public — no auth required. Used by both the dashboard wizard and the
 * non-subscriber public /cover-art page.
 */

import { db }           from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const styles = await db.coverArtStyle.findMany({
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
  } catch {
    return NextResponse.json({ styles: [] });
  }
}
