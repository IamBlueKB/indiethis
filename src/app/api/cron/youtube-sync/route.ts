/**
 * GET /api/cron/youtube-sync
 *
 * Daily cron job — syncs YouTube videos for all artists with a connected channel.
 * Queue: PENDING first → oldest lastSyncedAt first. Max 80 per run.
 * Runs at 2:00 AM CST (08:00 UTC).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncYouTubeChannel } from "@/lib/youtube-sync";

export const dynamic    = "force-dynamic";
export const maxDuration = 300; // 5 min — allow time to sync many artists

export async function GET(req: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not configured" }, { status: 503 });
  }

  const now = new Date();

  // Build the queue:
  // 1. PENDING records (never synced) — highest priority
  // 2. Records where nextSyncAt <= now and syncStatus = SYNCED or FAILED
  // Order within each group: oldest lastSyncedAt first (null = never synced = first)
  const syncRecords = await db.youTubeSync.findMany({
    where: {
      OR: [
        { syncStatus: "PENDING" },
        { syncStatus: "SYNCING" },   // stuck SYNCING — retry
        {
          syncStatus: { in: ["SYNCED", "FAILED"] },
          nextSyncAt: { lte: now },
        },
      ],
    },
    orderBy: [
      // PENDING first (null lastSyncedAt sorts before dated ones)
      { lastSyncedAt: "asc" },
    ],
    take: 80,
    select: { userId: true, syncStatus: true },
  });

  const results: Array<{
    artistId: string;
    status:   "ok" | "error";
    added?:   number;
    updated?: number;
    error?:   string;
  }> = [];

  for (const record of syncRecords) {
    try {
      const result = await syncYouTubeChannel(record.userId);
      results.push({ artistId: record.userId, status: "ok", ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[youtube-sync cron] artist ${record.userId} failed:`, msg);
      results.push({ artistId: record.userId, status: "error", error: msg });
    }
  }

  const ok     = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    processed: syncRecords.length,
    ok,
    failed,
    results,
  });
}
