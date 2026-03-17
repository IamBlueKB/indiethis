import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/admin/moderation — list flagged + reviewing studios
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studios = await db.studio.findMany({
    where: { moderationStatus: { in: ["FLAGGED", "REVIEWING"] } },
    orderBy: { moderationScannedAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      moderationStatus: true,
      moderationReason: true,
      moderationScannedAt: true,
      isPublished: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ studios });
}
