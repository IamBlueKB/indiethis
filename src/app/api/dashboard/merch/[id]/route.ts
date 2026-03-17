import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/dashboard/merch/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as {
    title?: string;
    description?: string;
    isActive?: boolean;
    artistMarkup?: number;
  };

  const updated = await db.merchProduct.updateMany({
    where: { id, artistId: session.user.id },
    data: {
      ...(body.title       !== undefined && { title:         body.title.trim() }),
      ...(body.description !== undefined && { description:   body.description }),
      ...(body.isActive    !== undefined && { isActive:      body.isActive }),
      ...(body.artistMarkup!== undefined && { artistMarkup:  body.artistMarkup }),
    },
  });

  return NextResponse.json({ updated: updated.count });
}

// DELETE /api/dashboard/merch/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.merchProduct.deleteMany({ where: { id, artistId: session.user.id } });
  return NextResponse.json({ deleted: true });
}
