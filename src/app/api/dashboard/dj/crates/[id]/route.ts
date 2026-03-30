import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/dashboard/dj/crates/[id] — update crate
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const crate = await db.crate.findUnique({ where: { id }, select: { djProfileId: true } });
  if (!crate || crate.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { name?: string; description?: string; isPublic?: boolean };

  const updated = await db.crate.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
    },
  });

  return NextResponse.json({ crate: updated });
}

// DELETE /api/dashboard/dj/crates/[id] — delete crate (must own)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const crate = await db.crate.findUnique({ where: { id }, select: { djProfileId: true } });
  if (!crate || crate.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.crate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
