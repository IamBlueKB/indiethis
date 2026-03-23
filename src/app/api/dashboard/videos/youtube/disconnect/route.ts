/**
 * DELETE /api/dashboard/videos/youtube/disconnect
 *
 * Removes the YouTube channel link from the user's account (deletes YouTubeSync record).
 * Imported videos are KEPT (syncedFromYouTube stays true so they show their
 * "YouTube · Synced" badge, but future syncs won't run).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.youTubeSync.deleteMany({ where: { userId: session.user.id } });

  // Count how many synced videos remain (for confirmation message)
  const syncedCount = await db.artistVideo.count({
    where: { artistId: session.user.id, syncedFromYouTube: true },
  });

  return NextResponse.json({ ok: true, syncedVideosRetained: syncedCount });
}
