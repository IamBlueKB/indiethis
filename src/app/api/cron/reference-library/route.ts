/**
 * POST /api/cron/reference-library
 *
 * Nightly backstop for the Reference Library:
 *   1. Recompute every GenreTarget from its current ReferenceProfile rows
 *      (catches anything event-driven recompute missed).
 *   2. Mark COMPLETE jobs older than 7 days with no MixOutcomeFeedback as
 *      "abandoned" — silent negative signal.
 *   3. Auto-promote popular user references (uploadCount >= 5, autoPromoted=false):
 *      flip them into the commercial pool by upgrading source quality + weight.
 *
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db as prisma } from "@/lib/db";
import { recomputeAllGenres, recomputeGenreTarget } from "@/lib/reference-library/aggregate";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

const ABANDONED_THRESHOLD_DAYS = 7;
const AUTO_PROMOTE_UPLOAD_COUNT = 5;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();

  // ─── 1. Recompute all genre targets ────────────────────────────────────
  let recomputed = 0;
  try {
    const genresList = await recomputeAllGenres();
    recomputed = Array.isArray(genresList) ? genresList.length : 0;
  } catch (err) {
    console.error("[cron/reference-library] recomputeAllGenres failed:", err);
  }

  // ─── 2. Detect abandoned jobs ──────────────────────────────────────────
  const cutoff = new Date(Date.now() - ABANDONED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const abandonedJobs = await prisma.mixJob.findMany({
    where: {
      status:    "COMPLETE",
      createdAt: { lt: cutoff },
      // No outcome row yet
      // (Prisma doesn't support `not` on relation count in findMany —
      //  we filter in-memory after fetch)
    },
    select: { id: true, genre: true, tier: true, analysisData: true, mixParameters: true, revisionCount: true },
    take: 500,
  });

  let abandonedLogged = 0;
  for (const job of abandonedJobs) {
    const existing = await prisma.mixOutcomeFeedback.findFirst({
      where: { mixJobId: job.id },
      select: { id: true },
    });
    if (existing) continue;

    const isHoldout = hashToBucket(job.id, 10) === 0;
    await prisma.mixOutcomeFeedback.create({
      data: {
        mixJobId:          job.id,
        genre:             job.genre ?? "unknown",
        tier:              job.tier ?? "STANDARD",
        inputQualityScore: 0.5,
        mixParamsUsed:     (job.mixParameters ?? {}) as object,
        outputAnalysis:    {} as object,
        outcome:           "abandoned",
        revisionNotes:     Prisma.JsonNull,
        revisionKeywords:  [],
        revisionCount:     job.revisionCount ?? 0,
        variationSelected: null,
        timeToDownload:    null,
        deviationFromTarget: Prisma.JsonNull,
        qualifiesForLearning: false,  // abandoned ≠ learning signal
        learningWeight:    0,
        isHoldout,
      },
    }).catch(() => null);
    abandonedLogged++;
  }

  // ─── 3. Auto-promote popular user references ──────────────────────────
  const candidates = await prisma.userReferencePopularity.findMany({
    where: {
      uploadCount:   { gte: AUTO_PROMOTE_UPLOAD_COUNT },
      autoPromoted:  false,
      profileId:     { not: null },
    },
    take: 200,
  });

  let promoted = 0;
  const touchedGenres = new Set<string>();
  for (const c of candidates) {
    if (!c.profileId) continue;
    try {
      await prisma.referenceProfile.update({
        where: { id: c.profileId },
        data: {
          source:               "commercial",
          sourceQuality:        "lossless",
          sourceQualityWeight:  1.0,
          weight:               1.0,
        },
      });
      await prisma.userReferencePopularity.update({
        where: { id: c.id },
        data:  { autoPromoted: true },
      });
      promoted++;
      touchedGenres.add(c.genre);
    } catch (err) {
      console.error(`[cron/reference-library] promote failed for ${c.id}:`, err);
    }
  }

  for (const g of touchedGenres) {
    await recomputeGenreTarget(g).catch(() => null);
  }

  const elapsedMs = Date.now() - started;
  return NextResponse.json({
    ok:               true,
    elapsedMs,
    genresRecomputed: recomputed,
    abandonedLogged,
    promoted,
    promotedGenres:   [...touchedGenres],
  });
}

function hashToBucket(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}
