import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const references = await db.youtubeReference.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ references });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, videoId, title, thumbnailUrl, authorName, projectTag, folder } = await req.json();
  if (!url || !videoId || !title) {
    return NextResponse.json({ error: "url, videoId, and title are required" }, { status: 400 });
  }

  const reference = await db.youtubeReference.create({
    data: {
      artistId: session.user.id,
      url,
      videoId,
      title,
      thumbnailUrl,
      authorName,
      projectTag: projectTag || null,
      folder: folder || null,
    },
  });

  return NextResponse.json({ reference }, { status: 201 });
}
