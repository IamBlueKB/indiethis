import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { logModerationAction } from "@/lib/ai-log";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/moderation/[studioId]/approve — clear the flag
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studioId } = await params;

  await Promise.all([
    db.studio.update({
      where: { id: studioId },
      data: { moderationStatus: "CLEAN", moderationReason: null },
    }),
    // Log actionTaken on the most recent moderation scan for this studio
    logModerationAction(studioId, "approved"),
  ]);

  return NextResponse.json({ ok: true });
}
