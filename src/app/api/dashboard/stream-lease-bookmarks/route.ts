import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET — list all bookmarked beats for the current artist
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookmarks = await db.streamLeaseBookmark.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      beat: {
        select: {
          id: true,
          title: true,
          coverArtUrl: true,
          bpm: true,
          musicalKey: true,
          fileUrl: true,
          beatLeaseSettings: { select: { streamLeaseEnabled: true } },
          artist: { select: { name: true, artistName: true } },
        },
      },
    },
  });

  return NextResponse.json({ bookmarks });
}

// POST — bookmark a beat
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { beatId } = await req.json().catch(() => ({}));
  if (!beatId) return NextResponse.json({ error: "beatId required" }, { status: 400 });

  // Verify beat exists
  const beat = await db.track.findUnique({ where: { id: beatId }, select: { id: true } });
  if (!beat) return NextResponse.json({ error: "Beat not found" }, { status: 404 });

  const bookmark = await db.streamLeaseBookmark.upsert({
    where:  { artistId_beatId: { artistId: session.user.id, beatId } },
    update: {},
    create: { artistId: session.user.id, beatId },
  });

  return NextResponse.json({ bookmark }, { status: 201 });
}

// DELETE — remove a bookmark
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { beatId } = await req.json().catch(() => ({}));
  if (!beatId) return NextResponse.json({ error: "beatId required" }, { status: 400 });

  await db.streamLeaseBookmark.deleteMany({
    where: { artistId: session.user.id, beatId },
  });

  return NextResponse.json({ ok: true });
}
