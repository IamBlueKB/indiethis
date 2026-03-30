import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedMix(mixId: string, userId: string) {
  const djProfile = await db.dJProfile.findUnique({ where: { userId } });
  if (!djProfile) return null;
  return db.dJMix.findFirst({ where: { id: mixId, djProfileId: djProfile.id } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const mix = await getOwnedMix(id, session.user.id);
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    position?: number;
    startTime?: number;
    title?: string;
    artist?: string;
    trackId?: string;
  };

  const updated = await db.dJMixTrack.update({
    where: { id: itemId },
    data: {
      ...(body.position  != null && { position:  body.position }),
      ...(body.startTime != null && { startTime: body.startTime }),
      ...(body.title     != null && { title:     body.title.trim() }),
      ...(body.artist    != null && { artist:    body.artist.trim() }),
      ...(body.trackId   != null && { trackId:   body.trackId }),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const mix = await getOwnedMix(id, session.user.id);
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.dJMixTrack.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
