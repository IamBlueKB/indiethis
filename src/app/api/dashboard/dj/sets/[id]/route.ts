import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/dashboard/dj/sets/[id] — update set
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const existing = await db.dJSet.findUnique({ where: { id }, select: { djProfileId: true } });
  if (!existing || existing.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    title?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    venue?: string;
    date?: string;
    duration?: number;
  };

  const set = await db.dJSet.update({
    where: { id },
    data: {
      ...(body.title?.trim() && { title: body.title.trim() }),
      ...(body.videoUrl?.trim() && { videoUrl: body.videoUrl.trim() }),
      thumbnailUrl: body.thumbnailUrl?.trim() || null,
      venue: body.venue?.trim() || null,
      date: body.date ? new Date(body.date) : null,
      ...(body.duration !== undefined && { duration: body.duration }),
    },
  });

  return NextResponse.json({ set });
}

// DELETE /api/dashboard/dj/sets/[id] — delete set (must own)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const existing = await db.dJSet.findUnique({ where: { id }, select: { djProfileId: true } });
  if (!existing || existing.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.dJSet.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
