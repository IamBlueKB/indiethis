import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedMix(mixId: string, userId: string) {
  const djProfile = await db.dJProfile.findUnique({ where: { userId } });
  if (!djProfile) return null;
  return db.dJMix.findFirst({ where: { id: mixId, djProfileId: djProfile.id } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mix = await getOwnedMix(id, session.user.id);
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tracklist = await db.dJMixTrack.findMany({
    where: { djMixId: id },
    include: { track: { include: { artist: true } } },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ tracklist });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mix = await getOwnedMix(id, session.user.id);
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    position: number;
    startTime?: number;
    title?: string;
    artist?: string;
    trackId?: string;
  };

  const item = await db.dJMixTrack.create({
    data: {
      djMixId:   id,
      position:  body.position,
      startTime: body.startTime ?? null,
      title:     body.title?.trim()  ?? null,
      artist:    body.artist?.trim() ?? null,
      trackId:   body.trackId        ?? null,
    },
  });

  return NextResponse.json({ item });
}
