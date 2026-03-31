import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/dashboard/dj/mixes/canvas/[mixId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mixId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mixId } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const mix = await db.dJMix.findUnique({
    where: { id: mixId },
    select: { djProfileId: true },
  });
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (mix.djProfileId !== djProfile.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.dJMix.update({
    where: { id: mixId },
    data: { canvasVideoUrl: null },
  });

  return NextResponse.json({ success: true });
}
