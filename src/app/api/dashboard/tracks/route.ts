import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { detectAudioFeatures } from "@/lib/audio-analysis";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tracks = await db.track.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tracks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    title?: string;
    fileUrl?: string;
    coverArtUrl?: string;
    price?: number;
    status?: "DRAFT" | "PUBLISHED";
    projectName?: string;
    description?: string;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!body.fileUrl?.trim()) return NextResponse.json({ error: "File URL is required." }, { status: 400 });

  const track = await db.track.create({
    data: {
      artistId: session.user.id,
      title: body.title.trim(),
      fileUrl: body.fileUrl.trim(),
      coverArtUrl: body.coverArtUrl ?? null,
      price: body.price ?? null,
      status: body.status ?? "DRAFT",
      projectName: body.projectName?.trim() ?? null,
      description: body.description?.trim() ?? null,
    },
  });

  // Auto-create ProducerProfile on first beat upload — fire and forget
  void db.producerProfile.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  }).catch(() => { /* silent — non-critical */ });

  // Kick off audio analysis in the background — don't block the response
  const fileUrl = body.fileUrl.trim();
  const trackId = track.id;
  void detectAudioFeatures(fileUrl).then(({ bpm, musicalKey }) => {
    if (bpm !== null || musicalKey !== null) {
      return db.track.update({
        where: { id: trackId },
        data: { bpm, musicalKey },
      });
    }
  }).catch(() => { /* silent — analysis is best-effort */ });

  return NextResponse.json({ track }, { status: 201 });
}
