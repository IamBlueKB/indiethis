import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db }              from "@/lib/db";
import { detectAudioFeatures } from "@/lib/audio-analysis";

const BATCH_SIZE = 50;

// GET /api/admin/audio-features/backfill
// Returns counts of tracks with/without AudioFeatures.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [total, analyzed] = await Promise.all([
    db.track.count(),
    db.track.count({ where: { audioFeatures: { isNot: null } } }),
  ]);

  return NextResponse.json({
    total,
    analyzed,
    remaining: total - analyzed,
  });
}

// POST /api/admin/audio-features/backfill
// Body: { offset?: number }
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let offset = 0;
  try {
    const body = await req.json() as { offset?: number };
    if (typeof body.offset === "number" && body.offset >= 0) {
      offset = body.offset;
    }
  } catch {
    // body is optional — default offset=0
  }

  // Fetch 50 tracks without AudioFeatures
  const tracks = await db.track.findMany({
    where: { audioFeatures: null },
    take:   BATCH_SIZE,
    skip:   offset,
    select: { id: true, fileUrl: true },
  });

  const total = await db.track.count({
    where: { audioFeatures: null },
  });

  let processed = 0;

  for (const track of tracks) {
    const fileUrl = track.fileUrl;
    try {
      const { bpm, musicalKey, energy } = await detectAudioFeatures(fileUrl);

      const energyVal = energy     ?? 0.5;
      const bpmVal    = bpm        ?? null;
      const keyVal    = musicalKey ?? null;

      await db.$transaction([
        db.audioFeatures.upsert({
          where:  { trackId: track.id },
          create: {
            trackId:          track.id,
            loudness:         0.5,
            energy:           energyVal,
            danceability:     0.5,
            acousticness:     0.5,
            instrumentalness: 0.5,
            speechiness:      0.5,
            liveness:         0.5,
            valence:          0.5,
            genre:            null,
            mood:             null,
            isVocal:          false,
            analyzedAt:       new Date(),
          },
          update: {
            energy:     energyVal,
            analyzedAt: new Date(),
          },
        }),
        db.track.update({
          where: { id: track.id },
          data: {
            ...(bpmVal !== null && { bpm:        bpmVal }),
            ...(keyVal !== null && { musicalKey: keyVal }),
          },
        }),
      ]);

      processed++;
    } catch {
      // Skip failed tracks — continue with the rest
    }
  }

  const remaining = Math.max(0, total - processed);
  const hasMore   = remaining > 0;
  const nextOffset = offset + BATCH_SIZE;

  return NextResponse.json({
    processed,
    total,
    hasMore,
    nextOffset,
  });
}
