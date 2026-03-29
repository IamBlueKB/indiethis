import { NextResponse }            from "next/server";
import { db }                      from "@/lib/db";
import { calculateSimilarity }     from "@/lib/audio-similarity";
import type { AudioFeatureScores } from "@/lib/audio-features";

// GET /api/explore/radar-filter
// Query params:
//   features  — JSON: {loudness,energy,danceability,acousticness,instrumentalness,speechiness,liveness,valence}
//   type      — "track" | "beat" | "both"  (default "both")
//   genre     — optional genre string
//   mood      — optional mood string
//   isVocal   — optional "true" | "false"
//   limit     — default 20, max 40
//   offset    — default 0

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ── Parse feature profile ──────────────────────────────────────────────────
  let profile: AudioFeatureScores | null = null;
  try {
    profile = JSON.parse(searchParams.get("features") ?? "null");
  } catch {
    return NextResponse.json({ error: "Invalid features JSON" }, { status: 400 });
  }
  if (!profile) {
    return NextResponse.json({ error: "features required" }, { status: 400 });
  }

  const type    = (searchParams.get("type") ?? "both") as "track" | "beat" | "both";
  const genre   = searchParams.get("genre");
  const mood    = searchParams.get("mood");
  const isVocalParam = searchParams.get("isVocal");
  const isVocal = isVocalParam === null ? undefined : isVocalParam === "true";
  const limit   = Math.min(parseInt(searchParams.get("limit")  ?? "20", 10), 40);
  const offset  = parseInt(searchParams.get("offset") ?? "0", 10);

  // ── Categorical where clause for AudioFeatures ─────────────────────────────
  const featuresWhere: Record<string, unknown> = {};
  if (genre)              featuresWhere.genre   = genre;
  if (mood)               featuresWhere.mood    = mood;
  if (isVocal !== undefined) featuresWhere.isVocal = isVocal;

  // ── Type filter: beats have BeatLeaseSettings, tracks don't ───────────────
  const beatFilter =
    type === "track" ? { none: {} } :
    type === "beat"  ? { some: {} } :
    undefined;

  // ── Fetch tracks with AudioFeatures ───────────────────────────────────────
  const rows = await db.track.findMany({
    where: {
      status:        "PUBLISHED",
      audioFeatures: { isNot: null, ...featuresWhere },
      ...(beatFilter !== undefined && { beatLeaseSettings: beatFilter }),
    },
    select: {
      id:          true,
      title:       true,
      coverArtUrl: true,
      fileUrl:     true,
      bpm:         true,
      musicalKey:  true,
      artist: {
        select: {
          id:         true,
          name:       true,
          artistName: true,
          artistSlug: true,
        },
      },
      audioFeatures: {
        select: {
          loudness:         true,
          energy:           true,
          danceability:     true,
          acousticness:     true,
          instrumentalness: true,
          speechiness:      true,
          liveness:         true,
          valence:          true,
          genre:            true,
          mood:             true,
          isVocal:          true,
        },
      },
      beatLeaseSettings: { select: { id: true } },
    },
    take: 500, // score in-memory, then paginate
  });

  // ── Score and sort ─────────────────────────────────────────────────────────
  const scored = rows
    .map(row => {
      if (!row.audioFeatures) return null;
      const similarity = calculateSimilarity(profile!, row.audioFeatures as AudioFeatureScores);
      return {
        id:         row.id,
        title:      row.title,
        artistName: row.artist.artistName ?? row.artist.name,
        artistSlug: row.artist.artistSlug,
        artworkUrl: row.coverArtUrl,
        fileUrl:    row.fileUrl,
        type:       row.beatLeaseSettings.length > 0 ? "beat" : "track",
        bpm:        row.bpm,
        key:        row.musicalKey,
        genre:      row.audioFeatures.genre,
        mood:       row.audioFeatures.mood,
        features:   row.audioFeatures as AudioFeatureScores,
        similarity,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.similarity >= 0.3)
    .sort((a, b) => b.similarity - a.similarity);

  const total   = scored.length;
  const page    = scored.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return NextResponse.json({ results: page, total, hasMore });
}
