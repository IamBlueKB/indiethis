/**
 * POST /api/admin/reference-library/reanalyze
 *
 * Re-run analyzeReferenceTrack on an existing ReferenceProfile, given a fresh
 * audio URL. Used to backfill stem-level data on profiles that were ingested
 * before Demucs separation was wired into the pipeline (their `stems: {}` and
 * `relationships: { all null }`).
 *
 * Body: { profileId: string, audioUrl: string }
 *
 * Behaviour:
 *   - Calls analyzeReferenceTrack which runs Demucs + Cog analyze-reference.
 *   - Overwrites `profileData`, refreshes `separationConfidence` /
 *     `separationWeight` / `qualityGatePassed`.
 *   - Recomputes the genre aggregate so Claude immediately sees the new data.
 *   - Audio URL itself is NOT stored (matches existing privacy posture).
 *
 * PLATFORM_ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { assertReferenceAdmin } from "@/lib/reference-library/auth";
import { analyzeReferenceTrack, type SourceQuality } from "@/lib/reference-library/engine";
import { recomputeGenreTarget } from "@/lib/reference-library/aggregate";

export const maxDuration = 800;

export async function POST(req: NextRequest) {
  const admin = await assertReferenceAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { profileId?: string; audioUrl?: string };
  if (!body.profileId || !body.audioUrl) {
    return NextResponse.json({ error: "profileId + audioUrl required" }, { status: 400 });
  }

  const existing = await prisma.referenceProfile.findUnique({
    where:  { id: body.profileId },
    select: { id: true, genre: true, sourceQuality: true, source: true },
  });
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const profile = await analyzeReferenceTrack({
      audioUrl:      body.audioUrl,
      genre:         existing.genre,
      sourceQuality: (existing.sourceQuality ?? "other") as SourceQuality,
    });

    await prisma.referenceProfile.update({
      where: { id: body.profileId },
      data: {
        profileData:           profile as never,
        separationConfidence:  profile.separation_confidence,
        separationWeight:      profile.separation_weight,
        qualityGatePassed:     profile.separation_confidence >= 0.6,
      },
    });

    await recomputeGenreTarget(existing.genre);

    return NextResponse.json({
      ok:                   true,
      profileId:            body.profileId,
      genre:                existing.genre,
      separationConfidence: profile.separation_confidence,
      stemsAnalyzed:        Object.keys(profile.stems ?? {}).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
