import { NextResponse } from "next/server";
import { db }           from "@/lib/db";
import { calculateAverageFeatures } from "@/lib/audio-features";
import type { AudioFeatureScores }  from "@/lib/audio-features";

// GET /api/audio-features/studio/[slug]
// Returns averaged AudioFeatureScores for tracks recorded by artists linked to this studio.
// Public — no auth required.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const studio = await db.studio.findUnique({
    where:  { slug },
    select: { id: true, artists: { select: { artistId: true } } },
  });

  if (!studio) return NextResponse.json({ features: null, count: 0 });

  const artistIds = studio.artists.map(a => a.artistId);
  if (artistIds.length === 0) return NextResponse.json({ features: null, count: 0 });

  const records = await db.audioFeatures.findMany({
    where: { track: { artistId: { in: artistIds }, status: "PUBLISHED" } },
    select: {
      loudness: true, energy: true, danceability: true, acousticness: true,
      instrumentalness: true, speechiness: true, liveness: true, valence: true,
      genre: true, mood: true, isVocal: true,
    },
    take: 50,
  });

  if (records.length === 0) return NextResponse.json({ features: null, count: 0 });

  const averaged = calculateAverageFeatures(records as AudioFeatureScores[]);
  return NextResponse.json({ features: averaged, count: records.length });
}
