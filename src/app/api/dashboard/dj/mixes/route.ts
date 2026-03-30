import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { identifyTracksInMix } from "@/lib/acrcloud";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!djProfile)
    return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const mixes = await db.dJMix.findMany({
    where: { djProfileId: djProfile.id },
    include: { _count: { select: { tracklist: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ mixes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!djProfile)
    return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const body = (await req.json()) as {
    title: string;
    audioUrl: string;
    coverArtUrl?: string;
    duration?: number;
    description?: string;
  };

  if (!body.title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!body.audioUrl?.trim())
    return NextResponse.json({ error: "Audio URL is required" }, { status: 400 });

  const mix = await db.dJMix.create({
    data: {
      djProfileId: djProfile.id,
      title:       body.title.trim(),
      audioUrl:    body.audioUrl.trim(),
      coverArtUrl: body.coverArtUrl?.trim() ?? null,
      duration:    body.duration ?? null,
      description: body.description?.trim() ?? null,
    },
  });

  // Fire-and-forget background identification
  void runIdentification(mix.id, body.audioUrl);

  return NextResponse.json({ mixId: mix.id });
}

async function runIdentification(mixId: string, audioUrl: string) {
  try {
    console.log(`[mixes] starting ACRCloud identification for mix ${mixId}`);
    const results = await identifyTracksInMix(audioUrl);
    console.log(`[mixes] identified ${results.length} tracks in mix ${mixId}`);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      // Try to find a matching IndieThis track
      const indieTrack = await db.track.findFirst({
        where: {
          AND: [
            { title: { contains: r.title, mode: "insensitive" } },
            {
              artist: {
                name: { contains: r.artist, mode: "insensitive" },
              },
            },
          ],
        },
      });

      await db.dJMixTrack.create({
        data: {
          djMixId:   mixId,
          position:  i + 1,
          startTime: Math.round(r.startTimeSeconds),
          title:     r.title,
          artist:    r.artist,
          trackId:   indieTrack?.id ?? null,
        },
      });
    }
  } catch (e) {
    console.error(`[mixes] ACRCloud identification failed for mix ${mixId}:`, e);
  }
}
