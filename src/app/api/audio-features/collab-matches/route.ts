import { NextResponse }             from "next/server";
import { auth }                     from "@/auth";
import { db }                       from "@/lib/db";
import { calculateAverageFeatures } from "@/lib/audio-features";
import {
  calculateComplementarity,
  generateCollabReason,
  getTopStrengths,
}                                   from "@/lib/audio-similarity";
import type { AudioFeatureScores }  from "@/lib/audio-features";

// GET /api/audio-features/collab-matches?limit=8
// Auth required — returns artists who complement the current user's sound.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  // Fetch current user's analyzed tracks
  const myTracks = await db.audioFeatures.findMany({
    where: { track: { artistId: userId, status: "PUBLISHED" } },
    select: {
      loudness: true, energy: true, danceability: true, acousticness: true,
      instrumentalness: true, speechiness: true, liveness: true, valence: true,
      genre: true, mood: true, isVocal: true,
    },
  });

  if (myTracks.length < 3) {
    return NextResponse.json({ matches: [] });
  }

  const myAvg = calculateAverageFeatures(myTracks as AudioFeatureScores[]);
  if (!myAvg) return NextResponse.json({ matches: [] });

  // Fetch all other artists with 3+ published analyzed tracks + published site
  const candidates = await db.user.findMany({
    where: {
      id:         { not: userId },
      artistSite: { isPublished: true },
      artistSlug: { not: null },
      tracks: {
        some: {
          status:        "PUBLISHED",
          audioFeatures: { isNot: null },
        },
      },
    },
    select: {
      id:         true,
      name:       true,
      artistName: true,
      artistSlug: true,
      photo:      true,
      genres:     true,
      tracks: {
        where:  { status: "PUBLISHED", audioFeatures: { isNot: null } },
        select: {
          audioFeatures: {
            select: {
              loudness: true, energy: true, danceability: true, acousticness: true,
              instrumentalness: true, speechiness: true, liveness: true, valence: true,
              genre: true, mood: true, isVocal: true,
            },
          },
        },
        take: 20,
      },
    },
    take: 300,
  });

  const scored = candidates
    .map(artist => {
      const features = artist.tracks
        .map(t => t.audioFeatures)
        .filter(Boolean) as AudioFeatureScores[];

      if (features.length < 3) return null;

      const avg = calculateAverageFeatures(features);
      if (!avg) return null;

      const score  = calculateComplementarity(myAvg, avg);
      const reason = generateCollabReason(myAvg, avg);
      const strengths = getTopStrengths(avg, 2);

      return {
        id:         artist.id,
        name:       artist.artistName ?? artist.name,
        slug:       artist.artistSlug,
        avatarUrl:  artist.photo,
        genre:      avg.genre ?? artist.genres[0] ?? null,
        trackCount: features.length,
        score,
        reason,
        strengths,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null && a.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({ matches: scored });
}
