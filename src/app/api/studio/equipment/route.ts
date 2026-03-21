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
  const equipment = await db.studioEquipment.findMany({ where: { studioId: studio.id }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ equipment });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const body = await req.json();
  const { category, name, sortOrder } = body;
  if (!name || !category) return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  const item = await db.studioEquipment.create({ data: { studioId: studio.id, category, name, sortOrder: sortOrder ?? 0 } });
  return NextResponse.json({ item }, { status: 201 });
}
