import { NextResponse } from "next/server";
import { db }           from "@/lib/db";

// GET /api/audio-features/[id]
// [id] is a trackId
// Public — no auth required (used on public artist pages, explore, marketplace)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const record = await db.audioFeatures.findUnique({
    where: { trackId: id },
  });

  if (!record) {
    return NextResponse.json({ features: null });
  }

  return NextResponse.json({
    features: {
      loudness:         record.loudness,
      energy:           record.energy,
      danceability:     record.danceability,
      acousticness:     record.acousticness,
      instrumentalness: record.instrumentalness,
      speechiness:      record.speechiness,
      liveness:         record.liveness,
      valence:          record.valence,
      genre:            record.genre,
      mood:             record.mood,
      isVocal:          record.isVocal,
    },
  });
}
