/**
 * src/lib/agents/lyric-video-conversion.ts
 *
 * Lyric Video Conversion Agent — converts non-subscriber guests into subscribers
 * via a 4-email drip sequence (mirrors music video / cover art conversion agents).
 *
 * Email schedule (relative to job completedAt / updatedAt):
 *   Email 1 — immediate  ("Your lyric video is ready!")
 *   Email 2 — +24 hours  (value pitch: monthly credits + other AI tools)
 *   Email 3 — +3 days    (social proof / platform features)
 *   Email 4 — +7 days    (30% off promo — only if any email was opened)
 *
 * Abandoned Cart Agent — fires once for PENDING jobs older than 2 hours with guestEmail
 */

import { db }              from "@/lib/db";
import { stripe }          from "@/lib/stripe";
import { logAgentAction }  from "@/lib/agents";
import { sendBrandedEmail } from "@/lib/brevo/email";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface LyricVideoConversionResult {
  acted:   number;
  email1:  number;
  email2:  number;
  email3:  number;
  email4:  number;
  stopped: number;
}

export interface LyricVideoAbandonedCartResult {
  acted:  number;
  emails: number;
}

// ─── Conversion Agent ─────────────────────────────────────────────────────────

export async function runLyricVideoConversionAgent(): Promise<LyricVideoConversionResult> {
  const result: LyricVideoConversionResult = {
    acted: 0, email1: 0, email2: 0, email3: 0, email4: 0, stopped: 0,
  };

  const now    = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const jobs = await db.lyricVideo.findMany({
    where: {
      userId:         null,
      status:         "COMPLETE",
      conversionDone: false,
      guestEmail:     { not: null },
      updatedAt:      { gte: cutoff },
      OR: [
        { conversionStep: 0 },
        { conversionStep: { lt: 4 }, conversionNextAt: { lte: now } },
      ],
    },
    select: {
      id:                  true,
      guestEmail:          true,
      guestName:           true,
      trackTitle:          true,
      mode:                true,
      finalVideoUrl:       true,
      conversionStep:      true,
      conversionNextAt:    true,
      conversionPromoCode: true,
      conversionAnyOpened: true,
      updatedAt:           true,
    },
  });

  for (const job of jobs) {
    const { guestEmail } = job;
    if (!guestEmail) continue;

    const j = { ...job, guestEmail };

    try {
      // Stop if this email is now a subscriber
      const isSubscriber = await db.user.findFirst({
        where: { email: guestEmail, subscription: { status: "ACTIVE" } },
        select: { id: true },
      });
      if (isSubscriber) {
        await db.lyricVideo.update({ where: { id: j.id }, data: { conversionDone: true } });
        result.stopped++; result.acted++;
        continue;
      }

      const step = j.conversionStep;

      if (step === 0) {
        await sendEmail1(j);
        await db.lyricVideo.update({
          where: { id: j.id },
          data:  { conversionStep: 1, conversionNextAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        result.email1++; result.acted++;

      } else if (step === 1) {
        await sendEmail2(j);
        await db.lyricVideo.update({
          where: { id: j.id },
          data:  { conversionStep: 2, conversionNextAt: new Date(Date.now() + (3 * 24 - 1) * 60 * 60 * 1000) },
        });
        result.email2++; result.acted++;

      } else if (step === 2) {
        await sendEmail3(j);
        await db.lyricVideo.update({
          where: { id: j.id },
          data:  { conversionStep: 3, conversionNextAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) },
        });
        result.email3++; result.acted++;

      } else if (step === 3) {
        if (!j.conversionAnyOpened) {
          await db.lyricVideo.update({
            where: { id: j.id },
            data:  { conversionDone: true, conversionStep: 4 },
          });
          result.stopped++; result.acted++;
        } else {
          const promoCode = await createPromoCode(j.id);
          await sendEmail4(j, promoCode);
          await db.lyricVideo.update({
            where: { id: j.id },
            data:  { conversionStep: 4, conversionDone: true, conversionPromoCode: promoCode },
          });
          result.email4++; result.acted++;
        }
      }

      await logAgentAction("LYRIC_VIDEO_CONVERSION", `EMAIL${step + 1}_SENT`, "LyricVideo", j.id, {
        email: guestEmail,
        step:  step + 1,
      });

    } catch (err) {
      console.error(`[lyric-video-conversion] failed for job ${j.id}:`, err);
    }
  }

  return result;
}

// ─── Abandoned Cart Agent ─────────────────────────────────────────────────────

export async function runLyricVideoAbandonedCartAgent(): Promise<LyricVideoAbandonedCartResult> {
  const result: LyricVideoAbandonedCartResult = { acted: 0, emails: 0 };

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const tenDaysAgo  = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const jobs = await db.lyricVideo.findMany({
    where: {
      status:            "PENDING",
      guestEmail:        { not: null },
      abandonedCartSent: false,
      createdAt:         { lte: twoHoursAgo, gte: tenDaysAgo },
    },
    select: {
      id:         true,
      guestEmail: true,
      trackTitle: true,
      mode:       true,
      createdAt:  true,
    },
  });

  for (const job of jobs) {
    const { guestEmail } = job;
    if (!guestEmail) continue;

    try {
      await sendAbandonedCartEmail({ ...job, guestEmail });
      await db.lyricVideo.update({ where: { id: job.id }, data: { abandonedCartSent: true } });
      result.emails++; result.acted++;

      await logAgentAction("LYRIC_VIDEO_CONVERSION", "ABANDONED_CART_EMAIL_SENT", "LyricVideo", job.id, {
        email: guestEmail,
      });
    } catch (err) {
      console.error(`[lyric-video-abandoned-cart] failed for job ${job.id}:`, err);
    }
  }

  return result;
}

// ─── Promo code ───────────────────────────────────────────────────────────────

async function createPromoCode(jobId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const couponId = `lv-30pct-${jobId.slice(-8)}`;
  const codeStr  = `LYRV${jobId.slice(-6).toUpperCase()}`;

  try {
    await stripe.coupons.create({
      id:              couponId,
      percent_off:     30,
      duration:        "once",
      max_redemptions: 1,
      redeem_by:       Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
    });
  } catch { /* may already exist */ }

  try {
    await stripe.promotionCodes.create({
      promotion:       { coupon: couponId, type: "coupon" },
      code:            codeStr,
      max_redemptions: 1,
      expires_at:      Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
      metadata:        { lyricVideoJobId: jobId },
    });
  } catch { /* may already exist */ }

  return codeStr;
}

// ─── Email helpers ────────────────────────────────────────────────────────────

type JobRef = { id: string; guestEmail: string; trackTitle: string; mode: string; finalVideoUrl?: string | null };

async function sendEmail1(job: JobRef) {
  const appUrl     = APP_URL();
  const previewUrl = `${appUrl}/lyric-video/preview/${job.id}`;
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: `Your lyric video is ready — "${job.trackTitle}" 🎬`,
    primaryContent: `
      <p>Your cinematic lyric video for <strong>${job.trackTitle}</strong> has been generated!</p>
      <p><a href="${previewUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Watch &amp; Download</a></p>
      <p style="color:#888;font-size:13px;">
        Want to create lyric videos every month for free?
        <a href="${appUrl}/pricing" style="color:#D4A843;">Check out IndieThis plans &rarr;</a>
      </p>
    `,
    context: "LYRIC_VIDEO_CONVERSION_EMAIL1",
    tags:    ["lyric-video-conversion", "email1"],
  });
}

async function sendEmail2(job: JobRef) {
  const appUrl = APP_URL();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "Get monthly lyric video credits + 10 more AI tools",
    primaryContent: `
      <p>Glad you tried our Lyric Video Studio!</p>
      <p>With an IndieThis subscription you get:</p>
      <ul>
        <li>Monthly cinematic lyric video credits</li>
        <li>AI Cover Art, Mastering, Bio Generator, Press Kit</li>
        <li>Music distribution, merch store, fan funding, and more</li>
      </ul>
      <p><a href="${appUrl}/pricing" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">View Plans from $9.99/mo</a></p>
    `,
    context: "LYRIC_VIDEO_CONVERSION_EMAIL2",
    tags:    ["lyric-video-conversion", "email2"],
  });
}

async function sendEmail3(job: JobRef) {
  const appUrl = APP_URL();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "Thousands of indie artists use IndieThis 🎵",
    primaryContent: `
      <p>Your lyric video is just the beginning.</p>
      <p>Join thousands of independent artists who use IndieThis to release music, grow their audience, and get paid.</p>
      <ul>
        <li>Distribute to Spotify, Apple Music, and 150+ stores</li>
        <li>Sell beats, sample packs, and digital downloads</li>
        <li>Book studio sessions and manage clients</li>
      </ul>
      <p><a href="${appUrl}/pricing" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Start for Free</a></p>
    `,
    context: "LYRIC_VIDEO_CONVERSION_EMAIL3",
    tags:    ["lyric-video-conversion", "email3"],
  });
}

async function sendEmail4(job: JobRef, promoCode: string) {
  const appUrl = APP_URL();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "30% off your first month — just for you",
    primaryContent: `
      <p>You&apos;ve been creating great content. Here&apos;s a thank-you gift.</p>
      <p style="font-size:24px;font-weight:900;color:#D4A843;text-align:center;">${promoCode}</p>
      <p style="text-align:center;color:#888;">30% off your first month &mdash; expires in 14 days</p>
      <br />
      <p><a href="${appUrl}/pricing?promo=${promoCode}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Claim 30% Off</a></p>
    `,
    context: "LYRIC_VIDEO_CONVERSION_EMAIL4",
    tags:    ["lyric-video-conversion", "email4"],
  });
}

async function sendAbandonedCartEmail(job: { id: string; guestEmail: string; trackTitle: string; mode: string }) {
  const appUrl    = APP_URL();
  const modeLabel = job.mode === "DIRECTOR" ? "Director Mode" : "Quick Mode";
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: `Your lyric video is waiting — "${job.trackTitle}"`,
    primaryContent: `
      <p>You were so close!</p>
      <p>You started a <strong>${modeLabel}</strong> lyric video for <strong>${job.trackTitle}</strong> but didn&apos;t complete payment.</p>
      <p>Your track and settings are saved. Just complete the payment to generate your video.</p>
      <p><a href="${appUrl}/lyric-video" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Complete My Order</a></p>
      <p style="color:#888;font-size:12px;">
        Or <a href="${appUrl}/pricing" style="color:#D4A843;">subscribe for monthly credits</a>
      </p>
    `,
    context: "LYRIC_VIDEO_ABANDONED_CART",
    tags:    ["lyric-video-abandoned-cart"],
  });
}
