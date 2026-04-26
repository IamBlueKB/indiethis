/**
 * Capture a user-uploaded reference track into the Reference Library.
 *
 * Called async from the mix-console analyze webhook when the artist
 * supplied a reference. Runs the deep `analyze-reference` action,
 * stores the profile (source='user_reference'), bumps the
 * UserReferencePopularity counter for fuzzy dedup, and recomputes
 * the genre target if a quality gate passes.
 *
 * Designed to be fire-and-forget — must never throw into the webhook.
 */

import { createHash } from "crypto";
import { db as prisma } from "@/lib/db";
import { analyzeReferenceTrack, SOURCE_WEIGHTS } from "@/lib/reference-library/engine";
import { recomputeGenreTarget } from "@/lib/reference-library/aggregate";

/** Cog returns the full chromaprint signature (~3-4KB). Hash to fixed-size sha256. */
function hashFp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex");
}

export async function captureUserReference(opts: {
  jobId:    string;
  audioUrl: string;
  genre:    string;
  fileName?: string;
}): Promise<void> {
  const { jobId, audioUrl, genre, fileName } = opts;
  if (!audioUrl || !genre) return;

  try {
    // Deep analyze (separates stems via fal demucs, runs full analysis)
    const profile = await analyzeReferenceTrack({
      audioUrl,
      genre,
      sourceQuality: "other",
    });

    if (!profile) return;

    const sepConf  = Number(profile.separation_confidence ?? 0);
    const sepW     = sepConf >= 0.8 ? 1.0 : sepConf >= 0.6 ? 0.7 : 0.3;
    const fpHash   = hashFp(profile.fingerprint_hash);
    const sqWeight = SOURCE_WEIGHTS.other ?? 0.6;

    const passed = sepConf >= 0.6;

    // ─── Insert ReferenceProfile (only if quality gate passed) ───
    let profileId: string | null = null;
    if (passed) {
      const created = await prisma.referenceProfile.create({
        data: {
          source:               "user_reference",
          sourceQuality:        "other",
          sourceQualityWeight:  sqWeight,
          separationConfidence: sepConf,
          separationWeight:     sepW,
          genre,
          subgenre:             null,
          trackName:            fileName ?? null,
          artistName:           null,
          fingerprintHash:      fpHash,
          mixJobId:             jobId,
          profileData:          profile as unknown as object,
          qualityGatePassed:    true,
          weight:               sqWeight * sepW,
          isHoldout:            false,
        },
      });
      profileId = created.id;
    }

    // ─── Bump UserReferencePopularity (fuzzy dedup) ───
    if (fpHash) {
      const existing = await prisma.userReferencePopularity.findUnique({
        where: { fingerprintHash: fpHash },
      });
      if (existing) {
        await prisma.userReferencePopularity.update({
          where: { fingerprintHash: fpHash },
          data: {
            uploadCount: { increment: 1 },
            lastSeen:    new Date(),
            ...(profileId && !existing.profileId ? { profileId } : {}),
          },
        });
      } else {
        await prisma.userReferencePopularity.create({
          data: {
            fingerprintHash: fpHash,
            genre,
            uploadCount:     1,
            firstSeen:       new Date(),
            lastSeen:        new Date(),
            autoPromoted:    false,
            profileId:       profileId,
            trackName:       fileName ?? null,
            artistName:      null,
          },
        });
      }
    }

    // ─── Recompute the genre target if we contributed something ───
    if (passed) {
      await recomputeGenreTarget(genre).catch(err =>
        console.error(`[capture-user-reference] recompute failed for ${genre}:`, err),
      );
    }
  } catch (err) {
    console.error(`[capture-user-reference] failed for job ${opts.jobId}:`, err);
  }
}
