import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.artistPressItem.findMany({
    where:   { artistId: session.user.id },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, source: true, title: true, url: true, sortOrder: true },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { source, title, url } = await req.json();
  if (!source || !title || !url) return NextResponse.json({ error: "source, title, and url required" }, { status: 400 });

  const count = await db.artistPressItem.count({ where: { artistId: session.user.id } });

  const item = await db.artistPressItem.create({
    data: { artistId: session.user.id, source, title, url, sortOrder: count },
  });

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, source, title, url } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.artistPressItem.updateMany({
    where: { id, artistId: session.user.id },
    data:  {
      ...(source !== undefined && { source }),
      ...(title  !== undefined && { title }),
      ...(url    !== undefined && { url }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.artistPressItem.deleteMany({ where: { id, artistId: session.user.id } });

  return NextResponse.json({ ok: true });
}
