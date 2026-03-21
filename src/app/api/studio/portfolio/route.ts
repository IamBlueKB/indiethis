import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getStudio(userId: string) {
  return db.studio.findFirst({ where: { ownerId: userId }, select: { id: true } });
}

// GET /api/studio/portfolio
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const tracks = await db.studioPortfolioTrack.findMany({
    where: { studioId: studio.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ tracks });
}

// POST /api/studio/portfolio
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studio = await getStudio(session.user.id);
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();
  const { title, artistName, audioUrl, coverUrl, description, artistSlug, sortOrder } = body as {
    title: string; artistName: string; audioUrl: string;
    coverUrl?: string; description?: string; artistSlug?: string; sortOrder?: number;
  };

  if (!title || !artistName || !audioUrl) {
    return NextResponse.json({ error: "title, artistName, and audioUrl are required" }, { status: 400 });
  }

  const track = await db.studioPortfolioTrack.create({
    data: {
      studioId: studio.id,
      title,
      artistName,
      audioUrl,
      coverUrl: coverUrl ?? null,
      description: description ?? null,
      artistSlug: artistSlug ?? null,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json({ track }, { status: 201 });
}
