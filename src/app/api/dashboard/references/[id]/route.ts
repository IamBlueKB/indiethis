import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { projectTag, folder } = await req.json();

  const ref = await db.youtubeReference.findUnique({ where: { id } });
  if (!ref || ref.artistId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.youtubeReference.update({
    where: { id },
    data: { projectTag: projectTag ?? ref.projectTag, folder: folder ?? ref.folder },
  });

  return NextResponse.json({ reference: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ref = await db.youtubeReference.findUnique({ where: { id } });
  if (!ref || ref.artistId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.youtubeReference.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
