import { NextResponse } from "next/server";
import { db }           from "@/lib/db";
import { calculateSimilarity } from "@/lib/audio-similarity";
import type { AudioFeatureScores } from "@/lib/audio-features";

// GET /api/audio-features/similar-tracks?trackId=xxx&limit=6
// Public — no auth required.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get("trackId");
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 20);

  if (!trackId) {
    return NextResponse.json({ error: "trackId required" }, { status: 400 });
  }

  // Fetch the source track + its features
  const source = await db.track.findUnique({
    where:  { id: trackId },
    select: {
      id:           true,
      artistId:     true,
      audioFeatures: {
        select: {
          loudness: true, energy: true, danceability: true, acousticness: true,
          instrumentalness: true, speechiness: true, liveness: true, valence: true,
          genre: true, mood: true, isVocal: true,
        },
      },
    },
  });

  if (!source?.audioFeatures) {
    return NextResponse.json({ similar: [] });
  }

  const sourceFeatures = source.audioFeatures as AudioFeatureScores;

  // Fetch all other tracks that have AudioFeatures
  const candidates = await db.track.findMany({
    where: {
      id:            { not: trackId },
      status:        "PUBLISHED",
      audioFeatures: { isNot: null },
    },
    select: {
      id:          true,
      title:       true,
      coverArtUrl: true,
      artist: {
        select: { id: true, name: true, artistName: true, artistSlug: true },
      },
      audioFeatures: {
        select: {
          loudness: true, energy: true, danceability: true, acousticness: true,
          instrumentalness: true, speechiness: true, liveness: true, valence: true,
          genre: true, mood: true, isVocal: true,
        },
      },
    },
    take: 500, // cap to avoid huge payloads
  });

  // Score + sort
  const scored = candidates
    .map(track => ({
      id:         track.id,
      title:      track.title,
      artistName: track.artist.artistName ?? track.artist.name,
      artistSlug: track.artist.artistSlug,
      artworkUrl: track.coverArtUrl,
      similarity: calculateSimilarity(sourceFeatures, track.audioFeatures as AudioFeatureScores),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return NextResponse.json({ similar: scored });
}
