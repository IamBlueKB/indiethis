import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE /api/studio/quick-send/[id] — remove a quick-send delivery
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  // Verify ownership before deleting
  const send = await db.quickSend.findUnique({
    where: { id },
    select: { studioId: true },
  });
  if (!send) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (send.studioId !== studio.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.quickSend.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
