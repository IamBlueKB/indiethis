/**
 * GET /api/admin/moderation/flags
 * Returns pending ModerationFlag records for the admin queue.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess }        from "@/lib/require-admin-access";
import { db }                        from "@/lib/db";

export async function GET(req: NextRequest) {
  await requireAdminAccess("moderation");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const flags = await db.moderationFlag.findMany({
    where:   { status },
    orderBy: { createdAt: "desc" },
    take:    100,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ flags });
}
