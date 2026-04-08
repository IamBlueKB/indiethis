/**
 * src/lib/agents/mastering-conversion.ts
 *
 * Mastering Conversion Agent — converts non-subscriber guests into subscribers
 * via a 4-email drip sequence after they receive a free 30-second preview.
 *
 * Email schedule (relative to job createdAt / updatedAt):
 *   Email 1 — immediate   ("Your mastered preview is waiting")
 *   Email 2 — +48 hours   (value pitch: 4 versions, platform exports, subscriber savings)
 *   Email 3 — +5 days     (social proof / full master download CTA)
 *   Email 4 — +10 days    (50% off promo — only if any email was opened)
 *
 * Mix Quality Follow-Up Agent — fires 48h after a subscriber's job COMPLETES,
 * asks how it sounds, surfaces revision/album upgrade CTAs.
 *
 * Album Mastering Nudge Agent — fires 3 days after a subscriber completes their
 * 2nd or 3rd single master, inviting them to try album mastering.
 *
 * Abandoned Cart Agent — fires once for MasteringJob records with guestEmail
 * that are still PENDING > 2 hours (guest never paid after getting the email gate).
 */

import { db }             from "@/lib/db";
import { stripe }         from "@/lib/stripe";
import { logAgentAction } from "@/lib/agents";
import { sendBrandedEmail } from "@/lib/brevo/email";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
const MASTER_URL = () => `${APP_URL()}/master`;
const PRICING_URL = () => `${APP_URL()}/pricing`;

// ─── Result types ──────────────────────────────────────────────────────────────

export interface MasteringConversionResult {
  acted:   number;
  email1:  number;
  email2:  number;
  email3:  number;
  email4:  number;
  stopped: number;
}

export interface MixQualityFollowUpResult {
  checked: number;
  acted:   number;
}

export interface AlbumMasteringNudgeResult {
  checked: number;
  acted:   number;
}

export interface MasteringAbandonedCartResult {
  checked: number;
  sent:    number;
}

// ─── Step 1: Mastering Conversion Agent ───────────────────────────────────────

export async function runMasteringConversionAgent(): Promise<MasteringConversionResult> {
  const result: MasteringConversionResult = {
    acted: 0, email1: 0, email2: 0, email3: 0, email4: 0, stopped: 0,
  };

  const now      = new Date();
  const cutoff   = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Find guest jobs (no userId) that are COMPLETE or have a preview, not yet converted
  const jobs = await db.masteringJob.findMany({
    where: {
      userId:         null,
      guestEmail:     { not: null },
      conversionDone: false,
      createdAt:      { gte: cutoff },
      OR: [
        { conversionStep: 0 },
        { conversionStep: { lt: 4 }, conversionNextAt: { lte: now } },
      ],
    },
    select: {
      id:                  true,
      guestEmail:          true,
      guestName:           true,
      tier:                true,
      mode:                true,
      previewUrl:          true,
      conversionStep:      true,
      conversionNextAt:    true,
      conversionPromoCode: true,
      conversionAnyOpened: true,
      createdAt:           true,
    },
  });

  for (const job of jobs) {
    if (!job.guestEmail) continue;
    const j = { ...job, guestEmail: job.guestEmail };

    try {
      // Stop if this guest is now a subscriber
      const isSubscriber = await db.user.findFirst({
        where: { email: j.guestEmail, subscription: { status: "ACTIVE" } },
        select: { id: true },
      });
      if (isSubscriber) {
        await db.masteringJob.update({ where: { id: j.id }, data: { conversionDone: true } });
        result.stopped++; result.acted++;
        continue;
      }

      const step = j.conversionStep;

      if (step === 0) {
        await sendMasteringEmail1(j);
        await db.masteringJob.update({
          where: { id: j.id },
          data:  { conversionStep: 1, conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        });
        result.email1++; result.acted++;

      } else if (step === 1) {
        await sendMasteringEmail2(j);
        await db.masteringJob.update({
          where: { id: j.id },
          data:  { conversionStep: 2, conversionNextAt: new Date(Date.now() + (5 * 24 - 2) * 60 * 60 * 1000) },
        });
        result.email2++; result.acted++;

      } else if (step === 2) {
        await sendMasteringEmail3(j);
        await db.masteringJob.update({
          where: { id: j.id },
          data:  { conversionStep: 3, conversionNextAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
        });
        result.email3++; result.acted++;

      } else if (step === 3) {
        if (!j.conversionAnyOpened) {
          // Didn't open any emails — mark done without promo
          await db.masteringJob.update({ where: { id: j.id }, data: { conversionDone: true, conversionStep: 4 } });
          result.stopped++; result.acted++;
        } else {
          const promoCode = await createMasteringPromoCode(j.id);
          await sendMasteringEmail4(j, promoCode);
          await db.masteringJob.update({
            where: { id: j.id },
            data:  { conversionStep: 4, conversionDone: true, conversionPromoCode: promoCode },
          });
          result.email4++; result.acted++;
        }
      }

      await logAgentAction("MASTERING_CONVERSION", `EMAIL${step + 1}_SENT`, "MasteringJob", j.id, {
        email: j.guestEmail,
        step:  step + 1,
      });
    } catch (err) {
      console.error(`[mastering-conversion] failed for job ${j.id}:`, err);
      await logAgentAction("MASTERING_CONVERSION", "EMAIL_SEND_ERROR", "MasteringJob", j.id, {
        error: String(err),
      });
    }
  }

  return result;
}

// ─── Step 2: Mix Quality Follow-Up Agent ──────────────────────────────────────

export async function runMixQualityFollowUpAgent(): Promise<MixQualityFollowUpResult> {
  const result: MixQualityFollowUpResult = { checked: 0, acted: 0 };

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const sevenDaysAgo       = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Subscriber jobs completed 48h ago that haven't had a follow-up
  const jobs = await db.masteringJob.findMany({
    where: {
      userId:           { not: null },
      status:           "COMPLETE",
      conversionDone:   false,   // reuse flag as "follow-up sent"
      updatedAt:        { lte: fortyEightHoursAgo, gte: sevenDaysAgo },
    },
    select: {
      id:              true,
      userId:          true,
      mode:            true,
      tier:            true,
      selectedVersion: true,
      revisionUsed:    true,
      albumGroupId:    true,
    },
  });

  result.checked = jobs.length;

  for (const job of jobs) {
    try {
      const user = await db.user.findUnique({
        where:  { id: job.userId! },
        select: { email: true, name: true },
      });
      if (!user?.email) continue;

      await sendMixQualityEmail(user, job);
      await db.masteringJob.update({ where: { id: job.id }, data: { conversionDone: true } });

      result.acted++;
      await logAgentAction("MIX_QUALITY_FOLLOWUP", "EMAIL_SENT", "MasteringJob", job.id, {
        email: user.email,
      });
    } catch (err) {
      console.error(`[mix-quality-followup] failed for job ${job.id}:`, err);
    }
  }

  return result;
}

// ─── Step 3: Album Mastering Nudge Agent ──────────────────────────────────────

export async function runAlbumMasteringNudgeAgent(): Promise<AlbumMasteringNudgeResult> {
  const result: AlbumMasteringNudgeResult = { checked: 0, acted: 0 };

  // Find subscribers who have completed exactly 2 or 3 MASTER_ONLY jobs
  // and have never used album mastering (no albumGroupId on any job)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Aggregate: find users with 2-3 complete single masters, no album jobs
  const candidates = await db.masteringJob.groupBy({
    by:    ["userId"],
    where: {
      userId:      { not: null },
      mode:        "MASTER_ONLY",
      status:      "COMPLETE",
      albumGroupId: null,
      updatedAt:   { lte: threeDaysAgo },
    },
    having: {
      userId: { _count: { gte: 2, lte: 3 } },
    },
    _count: { id: true },
  });

  result.checked = candidates.length;

  for (const c of candidates) {
    if (!c.userId) continue;

    // Check they haven't already received an album nudge
    const alreadySent = await db.masteringJob.findFirst({
      where: { userId: c.userId, albumGroupId: { not: null } },
    });
    if (alreadySent) continue;

    // Check conversionDone flag not set (reuse as "nudge sent" marker on the latest job)
    const latestJob = await db.masteringJob.findFirst({
      where:   { userId: c.userId, mode: "MASTER_ONLY", status: "COMPLETE", albumGroupId: null },
      orderBy: { updatedAt: "desc" },
    });
    if (!latestJob || latestJob.conversionDone) continue;

    try {
      const user = await db.user.findUnique({
        where:  { id: c.userId },
        select: { email: true, name: true },
      });
      if (!user?.email) continue;

      await sendAlbumNudgeEmail(user, c._count.id);
      await db.masteringJob.update({ where: { id: latestJob.id }, data: { conversionDone: true } });

      result.acted++;
      await logAgentAction("ALBUM_MASTERING_NUDGE", "EMAIL_SENT", "MasteringJob", latestJob.id, {
        email:      user.email,
        trackCount: c._count.id,
      });
    } catch (err) {
      console.error(`[album-mastering-nudge] failed for user ${c.userId}:`, err);
    }
  }

  return result;
}

// ─── Step 4: Abandoned Cart Agent ─────────────────────────────────────────────

export async function runMasteringAbandonedCartAgent(): Promise<MasteringAbandonedCartResult> {
  const result: MasteringAbandonedCartResult = { checked: 0, sent: 0 };

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const tenDaysAgo  = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // Guest jobs that never had payment (PENDING), with an email, not yet sent
  const jobs = await db.masteringJob.findMany({
    where: {
      userId:            null,
      status:            "PENDING",
      guestEmail:        { not: null },
      abandonedCartSent: false,
      createdAt:         { lte: twoHoursAgo, gte: tenDaysAgo },
    },
    select: {
      id:         true,
      guestEmail: true,
      guestName:  true,
      mode:       true,
      tier:       true,
      createdAt:  true,
    },
  });

  result.checked = jobs.length;

  for (const job of jobs) {
    if (!job.guestEmail) continue;
    try {
      await sendMasteringAbandonedCartEmail({ ...job, guestEmail: job.guestEmail });
      await db.masteringJob.update({ where: { id: job.id }, data: { abandonedCartSent: true } });
      result.sent++;

      await logAgentAction("MASTERING_ABANDONED_CART", "EMAIL_SENT", "MasteringJob", job.id, {
        email: job.guestEmail,
      });
    } catch (err) {
      console.error(`[mastering-abandoned-cart] failed for job ${job.id}:`, err);
    }
  }

  return result;
}

// ─── Promo code helper ─────────────────────────────────────────────────────────

async function createMasteringPromoCode(jobId: string): Promise<string> {
  const code = `MASTER50-${jobId.slice(-6).toUpperCase()}`;
  await stripe.promotionCodes.create({
    coupon: await getOrCreateMasteringCoupon(),
    code,
    max_redemptions: 1,
  });
  return code;
}

let _masteringCouponId: string | null = null;
async function getOrCreateMasteringCoupon(): Promise<string> {
  if (_masteringCouponId) return _masteringCouponId;
  const existing = await stripe.coupons.list({ limit: 100 });
  const found = existing.data.find((c) => c.name === "Mastering 50% Off");
  if (found) { _masteringCouponId = found.id; return found.id; }
  const coupon = await stripe.coupons.create({
    name:               "Mastering 50% Off",
    percent_off:        50,
    duration:           "once",
    max_redemptions:    9999,
    applies_to:         { products: [] },
  });
  _masteringCouponId = coupon.id;
  return coupon.id;
}

// ─── Email builders ────────────────────────────────────────────────────────────

async function sendMasteringEmail1(job: {
  id: string; guestEmail: string; guestName?: string | null;
  mode?: string | null; tier?: string | null; previewUrl?: string | null;
}): Promise<void> {
  const name = job.guestName || "Artist";
  await sendBrandedEmail({
    to:      { email: job.guestEmail, name },
    subject: "Your mastered preview is ready — hear the difference",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your preview is ready, ${name}.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Our AI just mastered a 30-second preview of your track. Log in to hear exactly what the full master sounds like
        before you pay a single dollar.
      </p>
      ${job.previewUrl ? `
      <p style="margin:0 0 24px;">
        <a href="${job.previewUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          Listen to your preview &rarr;
        </a>
      </p>
      ` : ""}
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        When you're ready for the full master — 4 versions (Clean, Warm, Punch, Loud), platform-ready exports for Spotify,
        Apple Music, YouTube — click below.
      </p>
      <a href="${MASTER_URL()}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Get the full master &rarr;
      </a>
    `,
    context: "MASTERING_CONVERSION_1",
    tags:    ["ai", "mastering", "conversion"],
  });
}

async function sendMasteringEmail2(job: {
  id: string; guestEmail: string; guestName?: string | null;
}): Promise<void> {
  const name = job.guestName || "Artist";
  await sendBrandedEmail({
    to:      { email: job.guestEmail, name },
    subject: "4 versions. Every platform. One price.",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Why IndieThis mastering is different.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Most online mastering gives you one version and hopes for the best. We give you four — so you pick the sound
        that fits your vision:
      </p>
      <ul style="color:#ccc;font-size:14px;line-height:2;margin:0 0 16px;padding-left:20px;">
        <li><strong style="color:#D4A843;">Clean</strong> — balanced, flat reference</li>
        <li><strong style="color:#D4A843;">Warm</strong> — smooth, vintage character</li>
        <li><strong style="color:#D4A843;">Punch</strong> — aggressive, transient-forward</li>
        <li><strong style="color:#D4A843;">Loud</strong> — maximum competitive loudness</li>
      </ul>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Every master includes platform-ready exports — Spotify at -14 LUFS, Apple Music, YouTube, and a lossless WAV
        you keep forever. Ready in 4–7 minutes. Starting at $11.99.
      </p>
      <a href="${MASTER_URL()}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Master your track &rarr;
      </a>
      <p style="color:#555;font-size:12px;margin:24px 0 0;">
        IndieThis subscribers pay up to 50% less on every master.
        <a href="${PRICING_URL()}" style="color:#D4A843;">See subscriber pricing.</a>
      </p>
    `,
    context: "MASTERING_CONVERSION_2",
    tags:    ["ai", "mastering", "conversion"],
  });
}

async function sendMasteringEmail3(job: {
  id: string; guestEmail: string; guestName?: string | null;
}): Promise<void> {
  const name = job.guestName || "Artist";
  await sendBrandedEmail({
    to:      { email: job.guestEmail, name },
    subject: "Your track deserves a professional master",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">The full master is one click away.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hey ${name}, your 30-second preview is still on file. The AI analyzed your track's BPM, key, frequency balance,
        and dynamic range — and built a custom mastering chain specifically for it.
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        When you order the full master, you get:
      </p>
      <ul style="color:#ccc;font-size:14px;line-height:2;margin:0 0 16px;padding-left:20px;">
        <li>All 4 versions (Clean, Warm, Punch, Loud)</li>
        <li>Platform-ready exports for every streaming service</li>
        <li>A full mastering report (LUFS, true peak, dynamic range)</li>
        <li>Your files ready to upload in minutes</li>
      </ul>
      <a href="${MASTER_URL()}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Get the full master &rarr;
      </a>
    `,
    context: "MASTERING_CONVERSION_3",
    tags:    ["ai", "mastering", "conversion"],
  });
}

async function sendMasteringEmail4(job: {
  id: string; guestEmail: string; guestName?: string | null;
}, promoCode: string): Promise<void> {
  const name = job.guestName || "Artist";
  await sendBrandedEmail({
    to:      { email: job.guestEmail, name },
    subject: `${name}, here's 50% off your full master`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">One last thing.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        We want you to hear the full master. So here's 50% off — one-time, just for you.
      </p>
      <div style="background:#1A1A1A;border:1px solid #D4A843;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
        <p style="color:#D4A843;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Your promo code</p>
        <p style="color:#fff;font-size:28px;font-weight:900;font-family:monospace;margin:0;">${promoCode}</p>
      </div>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Apply at checkout. Valid for one use. Your AI-built mastering chain is already ready — this just unlocks the download.
      </p>
      <a href="${MASTER_URL()}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Claim 50% off &rarr;
      </a>
    `,
    context: "MASTERING_CONVERSION_4",
    tags:    ["ai", "mastering", "conversion", "promo"],
  });
}

async function sendMixQualityEmail(
  user: { email: string; name?: string | null },
  job: { id: string; tier?: string | null; selectedVersion?: string | null; revisionUsed?: boolean; albumGroupId?: string | null }
): Promise<void> {
  const name = user.name || "Artist";
  const canRevise = job.tier === "PRO" && !job.revisionUsed;
  await sendBrandedEmail({
    to:      { email: user.email, name },
    subject: "How does your master sound?",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">How does it sound, ${name}?</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Your master was ready 48 hours ago — have you had a chance to listen to it through your monitors or earbuds?
        Sometimes a track sounds different on the system you're releasing it on.
      </p>
      ${canRevise ? `
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        As a Pro subscriber, you have <strong style="color:#D4A843;">one free revision</strong> included with this master.
        Just tell the AI what to adjust in plain English.
      </p>
      <p style="margin:0 0 16px;">
        <a href="${APP_URL()}/dashboard/ai/master" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
          Request a revision &rarr;
        </a>
      </p>
      ` : ""}
      ${!job.albumGroupId ? `
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Got more tracks for a project or EP? <strong style="color:#D4A843;">Album mastering</strong> processes all
        your tracks together for a consistent loudness and tonal signature across the full release.
      </p>
      <a href="${APP_URL()}/dashboard/ai/master" style="color:#D4A843;text-decoration:underline;font-size:14px;">
        Try album mastering &rarr;
      </a>
      ` : ""}
    `,
    context: "MIX_QUALITY_FOLLOWUP",
    tags:    ["ai", "mastering", "followup"],
  });
}

async function sendAlbumNudgeEmail(
  user: { email: string; name?: string | null },
  trackCount: number
): Promise<void> {
  const name = user.name || "Artist";
  await sendBrandedEmail({
    to:      { email: user.email, name },
    subject: `You've mastered ${trackCount} tracks — ready for a full album?`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">From singles to a full release.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hey ${name}, you've mastered ${trackCount} tracks with IndieThis. If those are part of an EP or album,
        here's something you might want to know:
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        <strong style="color:#D4A843;">Album mastering</strong> processes all your tracks together — analyzing BPM,
        frequency balance, and loudness across every song. The AI derives one shared loudness target and tonal EQ
        curve so your album sounds cohesive front to back, the way a professional mastering engineer would sequence it.
      </p>
      <ul style="color:#ccc;font-size:14px;line-height:2;margin:0 0 16px;padding-left:20px;">
        <li>Upload 2–20 stereo masters</li>
        <li>One shared LUFS target across all tracks</li>
        <li>Consistent tonal signature (no jarring jumps between songs)</li>
        <li>4 versions per track + platform exports</li>
      </ul>
      <a href="${APP_URL()}/dashboard/ai/master" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Try album mastering &rarr;
      </a>
    `,
    context: "ALBUM_MASTERING_NUDGE",
    tags:    ["ai", "mastering", "album", "nudge"],
  });
}

async function sendMasteringAbandonedCartEmail(job: {
  id: string; guestEmail: string; guestName?: string | null;
  mode?: string | null; tier?: string | null;
}): Promise<void> {
  const name = job.guestName || "Artist";
  await sendBrandedEmail({
    to:      { email: job.guestEmail, name },
    subject: "You were close — your free preview is still waiting",
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">You left before hearing it.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hey ${name}, you started the mastering process but didn't finish. The AI is ready to generate your free
        30-second preview — no card required to hear it.
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Upload your track, hear exactly what the AI will do to it, then decide if you want the full master.
        No risk. No account needed.
      </p>
      <a href="${MASTER_URL()}" style="background:#E85D4A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Get your free preview &rarr;
      </a>
      <p style="color:#555;font-size:12px;margin:24px 0 0;">
        Full masters from $11.99 · 4 versions · platform-ready exports · ready in minutes.
      </p>
    `,
    context: "MASTERING_ABANDONED_CART",
    tags:    ["ai", "mastering", "abandoned-cart"],
  });
}
