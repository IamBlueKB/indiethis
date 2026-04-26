/**
 * GET /api/admin/reference-library/trends
 * Popular user-reference uploads — driven by UserReferencePopularity.
 * PLATFORM_ADMIN only.
 */

import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";

export async function GET() {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trends = await prisma.userReferencePopularity.findMany({
    orderBy: { uploadCount: "desc" },
    take:    100,
  });

  return NextResponse.json({ trends });
}
