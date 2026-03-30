import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/dashboard/dj/crates/[id]/items/[trackId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; trackId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: crateId, trackId } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });
  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  // Verify access (owner or collaborator)
  const crate = await db.crate.findUnique({ where: { id: crateId }, select: { djProfileId: true } });
  if (!crate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (crate.djProfileId !== djProfile.id) {
    const collab = await db.crateCollaborator.findUnique({
      where: { crateId_djProfileId: { crateId, djProfileId: djProfile.id } },
    });
    if (!collab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.crateItem.deleteMany({ where: { crateId, trackId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/dashboard/dj/crates/[id]/items/[trackId] — update notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; trackId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: crateId, trackId } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });
  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const crate = await db.crate.findUnique({ where: { id: crateId }, select: { djProfileId: true } });
  if (!crate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (crate.djProfileId !== djProfile.id) {
    const collab = await db.crateCollaborator.findUnique({
      where: { crateId_djProfileId: { crateId, djProfileId: djProfile.id } },
    });
    if (!collab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { notes?: string };

  const updated = await db.crateItem.updateMany({
    where: { crateId, trackId },
    data: { notes: body.notes ?? null },
  });

  return NextResponse.json({ updated });
}
