import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const VIDEO_SELECT = {
  id:             true,
  title:          true,
  description:    true,
  videoUrl:       true,
  thumbnailUrl:   true,
  embedUrl:       true,
  type:           true,
  category:       true,
  duration:       true,
  sortOrder:      true,
  isPublished:    true,
  syncedFromYouTube: true,
  linkedTrackId:  true,
  linkedBeatId:   true,
  linkedMerchId:  true,
  createdAt:      true,
  linkedTrack: { select: { id: true, title: true, coverArtUrl: true } },
  linkedBeat:  { select: { id: true, title: true, coverArtUrl: true } },
  linkedMerch: { select: { id: true, title: true, imageUrl: true  } },
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.artistVideo.findFirst({ where: { id, artistId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Build update data — YouTube-synced videos cannot change title or thumbnailUrl
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (!existing.syncedFromYouTube) {
    if (body.title       !== undefined) data.title       = body.title;
    if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl ?? null;
  }
  if (body.description !== undefined) data.description = body.description ?? null;
  if (body.isPublished !== undefined) data.isPublished  = body.isPublished;
  if (body.sortOrder   !== undefined) data.sortOrder    = body.sortOrder;
  if (body.category    !== undefined) data.category     = body.category ?? null;

  // Product linking — mutually exclusive: setting one clears the others
  if (body.linkedTrackId !== undefined) {
    data.linkedTrackId = body.linkedTrackId ?? null;
    data.linkedBeatId  = null;
    data.linkedMerchId = null;
  } else if (body.linkedBeatId !== undefined) {
    data.linkedBeatId  = body.linkedBeatId ?? null;
    data.linkedTrackId = null;
    data.linkedMerchId = null;
  } else if (body.linkedMerchId !== undefined) {
    data.linkedMerchId = body.linkedMerchId ?? null;
    data.linkedTrackId = null;
    data.linkedBeatId  = null;
  } else if (body.removeLink === true) {
    data.linkedTrackId = null;
    data.linkedBeatId  = null;
    data.linkedMerchId = null;
  }

  const video = await db.artistVideo.update({
    where:  { id },
    data,
    select: VIDEO_SELECT,
  });

  return NextResponse.json({ video });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.artistVideo.findFirst({ where: { id, artistId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.artistVideo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
