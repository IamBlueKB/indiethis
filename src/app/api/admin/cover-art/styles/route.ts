/**
 * POST /api/admin/cover-art/styles?action=seed
 *   Upserts all 15 default CoverArtStyle records.
 *
 * GET /api/admin/cover-art/styles
 *   Returns all styles (admin view).
 *
 * PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { COVER_ART_STYLES }          from "@/lib/cover-art/styles-seed";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN" ? session : null;
}

export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const styles = await db.coverArtStyle.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ styles });
}

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "seed") {
    let seeded = 0;
    for (const s of COVER_ART_STYLES) {
      await db.coverArtStyle.upsert({
        where:  { name: s.name },
        create: s,
        update: { category: s.category, promptBase: s.promptBase, sortOrder: s.sortOrder },
      });
      seeded++;
    }
    return NextResponse.json({ ok: true, seeded });
  }

  // Create a single style
  const body = await req.json() as {
    name: string; category: string; previewUrl: string; promptBase: string; sortOrder?: number;
  };
  if (!body.name || !body.category || !body.promptBase) {
    return NextResponse.json({ error: "name, category, promptBase required" }, { status: 400 });
  }
  const style = await db.coverArtStyle.create({ data: body });
  return NextResponse.json({ style }, { status: 201 });
}
