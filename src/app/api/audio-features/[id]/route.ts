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

  // Join Track Essentia fields so we can prefer ML data over math heuristics
  const record = await db.audioFeatures.findUnique({
    where:   { trackId: id },
    include: {
      track: {
        select: {
          essentiaGenres:       true,
          essentiaMoods:        true,
          essentiaDanceability: true,
          essentiaVoice:        true,
        },
      },
    },
  });

  if (!record) {
    return NextResponse.json({ features: null });
  }

  const track = record.track;

  // Prefer Essentia ML classifications over math-based heuristics.
  // Tracks without Essentia data fall back to the existing AudioFeatures values.

  const essentiaGenres = track?.essentiaGenres as { label: string; score: number }[] | null;
  const essentiaMoods  = track?.essentiaMoods  as { label: string; score: number }[] | null;

  const genre: string | null =
    essentiaGenres?.length ? essentiaGenres[0].label : (record.genre ?? null);

  const mood: string | null =
    essentiaMoods?.length ? essentiaMoods[0].label : (record.mood ?? null);

  const isVocal: boolean =
    track?.essentiaVoice
      ? track.essentiaVoice === "vocal"
      : record.isVocal;

  const danceability: number =
    track?.essentiaDanceability != null
      ? track.essentiaDanceability
      : record.danceability;

  return NextResponse.json({
    features: {
      loudness:         record.loudness,
      energy:           record.energy,
      danceability,
      acousticness:     record.acousticness,
      instrumentalness: record.instrumentalness,
      speechiness:      record.speechiness,
      liveness:         record.liveness,
      valence:          record.valence,
      genre,
      mood,
      isVocal,
    },
  });
}
