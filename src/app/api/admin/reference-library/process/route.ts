/**
 * POST /api/admin/reference-library/process
 *
 * Body: { tracks: [{ url, genre, subgenre?, sourceQuality, trackName?, artistName? }] }
 *
 * For each track:
 *   1. Run analyze-reference via Cog (Demucs + analysis pipeline).
 *   2. Insert ReferenceProfile row with separation/source weights.
 *   3. Set qualityGatePassed = true if separation_confidence >= 0.6.
 *   4. After all tracks insert, recompute affected genre aggregates.
 *
 * Streams JSON-lines progress so the admin UI can show "Processing 12 of 50..."
 *
 * PLATFORM_ADMIN only.
 */

import { NextRequest } from "next/server";
import { db as prisma } from "@/lib/db";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";
import { analyzeReferenceTrack, SOURCE_WEIGHTS, type SourceQuality } from "@/lib/reference-library/engine";
import { recomputeGenreTarget } from "@/lib/reference-library/aggregate";

export const maxDuration = 800; // up to ~13 min per batch

interface TrackInput {
  url:           string;
  genre:         string;
  subgenre?:     string;
  sourceQuality: SourceQuality;
  trackName?:    string;
  artistName?:   string;
}

export async function POST(req: NextRequest) {
  const admin = await assertReferenceAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const body = (await req.json()) as { tracks?: TrackInput[] };
  const tracks = body.tracks ?? [];
  if (tracks.length === 0) {
    return new Response(JSON.stringify({ error: "No tracks provided" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      const touchedGenres = new Set<string>();
      let ok = 0, fail = 0;

      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        send({ type: "progress", index: i, total: tracks.length, track: t.trackName ?? t.url });
        try {
          const profile = await analyzeReferenceTrack({
            audioUrl:      t.url,
            genre:         t.genre,
            sourceQuality: t.sourceQuality,
          });
          const sqWeight = SOURCE_WEIGHTS[t.sourceQuality] ?? 0.6;
          await prisma.referenceProfile.create({
            data: {
              source:                "commercial",
              sourceQuality:         t.sourceQuality,
              sourceQualityWeight:   sqWeight,
              separationConfidence:  profile.separation_confidence,
              separationWeight:      profile.separation_weight,
              genre:                 t.genre,
              subgenre:              t.subgenre ?? null,
              trackName:             t.trackName ?? null,
              artistName:            t.artistName ?? null,
              fingerprintHash:       profile.fingerprint_hash ?? null,
              profileData:           profile as any,
              qualityGatePassed:     profile.separation_confidence >= 0.6,
              weight:                1.0,
            },
          });
          touchedGenres.add(t.genre);
          ok++;
          send({ type: "track_ok", index: i, genre: t.genre, separation: profile.separation_confidence });
        } catch (err) {
          fail++;
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: "track_failed", index: i, error: msg.slice(0, 300) });
        }
      }

      // Recompute aggregates for touched genres.
      for (const g of touchedGenres) {
        try {
          await recomputeGenreTarget(g);
          send({ type: "genre_recomputed", genre: g });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: "genre_recompute_failed", genre: g, error: msg.slice(0, 300) });
        }
      }

      send({ type: "done", ok, fail, genres: [...touchedGenres] });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache",
    },
  });
}
