import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

// POST /api/beats/previews — producer creates a beat preview share
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { trackId, artistId, expiresInDays, isDownloadable } = body as {
    trackId: string;
    artistId?: string;
    expiresInDays?: number;
    isDownloadable?: boolean;
  };

  if (!trackId) {
    return NextResponse.json({ error: "Track is required." }, { status: 400 });
  }

  // Verify track belongs to producer
  const track = await db.track.findFirst({
    where: { id: trackId, artistId: session.user.id },
  });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  const days = Math.min(Math.max(expiresInDays ?? 7, 1), 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const preview = await db.beatPreview.create({
    data: {
      producerId: session.user.id,
      artistId: artistId || null,
      trackId,
      expiresAt,
      isDownloadable: isDownloadable ?? false,
    },
  });

  // Notify the artist if specified
  if (artistId) {
    await createNotification({
      userId: artistId,
      type: "BEAT_PREVIEW",
      title: "New Beat Preview",
      message: `${session.user.name ?? "A producer"} shared a beat preview with you.`,
      link: `/dashboard/beats/preview/${preview.id}`,
    });
  }

  return NextResponse.json({ preview }, { status: 201 });
}

// GET /api/beats/previews — producer sees all their sent previews
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const previews = await db.beatPreview.findMany({
    where: { producerId: session.user.id },
    include: { track: { select: { title: true, coverArtUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ previews });
}
