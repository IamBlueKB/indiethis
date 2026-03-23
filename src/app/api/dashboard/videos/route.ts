import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const VIDEO_SELECT = {
  id:             true,
  title:          true,
  description:    true,
  videoUrl:       true,
  thumbnailUrl:   true,
  embedUrl:       true,
  type:           true,
  category:       true,
  duration:       true,
  sortOrder:      true,
  isPublished:    true,
  isYoutubeSynced: true,
  linkedTrackId:  true,
  linkedBeatId:   true,
  linkedMerchId:  true,
  createdAt:      true,
  linkedTrack: { select: { id: true, title: true, coverArtUrl: true } },
  linkedBeat:  { select: { id: true, title: true, coverArtUrl: true } },
  linkedMerch: { select: { id: true, title: true, imageUrl: true  } },
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const videos = await db.artistVideo.findMany({
    where:   { artistId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select:  VIDEO_SELECT,
  });

  return NextResponse.json({ videos });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, videoUrl, thumbnailUrl, embedUrl, type, category, isYoutubeSynced } = body;

  if (!title || !type) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const count = await db.artistVideo.count({ where: { artistId: session.user.id } });
  if (count >= 20) return NextResponse.json({ error: "Maximum 20 videos" }, { status: 400 });

  const video = await db.artistVideo.create({
    data: {
      artistId:       session.user.id,
      title,
      description:    description    || null,
      videoUrl:       videoUrl       || null,
      thumbnailUrl:   thumbnailUrl   || null,
      embedUrl:       embedUrl       || null,
      type,
      category:       category       || null,
      isYoutubeSynced: !!isYoutubeSynced,
      sortOrder:      count,
    },
    select: VIDEO_SELECT,
  });

  return NextResponse.json({ video }, { status: 201 });
}
