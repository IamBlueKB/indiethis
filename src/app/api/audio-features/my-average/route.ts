import { NextResponse } from "next/server";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";
import { calculateAverageFeatures } from "@/lib/audio-features";
import type { AudioFeatureScores }  from "@/lib/audio-features";

// GET /api/audio-features/my-average
// Returns averaged AudioFeatureScores across all of the logged-in user's analyzed tracks.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ features: null });
  }

  const records = await db.audioFeatures.findMany({
    where: { track: { artistId: session.user.id } },
    select: {
      loudness: true, energy: true, danceability: true, acousticness: true,
      instrumentalness: true, speechiness: true, liveness: true, valence: true,
      genre: true, mood: true, isVocal: true,
    },
  });

  if (records.length === 0) {
    return NextResponse.json({ features: null, count: 0 });
  }

  const featuresList = records as AudioFeatureScores[];
  const averaged = calculateAverageFeatures(featuresList);

  return NextResponse.json({ features: averaged, count: records.length });
}
