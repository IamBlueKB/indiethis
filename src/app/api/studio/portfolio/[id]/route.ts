import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getStudio(userId: string) {
  return db.studio.findFirst({ where: { ownerId: userId }, select: { id: true } });
}

// PATCH /api/studio/portfolio/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { id } = await params;
  const body = await req.json();
  const track = await db.studioPortfolioTrack.updateMany({
    where: { id, studioId: studio.id },
    data: body,
  });
  if (!track.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/studio/portfolio/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { id } = await params;
  await db.studioPortfolioTrack.deleteMany({ where: { id, studioId: studio.id } });
  return NextResponse.json({ ok: true });
}
