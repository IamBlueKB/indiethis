import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseVideoUrl } from "@/lib/video-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await db.artistVideo.findMany({
    where:   { artistId: session.user.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ videos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, title } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate URL is a recognised video format
  const parsed = parseVideoUrl(url.trim());
  if (!parsed) {
    return NextResponse.json(
      { error: "URL must be a YouTube, Vimeo, or direct video file link" },
      { status: 400 },
    );
  }

  // Cap at 6 videos per artist
  const count = await db.artistVideo.count({ where: { artistId: session.user.id } });
  if (count >= 6) {
    return NextResponse.json({ error: "Maximum 6 videos allowed" }, { status: 400 });
  }

  const video = await db.artistVideo.create({
    data: {
      artistId:  session.user.id,
      url:       parsed.originalUrl,
      title:     title?.trim() || null,
      sortOrder: count, // append to end
    },
  });

  return NextResponse.json({ video }, { status: 201 });
}
