/**
 * src/lib/agents/mix-quality-followup.ts
 *
 * Mix Quality Follow-Up Agent
 *
 * Trigger: 48 hours after a MasteringJob reaches COMPLETE status.
 * Action:  Sends one email per job asking how the master sounds.
 *          - Pro tier + revisionUsed === false  → remind about free revision
 *          - Standard / Premium               → nudge to upgrade for stems + revision
 *
 * Flag:    MasteringJob.followUpSent — set to true once email is sent.
 *          Guarantees exactly one email per job.
 *
 * AgentType: MIX_QUALITY_FOLLOWUP
 */

import { db }               from "@/lib/db";
import { logAgentAction }   from "@/lib/agents";
import { sendBrandedEmail }  from "@/lib/brevo/email";

const APP_URL       = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
const DASHBOARD_URL = () => `${APP_URL()}/dashboard/ai/master`;
const PRICING_URL   = () => `${APP_URL()}/pricing`;

// ─── Result type ───────────────────────────────────────────────────────────────

export interface MixQualityFollowUpResult {
  checked: number;
  acted:   number;
}

// ─── Agent ─────────────────────────────────────────────────────────────────────

export async function runMixQualityFollowUpAgent(): Promise<MixQualityFollowUpResult> {
  const result: MixQualityFollowUpResult = { checked: 0, acted: 0 };

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const sevenDaysAgo       = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Jobs that completed 48h+ ago but not more than 7 days ago,
  // belonging to a real user, and not yet followed up.
  const jobs = await db.masteringJob.findMany({
    where: {
      userId:       { not: null },
      status:       "COMPLETE",
      followUpSent: false,
      updatedAt:    { lte: fortyEightHoursAgo, gte: sevenDaysAgo },
    },
    select: {
      id:           true,
      userId:       true,
      trackId:      true,
      tier:         true,
      mode:         true,
      revisionUsed: true,
    },
  });

  result.checked = jobs.length;

  for (const job of jobs) {
    try {
      // Fetch user
      const user = await db.user.findUnique({
        where:  { id: job.userId! },
        select: { email: true, name: true },
      });
      if (!user?.email) continue;

      // Fetch track title when the job is linked to a Track
      let trackTitle: string | null = null;
      if (job.trackId) {
        const track = await db.track.findUnique({
          where:  { id: job.trackId },
          select: { title: true },
        });
        trackTitle = track?.title ?? null;
      }

      await sendFollowUpEmail(user, job, trackTitle);

      await db.masteringJob.update({
        where: { id: job.id },
        data:  { followUpSent: true },
      });

      result.acted++;

      await logAgentAction(
        "MIX_QUALITY_FOLLOWUP",
        "EMAIL_SENT",
        "MasteringJob",
        job.id,
        { email: user.email, tier: job.tier },
      );
    } catch (err) {
      console.error(`[mix-quality-followup] failed for job ${job.id}:`, err);
      await logAgentAction(
        "MIX_QUALITY_FOLLOWUP",
        "EMAIL_SEND_ERROR",
        "MasteringJob",
        job.id,
        { error: String(err) },
      );
    }
  }

  return result;
}

// ─── Email builder ─────────────────────────────────────────────────────────────

async function sendFollowUpEmail(
  user:       { email: string; name?: string | null },
  job:        { id: string; tier?: string | null; revisionUsed?: boolean; mode?: string | null },
  trackTitle: string | null,
): Promise<void> {
  const name       = user.name  || "Artist";
  const track      = trackTitle || "your track";
  const isPro      = job.tier === "PRO";
  const canRevise  = isPro && !job.revisionUsed;
  const jobUrl     = `${DASHBOARD_URL()}`;

  const tierBlock = canRevise
    ? `
      <div style="background:#1A1A1A;border:1px solid #D4A843;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="color:#D4A843;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;">Pro Revision Available</p>
        <p style="color:#ccc;font-size:13px;line-height:1.6;margin:0 0 12px;">
          Remember, you have a <strong style="color:#fff;">free revision included</strong> with this master.
          Just tell the AI what to change — in plain English — and it'll rebuild the mastering chain around your notes.
        </p>
        <a href="${jobUrl}" style="color:#D4A843;font-size:13px;font-weight:700;text-decoration:underline;">
          Request a revision &rarr;
        </a>
      </div>
    `
    : `
      <div style="background:#1A1A1A;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="color:#fff;font-size:13px;font-weight:600;margin:0 0 6px;">Want more control over your sound?</p>
        <p style="color:#ccc;font-size:13px;line-height:1.6;margin:0 0 12px;">
          Upgrade to Pro for per-stem adjustments — control the levels of vocals, bass, drums, and instruments individually —
          plus a revision round if the first master isn't quite right.
        </p>
        <a href="${PRICING_URL()}" style="color:#D4A843;font-size:13px;font-weight:700;text-decoration:underline;">
          See Pro pricing &rarr;
        </a>
      </div>
    `;

  await sendBrandedEmail({
    to:      { email: user.email, name },
    subject: "How does your master sound?",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">How does it sound, ${name}?</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        You mastered <strong style="color:#fff;">${track}</strong> on IndieThis.
        We'd love to know how it turned out — whether you're happy with it or want something tweaked.
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Try it on different systems: your studio monitors, earbuds, phone speaker, and the car.
        A great master holds up everywhere.
      </p>
      ${tierBlock}
      <p style="margin:24px 0 0;">
        <a href="${jobUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          View your master &rarr;
        </a>
      </p>
    `,
    context: "MIX_QUALITY_FOLLOWUP",
    tags:    ["ai", "mastering", "followup", "quality"],
  });
}
