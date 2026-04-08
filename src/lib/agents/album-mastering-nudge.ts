/**
 * src/lib/agents/album-mastering-nudge.ts
 *
 * Album Mastering Nudge Agent
 *
 * Trigger: An artist completes their FIRST single master (non-album, completed
 *          within the last 7 days) AND has 3+ tracks uploaded in the last 30 days
 *          with no COMPLETE MasteringJob linked to them.
 *
 * Action:  Sends one email per user suggesting album mastering for consistency.
 *          - Subject: "Make your whole project sound consistent"
 *          - Shows the just-mastered track name + count of unmastered tracks
 *          - CTA: /dashboard/ai/master (album mode card is on Screen 1)
 *
 * Flag:    User.albumNudgeSent — set true after send.
 *          Guarantees exactly one nudge per user, even if they master more
 *          singles later.
 *
 * AgentType: ALBUM_MASTERING_NUDGE
 */

import { db }               from "@/lib/db";
import { logAgentAction }   from "@/lib/agents";
import { sendBrandedEmail }  from "@/lib/brevo/email";

const APP_URL       = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
const DASHBOARD_URL = () => `${APP_URL()}/dashboard/ai/master`;

// ─── Result type ───────────────────────────────────────────────────────────────

export interface AlbumMasteringNudgeResult {
  checked: number;
  acted:   number;
}

// ─── Agent ─────────────────────────────────────────────────────────────────────

export async function runAlbumMasteringNudgeAgent(): Promise<AlbumMasteringNudgeResult> {
  const result: AlbumMasteringNudgeResult = { checked: 0, acted: 0 };

  const sevenDaysAgo   = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find subscribers who:
  //   - Have albumNudgeSent = false (never received this nudge)
  //   - Have exactly 1 COMPLETE single MasteringJob (first single master)
  //   - That job was completed within the last 7 days
  const recentCompletions = await db.masteringJob.groupBy({
    by:    ["userId"],
    where: {
      userId:       { not: null },
      status:       "COMPLETE",
      albumGroupId: null,           // single tracks only, not album jobs
      updatedAt:    { gte: sevenDaysAgo },
    },
    _count: { id: true },
  });

  result.checked = recentCompletions.length;

  for (const row of recentCompletions) {
    if (!row.userId) continue;

    try {
      // Check albumNudgeSent flag — skip if already sent
      const user = await db.user.findUnique({
        where:  { id: row.userId },
        select: { id: true, email: true, name: true, albumNudgeSent: true },
      });
      if (!user?.email || user.albumNudgeSent) continue;

      // Confirm this is their FIRST completed single master (count across all time)
      const totalSingleMasters = await db.masteringJob.count({
        where: {
          userId:       row.userId,
          status:       "COMPLETE",
          albumGroupId: null,
        },
      });
      if (totalSingleMasters !== 1) continue; // More than 1 — nudge already missed or not first

      // Get the mastered track's name (from trackId relation if available)
      const masteredJob = await db.masteringJob.findFirst({
        where: {
          userId:       row.userId,
          status:       "COMPLETE",
          albumGroupId: null,
        },
        select: { trackId: true },
      });

      let masteredTrackTitle: string | null = null;
      if (masteredJob?.trackId) {
        const track = await db.track.findUnique({
          where:  { id: masteredJob.trackId },
          select: { title: true },
        });
        masteredTrackTitle = track?.title ?? null;
      }

      // Count unmastered tracks uploaded in the last 30 days
      // "Unmastered" = Track uploaded recently with NO COMPLETE MasteringJob linked via trackId
      const recentTracks = await db.track.findMany({
        where: {
          artistId:  row.userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { id: true, title: true },
      });

      if (recentTracks.length === 0) continue;

      // Find which of those tracks have a COMPLETE MasteringJob
      const masteredTrackIds = await db.masteringJob.findMany({
        where: {
          userId:   row.userId,
          status:   "COMPLETE",
          trackId:  { in: recentTracks.map((t) => t.id) },
        },
        select: { trackId: true },
      });
      const masteredSet = new Set(masteredTrackIds.map((j) => j.trackId).filter(Boolean));
      const unmasteredTracks = recentTracks.filter((t) => !masteredSet.has(t.id));

      if (unmasteredTracks.length < 3) continue; // Need 3+ unmastered

      // Send the nudge email
      await sendAlbumNudgeEmail(user, masteredTrackTitle, unmasteredTracks.length);

      // Mark user as nudged — never fire again
      await db.user.update({
        where: { id: row.userId },
        data:  { albumNudgeSent: true },
      });

      result.acted++;

      await logAgentAction(
        "ALBUM_MASTERING_NUDGE",
        "EMAIL_SENT",
        "User",
        row.userId,
        {
          email:           user.email,
          unmasteredCount: unmasteredTracks.length,
          masteredTrack:   masteredTrackTitle ?? "unknown",
        },
      );
    } catch (err) {
      console.error(`[album-mastering-nudge] failed for user ${row.userId}:`, err);
      await logAgentAction(
        "ALBUM_MASTERING_NUDGE",
        "EMAIL_SEND_ERROR",
        "User",
        row.userId!,
        { error: String(err) },
      );
    }
  }

  return result;
}

// ─── Email builder ─────────────────────────────────────────────────────────────

async function sendAlbumNudgeEmail(
  user:            { email: string; name?: string | null },
  masteredTitle:   string | null,
  unmasteredCount: number,
): Promise<void> {
  const name         = user.name  || "Artist";
  const track        = masteredTitle || "your track";
  const tracksPhrase = unmasteredCount === 1 ? "1 other track" : `${unmasteredCount} other tracks`;

  await sendBrandedEmail({
    to:      { email: user.email, name },
    subject: "Make your whole project sound consistent",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your project could sound like a cohesive release.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        You mastered <strong style="color:#fff;">${track}</strong> on IndieThis.
        You have <strong style="color:#fff;">${tracksPhrase}</strong> that could use the same treatment.
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Master them all together with <strong style="color:#D4A843;">album mastering</strong> for a consistent sound
        across your project — one shared loudness target and tonal signature, so there are no jarring jumps between songs.
      </p>
      <div style="background:#1A1A1A;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
        <p style="color:#D4A843;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;">What album mastering gives you</p>
        <ul style="color:#ccc;font-size:13px;line-height:2;margin:0;padding-left:18px;">
          <li>One shared LUFS target across all tracks</li>
          <li>Consistent tonal EQ curve — no jumps in brightness or bass</li>
          <li>4 versions per track (Clean, Warm, Punch, Loud)</li>
          <li>Platform-ready exports for every streaming service</li>
          <li>Upload 2–20 tracks in one session</li>
        </ul>
      </div>
      <a href="${DASHBOARD_URL()}" style="background:#D4A843;color:#0A0A0A;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:15px;">
        Master the full project &rarr;
      </a>
      <p style="color:#555;font-size:12px;margin:20px 0 0;">
        Select "Album Mastering" on the master screen to get started.
      </p>
    `,
    context: "ALBUM_MASTERING_NUDGE",
    tags:    ["ai", "mastering", "album", "nudge"],
  });
}
