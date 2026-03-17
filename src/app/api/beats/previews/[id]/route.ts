import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/beats/previews/[id] — fetch a beat preview (producer or recipient)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await db.beatPreview.findUnique({
    where: { id },
    include: {
      track: { select: { id: true, title: true, fileUrl: true, coverArtUrl: true, artistId: true } },
      producer: { select: { id: true, name: true, artistName: true, photo: true } },
    },
  });

  if (!preview) return NextResponse.json({ error: "Preview not found" }, { status: 404 });

  // Only producer or designated artist can access
  const isAuthorized =
    preview.producerId === session.user.id ||
    preview.artistId === session.user.id ||
    preview.artistId === null;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (new Date() > preview.expiresAt) {
    return NextResponse.json({ error: "This preview has expired." }, { status: 410 });
  }

  // Mark as listened if artist is viewing
  if (preview.artistId === session.user.id && preview.status === "PENDING") {
    await db.beatPreview.update({ where: { id }, data: { status: "LISTENED" } });
  }

  return NextResponse.json({ preview });
}
