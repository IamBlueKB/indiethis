import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collaborators = await db.artistCollaborator.findMany({
    where:   { artistId: session.user.id },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, name: true, photoUrl: true, artistSlug: true, sortOrder: true },
  });

  return NextResponse.json({ collaborators });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, photoUrl, artistSlug } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const count = await db.artistCollaborator.count({ where: { artistId: session.user.id } });

  const item = await db.artistCollaborator.create({
    data: {
      artistId: session.user.id,
      name,
      photoUrl:   photoUrl   || null,
      artistSlug: artistSlug || null,
      sortOrder:  count,
    },
  });

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, photoUrl, artistSlug } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.artistCollaborator.updateMany({
    where: { id, artistId: session.user.id },
    data:  {
      ...(name       !== undefined && { name }),
      ...(photoUrl   !== undefined && { photoUrl: photoUrl || null }),
      ...(artistSlug !== undefined && { artistSlug: artistSlug || null }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.artistCollaborator.deleteMany({ where: { id, artistId: session.user.id } });

  return NextResponse.json({ ok: true });
}
