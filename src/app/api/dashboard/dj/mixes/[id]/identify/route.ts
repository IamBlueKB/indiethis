import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { identifyTracksInMix } from "@/lib/acrcloud";

async function getOwnedMix(mixId: string, userId: string) {
  const djProfile = await db.dJProfile.findUnique({ where: { userId } });
  if (!djProfile) return null;
  return db.dJMix.findFirst({ where: { id: mixId, djProfileId: djProfile.id } });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mix = await getOwnedMix(id, session.user.id);
  if (!mix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete existing auto-identified tracks (those without manual notes — all for now)
  await db.dJMixTrack.deleteMany({ where: { djMixId: id } });

  try {
    const results = await identifyTracksInMix(mix.audioUrl);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const indieTrack = await db.track.findFirst({
        where: {
          AND: [
            { title: { contains: r.title, mode: "insensitive" } },
            { artist: { name: { contains: r.artist, mode: "insensitive" } } },
          ],
        },
      });

      await db.dJMixTrack.create({
        data: {
          djMixId:   id,
          position:  i + 1,
          startTime: Math.round(r.startTimeSeconds),
          title:     r.title,
          artist:    r.artist,
          trackId:   indieTrack?.id ?? null,
        },
      });
    }

    const tracklist = await db.dJMixTrack.findMany({
      where: { djMixId: id },
      include: { track: { include: { artist: true } } },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({ tracklist, identified: results.length });
  } catch (e) {
    return NextResponse.json(
      { error: `Identification failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
