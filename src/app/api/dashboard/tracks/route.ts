import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fingerprintTrack } from "@/lib/fingerprint";
import { NextRequest, NextResponse } from "next/server";
import { moderateContent } from "@/lib/agents/content-moderation";

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

  // Fingerprint the track — fire and forget
  if (track.fileUrl) {
    fingerprintTrack(track.id, track.fileUrl).catch(() => {});
  }

  // Content moderation scan — fire and forget
  void moderateContent(
    session.user.id,
    "TRACK",
    track.id,
    [track.title, track.description].filter(Boolean).join(" "),
  ).catch(() => {});

  // Record first content upload timestamp — fire and forget
  void db.user.updateMany({
    where: { id: session.user.id, firstContentAt: null },
    data:  { firstContentAt: new Date() },
  }).catch(() => { /* silent — non-critical */ });

  // Auto-create ProducerProfile on first beat upload — fire and forget
  void db.producerProfile.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  }).catch(() => { /* silent — non-critical */ });

  // Full audio analysis (BPM/key/energy + EffNet genre/mood) — routed through
  // isolated trigger so node-web-audio-api and onnxruntime-web are bundled only
  // in that function, not here. Fire and forget.
  if (track.fileUrl) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456";
    void fetch(`${baseUrl}/api/internal/trigger/audio-features`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "authorization": `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ trackId: track.id, audioUrl: track.fileUrl }),
    }).catch((err) => console.error("[tracks] audio-features trigger failed:", err));
  }

  return NextResponse.json({ track }, { status: 201 });
}
