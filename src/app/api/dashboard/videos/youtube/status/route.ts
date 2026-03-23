/**
 * GET /api/dashboard/videos/youtube/status
 *
 * Returns the artist's YouTube connection state and sync metadata.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [ytSync, syncedCount] = await Promise.all([
    db.youTubeSync.findUnique({ where: { userId: session.user.id } }),
    db.artistVideo.count({ where: { artistId: session.user.id, syncedFromYouTube: true } }),
  ]);

  const connected   = !!ytSync;
  const lastSyncAt  = ytSync?.lastSyncedAt?.toISOString() ?? null;
  const syncStatus  = ytSync?.syncStatus ?? null;

  const canSyncNow = !ytSync?.lastSyncedAt
    || (Date.now() - ytSync.lastSyncedAt.getTime()) >= COOLDOWN_MS;

  const nextAllowedAt = ytSync?.lastSyncedAt && !canSyncNow
    ? new Date(ytSync.lastSyncedAt.getTime() + COOLDOWN_MS).toISOString()
    : null;

  return NextResponse.json({
    connected,
    channelUrl:       ytSync?.channelUrl  ?? null,
    channelId:        ytSync?.channelId   ?? null,
    channelName:      ytSync?.channelName ?? null,
    channelAvatar:    ytSync?.channelAvatar ?? null,
    syncEnabled:      connected,
    syncStatus,
    lastSyncAt,
    canSyncNow,
    nextAllowedAt,
    syncedVideoCount: syncedCount,
    totalVideos:      ytSync?.totalVideos ?? 0,
  });
}
