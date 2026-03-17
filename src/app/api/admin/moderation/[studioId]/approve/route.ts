import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/moderation/[studioId]/approve — clear the flag
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studioId } = await params;

  await db.studio.update({
    where: { id: studioId },
    data: { moderationStatus: "CLEAN", moderationReason: null },
  });

  return NextResponse.json({ ok: true });
}
