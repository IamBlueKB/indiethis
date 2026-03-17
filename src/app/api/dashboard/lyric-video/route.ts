import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [jobs, subscription] = await Promise.all([
    db.aIGeneration.findMany({
      where: { artistId: session.user.id, type: "LYRIC_VIDEO" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.subscription.findUnique({
      where: { userId: session.user.id },
      select: {
        tier: true,
        lyricVideoCreditsUsed: true,
        lyricVideoCreditsLimit: true,
      },
    }),
  ]);

  return NextResponse.json({ jobs, subscription });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    songTitle?: string;
    lyrics?: string;
    fontStyle?: string;
    background?: string;
    accentColor?: string;
    aspectRatio?: string;
  };

  if (!body.lyrics?.trim()) {
    return NextResponse.json({ error: "Lyrics are required." }, { status: 400 });
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: session.user.id },
    select: { lyricVideoCreditsUsed: true, lyricVideoCreditsLimit: true },
  });

  if (!subscription || subscription.lyricVideoCreditsLimit === 0) {
    return NextResponse.json({ error: "Lyric video generation requires a Push or Reign plan." }, { status: 403 });
  }

  if (subscription.lyricVideoCreditsUsed >= subscription.lyricVideoCreditsLimit) {
    return NextResponse.json({ error: "No lyric video credits remaining this month." }, { status: 402 });
  }

  // Create job + increment usage atomically
  const [job] = await db.$transaction([
    db.aIGeneration.create({
      data: {
        artistId: session.user.id,
        type: "LYRIC_VIDEO",
        status: "QUEUED",
        inputData: {
          songTitle: body.songTitle ?? "Untitled",
          lyrics: body.lyrics.trim(),
          fontStyle: body.fontStyle ?? "Minimal",
          background: body.background ?? "Pure Black",
          accentColor: body.accentColor ?? "White",
          aspectRatio: body.aspectRatio ?? "16:9 (YouTube)",
        },
      },
    }),
    db.subscription.update({
      where: { userId: session.user.id },
      data: { lyricVideoCreditsUsed: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ job }, { status: 201 });
}
