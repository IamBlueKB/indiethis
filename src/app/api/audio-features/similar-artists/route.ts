import { NextResponse }          from "next/server";
import { db }                    from "@/lib/db";
import { calculateSimilarity }   from "@/lib/audio-similarity";
import { calculateAverageFeatures } from "@/lib/audio-features";
import type { AudioFeatureScores }  from "@/lib/audio-features";

// GET /api/audio-features/similar-artists?artistId=xxx&limit=8
// Public — no auth required.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artistId");
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  if (!artistId) {
    return NextResponse.json({ error: "artistId required" }, { status: 400 });
  }

  // Fetch target artist's analyzed tracks
  const targetTracks = await db.audioFeatures.findMany({
    where: { track: { artistId, status: "PUBLISHED" } },
    select: {
      loudness: true, energy: true, danceability: true, acousticness: true,
      instrumentalness: true, speechiness: true, liveness: true, valence: true,
      genre: true, mood: true, isVocal: true,
    },
  });

  if (targetTracks.length < 3) {
    return NextResponse.json({ similar: [] });
  }

  const targetAvg = calculateAverageFeatures(targetTracks as AudioFeatureScores[]);
  if (!targetAvg) return NextResponse.json({ similar: [] });

  // Fetch all other artists who have 3+ analyzed tracks
  const artistFeatureGroups = await db.audioFeatures.groupBy({
    by:      ["trackId"],
    where:   {
      track: {
        status:   "PUBLISHED",
        artistId: { not: artistId },
      },
    },
    _count: { trackId: true },
  });

  // Group by artistId to find artists with 3+ tracks
  // Re-query to get artist info + features per artist
  const artistsWithFeatures = await db.user.findMany({
    where: {
      id:        { not: artistId },
      tracks: {
        some: {
          status:        "PUBLISHED",
          audioFeatures: { isNot: null },
        },
      },
      artistSite: { isPublished: true },
      artistSlug: { not: null },
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
    take: 300, // cap for performance
  });

  // Filter to artists with 3+ analyzed tracks, compute avg, score
  const scored = artistsWithFeatures
    .map(artist => {
      const features = artist.tracks
        .map(t => t.audioFeatures)
        .filter(Boolean) as AudioFeatureScores[];

      if (features.length < 3) return null;

      const avg = calculateAverageFeatures(features);
      if (!avg) return null;

      const similarity = calculateSimilarity(targetAvg, avg);

      return {
        id:         artist.id,
        name:       artist.artistName ?? artist.name,
        slug:       artist.artistSlug,
        avatarUrl:  artist.photo,
        genre:      avg.genre ?? artist.genres[0] ?? null,
        trackCount: features.length,
        similarity,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null && a.similarity > 0.6)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  // Suppress the artistFeatureGroups variable (used for awareness only)
  void artistFeatureGroups;

  return NextResponse.json({ similar: scored });
}
