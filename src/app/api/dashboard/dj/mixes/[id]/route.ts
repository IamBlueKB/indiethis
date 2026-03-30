import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedMix(mixId: string, userId: string) {
  const djProfile = await db.dJProfile.findUnique({ where: { userId } });
  if (!djProfile) return null;
  return db.dJMix.findFirst({
    where: { id: mixId, djProfileId: djProfile.id },
  });
}

export async function PATCH(
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
    title?: string;
    coverArtUrl?: string;
    duration?: number;
    description?: string;
  };

  const updated = await db.dJMix.update({
    where: { id },
    data: {
      title:       body.title?.trim()       ?? mix.title,
      coverArtUrl: body.coverArtUrl?.trim() ?? mix.coverArtUrl,
      duration:    body.duration            ?? mix.duration,
      description: body.description?.trim() ?? mix.description,
    },
  });

  return NextResponse.json({ mix: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mix = await getOwnedMix(id, session.user.id);
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.dJMix.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
