import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photos = await db.artistPhoto.findMany({
    where:   { artistId: session.user.id },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, imageUrl: true, caption: true, sortOrder: true },
  });

  return NextResponse.json({ photos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageUrl, caption } = await req.json();
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  const count = await db.artistPhoto.count({ where: { artistId: session.user.id } });
  if (count >= 9) return NextResponse.json({ error: "Maximum 9 photos allowed" }, { status: 400 });

  const photo = await db.artistPhoto.create({
    data: { artistId: session.user.id, imageUrl, caption: caption || null, sortOrder: count },
  });

  return NextResponse.json({ photo });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.artistPhoto.deleteMany({ where: { id, artistId: session.user.id } });

  return NextResponse.json({ ok: true });
}
