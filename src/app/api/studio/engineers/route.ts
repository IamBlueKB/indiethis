import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getStudio(userId: string) {
  return db.studio.findFirst({ where: { ownerId: userId }, select: { id: true } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const engineers = await db.studioEngineer.findMany({ where: { studioId: studio.id }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ engineers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const body = await req.json();
  const { name, role, photoUrl, specialties, bio, artistSlug, sortOrder } = body;
  if (!name || !role) return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  const engineer = await db.studioEngineer.create({ data: { studioId: studio.id, name, role, photoUrl: photoUrl ?? null, specialties: specialties ?? [], bio: bio ?? null, artistSlug: artistSlug ?? null, sortOrder: sortOrder ?? 0 } });
  return NextResponse.json({ engineer }, { status: 201 });
}
