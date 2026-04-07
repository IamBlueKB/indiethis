/**
 * release-bundle.ts — Release Bundle Agent
 *
 * Runs weekly on Tuesdays (same day as Inactive Content Agent).
 * Finds artists with PUBLISHED tracks missing 2+ of the three release
 * assets — cover art, canvas video, lyric video — then sends a single
 * in-app notification suggesting the $18.99 Release Bundle (saves $2.99
 * vs buying Cover Art + Canvas + Lyric Video individually).
 *
 * Dedup: only notifies each artist once per 6 days.
 */

import { db }                 from "@/lib/db";
import { logAgentAction, AT } from "@/lib/agents";
import { createNotification } from "@/lib/notifications";

const AGENT = "RELEASE_BUNDLE";

export interface ReleaseBundleAgentResult {
  checked: number;
  acted:   number;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function runReleaseBundleAgent(): Promise<ReleaseBundleAgentResult> {
  await logAgentAction(AGENT, "AGENT_RUN_START");

  // All active artists
  const artists = await db.user.findMany({
    where: { role: "ARTIST", subscription: { status: "ACTIVE" } },
    select: { id: true, name: true },
    take: 200,
  });

  let checked = 0;
  let acted   = 0;

  for (const artist of artists) {
    checked++;

    // Find published tracks missing 2+ release assets
    const tracks = await db.track.findMany({
      where: { artistId: artist.id, status: "PUBLISHED" },
      select: { id: true, title: true, coverArtUrl: true, canvasVideoUrl: true },
      take: 20,
    });

    // Gather trackIds that have a completed lyric video job
    const trackIds = tracks.map(t => t.id);
    const completedLyricJobs = trackIds.length > 0
      ? await db.aIJob.findMany({
          where: {
            triggeredById: artist.id,
            type:          "LYRIC_VIDEO",
            status:        "COMPLETE",
          },
          select: { inputData: true },
        })
      : [];

    // Build set of trackIds that already have a lyric video
    const lyricVideoTrackIds = new Set<string>();
    for (const job of completedLyricJobs) {
      const input = job.inputData as Record<string, unknown> | null;
      if (input?.trackId && typeof input.trackId === "string") {
        lyricVideoTrackIds.add(input.trackId);
      }
    }

    // Find tracks missing 2+ of the 3 assets
    const bundleCandidates = tracks.filter(t => {
      const missing = [
        !t.coverArtUrl,
        !t.canvasVideoUrl,
        !lyricVideoTrackIds.has(t.id),
      ].filter(Boolean).length;
      return missing >= 2;
    });

    if (bundleCandidates.length === 0) continue;

    // Dedup: skip if already notified this artist in the last 6 days
    const recent = await db.agentLog.findFirst({
      where: {
        agentType: AT(AGENT),
        action:    "BUNDLE_NOTIFICATION_SENT",
        targetId:  artist.id,
        createdAt: { gte: daysAgo(6) },
      },
    });
    if (recent) continue;

    // Pick the best candidate (most missing assets first)
    const best = bundleCandidates.sort((a, b) => {
      const missingA = [!a.coverArtUrl, !a.canvasVideoUrl, !lyricVideoTrackIds.has(a.id)].filter(Boolean).length;
      const missingB = [!b.coverArtUrl, !b.canvasVideoUrl, !lyricVideoTrackIds.has(b.id)].filter(Boolean).length;
      return missingB - missingA;
    })[0];

    const missingLabels = [
      !best.coverArtUrl          && "cover art",
      !best.canvasVideoUrl       && "canvas video",
      !lyricVideoTrackIds.has(best.id) && "lyric video",
    ].filter(Boolean) as string[];

    const missingStr = missingLabels.length === 3
      ? "cover art, canvas video, and lyric video"
      : missingLabels.join(" and ");

    await createNotification({
      userId:  artist.id,
      type:    "AI_JOB_COMPLETE",
      title:   "Complete your release — bundle deal",
      message: `"${best.title}" is missing ${missingStr}. Get all three for $18.99 with the Release Bundle — saves $2.99 vs buying separately.`,
      link:    `/dashboard/music`,
    });

    await logAgentAction(
      AGENT,
      "BUNDLE_NOTIFICATION_SENT",
      "USER",
      artist.id,
      { trackId: best.id, trackTitle: best.title, missingLabels, candidates: bundleCandidates.length },
    );

    acted++;
  }

  await logAgentAction(
    AGENT,
    "AGENT_RUN_COMPLETE",
    undefined,
    undefined,
    { checked, acted },
  );

  return { checked, acted };
}
