import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { logModerationAction } from "@/lib/ai-log";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [studio] = await Promise.all([
    db.studio.update({
      where: { id },
      data: { isPublished: false },
      select: { id: true, isPublished: true },
    }),
    // If there's a recent moderation scan, log this as unpublished action
    logModerationAction(id, "unpublished"),
  ]);

  return NextResponse.json(studio);
}
