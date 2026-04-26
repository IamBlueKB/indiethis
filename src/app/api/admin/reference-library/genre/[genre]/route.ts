/**
 * GET    /api/admin/reference-library/genre/[genre] — full target + profile list
 * DELETE /api/admin/reference-library/genre/[genre] — reset (delete all profiles for this genre)
 * PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";
import { recomputeGenreTarget } from "@/lib/reference-library/aggregate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ genre: string }> },
) {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { genre } = await params;
  const target = await prisma.genreTarget.findUnique({ where: { genre } });
  const profiles = await prisma.referenceProfile.findMany({
    where:   { genre },
    orderBy: { createdAt: "desc" },
    select:  {
      id: true, source: true, sourceQuality: true, sourceQualityWeight: true,
      separationConfidence: true, separationWeight: true, trackName: true,
      artistName: true, subgenre: true, qualityGatePassed: true, weight: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ genre, target, profiles });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ genre: string }> },
) {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { genre } = await params;
  await prisma.referenceProfile.deleteMany({ where: { genre } });
  await recomputeGenreTarget(genre); // will write empty target
  return NextResponse.json({ ok: true });
}
