import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    title?: string;
    status?: "DRAFT" | "PUBLISHED";
    price?: number | null;
    projectName?: string;
    description?: string;
    coverArtUrl?: string | null;
  };

  const track = await db.track.updateMany({
    where: { id, artistId: session.user.id },
    data: {
      ...(body.title       !== undefined && { title:       body.title.trim() }),
      ...(body.status      !== undefined && { status:      body.status }),
      ...(body.price       !== undefined && { price:       body.price }),
      ...(body.projectName !== undefined && { projectName: body.projectName }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.coverArtUrl !== undefined && { coverArtUrl: body.coverArtUrl }),
    },
  });

  return NextResponse.json({ updated: track.count });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db.track.deleteMany({ where: { id, artistId: session.user.id } });

  return NextResponse.json({ deleted: true });
}
