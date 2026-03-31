import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/dashboard/music/canvas/[trackId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trackId } = await params;

  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { artistId: true },
  });
  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (track.artistId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.track.update({
    where: { id: trackId },
    data: { canvasVideoUrl: null },
  });

  return NextResponse.json({ success: true });
}
