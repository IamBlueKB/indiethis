import { NextResponse } from "next/server";
import { auth }         from "@/lib/auth";
import { db }           from "@/lib/db";

// POST /api/audio-features/analyze
// Body: { trackId: string, features: AudioFeatureScores, bpm?: number, musicalKey?: string }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    trackId: string;
    features: {
      loudness:         number;
      energy:           number;
      danceability:     number;
      acousticness:     number;
      instrumentalness: number;
      speechiness:      number;
      liveness:         number;
      valence:          number;
      genre:            string | null;
      mood:             string | null;
      isVocal:          boolean;
    };
    bpm?:        number | null;
    musicalKey?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trackId, features, bpm, musicalKey } = body;
  if (!trackId || !features) {
    return NextResponse.json({ error: "Missing trackId or features" }, { status: 400 });
  }

  // Verify the track belongs to the requesting user
  const track = await db.track.findFirst({
    where: { id: trackId, artistId: session.user.id },
    select: { id: true },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const hasBpm        = bpm        !== undefined && bpm        !== null;
  const hasMusicalKey = musicalKey !== undefined && musicalKey !== null;
  const hasTrackData  = hasBpm || hasMusicalKey;

  // Upsert AudioFeatures + optionally update Track.bpm/musicalKey in one transaction
  const audioFeaturesUpsert = db.audioFeatures.upsert({
    where:  { trackId },
    create: {
      trackId,
      loudness:         features.loudness,
      energy:           features.energy,
      danceability:     features.danceability,
      acousticness:     features.acousticness,
      instrumentalness: features.instrumentalness,
      speechiness:      features.speechiness,
      liveness:         features.liveness,
      valence:          features.valence,
      genre:            features.genre ?? null,
      mood:             features.mood  ?? null,
      isVocal:          features.isVocal,
      analyzedAt:       new Date(),
    },
    update: {
      loudness:         features.loudness,
      energy:           features.energy,
      danceability:     features.danceability,
      acousticness:     features.acousticness,
      instrumentalness: features.instrumentalness,
      speechiness:      features.speechiness,
      liveness:         features.liveness,
      valence:          features.valence,
      genre:            features.genre ?? null,
      mood:             features.mood  ?? null,
      isVocal:          features.isVocal,
      analyzedAt:       new Date(),
    },
  });

  let record;

  if (hasTrackData) {
    const trackUpdate = db.track.update({
      where: { id: trackId },
      data: {
        ...(hasBpm        && { bpm }),
        ...(hasMusicalKey && { musicalKey }),
      },
    });

    const [af] = await db.$transaction([audioFeaturesUpsert, trackUpdate]);
    record = af;
  } else {
    record = await audioFeaturesUpsert;
  }

  return NextResponse.json({ ok: true, id: record.id });
}
