import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const video = await db.artistVideo.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      thumbnailUrl: body.thumbnailUrl ?? existing.thumbnailUrl,
      isPublished: body.isPublished ?? existing.isPublished,
      sortOrder: body.sortOrder ?? existing.sortOrder,
      category: body.category ?? existing.category,
    },
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
