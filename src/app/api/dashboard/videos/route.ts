import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await db.artistVideo.findMany({
    where: { artistId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ videos });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, videoUrl, thumbnailUrl, embedUrl, type, category } = body;

  if (!title || !type) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const count = await db.artistVideo.count({ where: { artistId: session.user.id } });
  if (count >= 20) return NextResponse.json({ error: "Maximum 20 videos" }, { status: 400 });

  const video = await db.artistVideo.create({
    data: {
      artistId: session.user.id,
      title,
      description: description || null,
      videoUrl: videoUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      embedUrl: embedUrl || null,
      type,
      category: category || null,
      sortOrder: count,
    },
  });

  return NextResponse.json({ video }, { status: 201 });
}
