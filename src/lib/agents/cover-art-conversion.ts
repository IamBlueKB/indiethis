/**
 * src/lib/agents/cover-art-conversion.ts
 *
 * Cover Art Conversion Agent — converts non-subscriber guests into subscribers
 * via a 4-email drip sequence.
 *
 * Email schedule (relative to job completedAt / updatedAt):
 *   Email 1 — immediate  (delivery: "Your cover art is ready!")
 *   Email 2 — +24 hours  (value pitch: monthly credits + other AI tools)
 *   Email 3 — +3 days    (social proof / platform features)
 *   Email 4 — +7 days    (30% off promo — only if any email was opened)
 *
 * Abandoned Cart Agent — fires once for PENDING jobs older than 2 hours with guestEmail
 *
 * Rules:
 *   - Only fires for CoverArtJob where userId IS NULL (guests)
 *   - Stops if the guestEmail creates a subscriber account
 *   - Skips Email 4 if conversionAnyOpened = false
 */

import { db }             from "@/lib/db";
import { stripe }         from "@/lib/stripe";
import { logAgentAction } from "@/lib/agents";
import { sendBrandedEmail } from "@/lib/brevo/email";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Result types ──────────────────────────────────────────────────────────────

export interface CoverArtConversionResult {
  acted:         number;
  email1:        number;
  email2:        number;
  email3:        number;
  email4:        number;
  stopped:       number;
}

export interface CoverArtAbandonedCartResult {
  acted:  number;
  emails: number;
}

// ─── Conversion Agent ─────────────────────────────────────────────────────────

export async function runCoverArtConversionAgent(): Promise<CoverArtConversionResult> {
  const result: CoverArtConversionResult = {
    acted: 0, email1: 0, email2: 0, email3: 0, email4: 0, stopped: 0,
  };

  const now    = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const jobs = await db.coverArtJob.findMany({
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
      tier:                true,
      selectedUrl:         true,
      variationUrls:       true,
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
        await db.coverArtJob.update({ where: { id: j.id }, data: { conversionDone: true } });
        result.stopped++; result.acted++;
        continue;
      }

      const step = j.conversionStep;

      if (step === 0) {
        await sendCoverArtEmail1(j);
        await db.coverArtJob.update({
          where: { id: j.id },
          data:  { conversionStep: 1, conversionNextAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        result.email1++; result.acted++;

      } else if (step === 1) {
        await sendCoverArtEmail2(j);
        await db.coverArtJob.update({
          where: { id: j.id },
          data:  { conversionStep: 2, conversionNextAt: new Date(Date.now() + (3 * 24 - 1) * 60 * 60 * 1000) },
        });
        result.email2++; result.acted++;

      } else if (step === 2) {
        await sendCoverArtEmail3(j);
        await db.coverArtJob.update({
          where: { id: j.id },
          data:  { conversionStep: 3, conversionNextAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) },
        });
        result.email3++; result.acted++;

      } else if (step === 3) {
        if (!j.conversionAnyOpened) {
          await db.coverArtJob.update({ where: { id: j.id }, data: { conversionDone: true, conversionStep: 4 } });
          result.stopped++; result.acted++;
        } else {
          const promoCode = await createCoverArtPromoCode(j.id);
          await sendCoverArtEmail4(j, promoCode);
          await db.coverArtJob.update({
            where: { id: j.id },
            data:  { conversionStep: 4, conversionDone: true, conversionPromoCode: promoCode },
          });
          result.email4++; result.acted++;
        }
      }

      await logAgentAction("COVER_ART_CONVERSION", `EMAIL${step + 1}_SENT`, "CoverArtJob", j.id, {
        email: guestEmail,
        step:  step + 1,
      });

    } catch (err) {
      console.error(`[cover-art-conversion] failed for job ${j.id}:`, err);
      await logAgentAction("COVER_ART_CONVERSION", "EMAIL_SEND_ERROR", "CoverArtJob", j.id, {
        error: String(err),
      });
    }
  }

  return result;
}

// ─── Abandoned Cart Agent ──────────────────────────────────────────────────────

export async function runCoverArtAbandonedCartAgent(): Promise<CoverArtAbandonedCartResult> {
  const result: CoverArtAbandonedCartResult = { acted: 0, emails: 0 };

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const tenDaysAgo  = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const jobs = await db.coverArtJob.findMany({
    where: {
      status:           "PENDING",
      guestEmail:       { not: null },
      abandonedCartSent: false,
      createdAt:        { lte: twoHoursAgo, gte: tenDaysAgo },
    },
    select: {
      id:         true,
      guestEmail: true,
      tier:       true,
      createdAt:  true,
    },
  });

  for (const job of jobs) {
    const { guestEmail } = job;
    if (!guestEmail) continue;

    try {
      await sendAbandonedCartEmail({ ...job, guestEmail });
      await db.coverArtJob.update({ where: { id: job.id }, data: { abandonedCartSent: true } });
      result.emails++; result.acted++;

      await logAgentAction("COVER_ART_ABANDONED_CART", "EMAIL_SENT", "CoverArtJob", job.id, {
        email: guestEmail,
      });
    } catch (err) {
      console.error(`[cover-art-abandoned-cart] failed for job ${job.id}:`, err);
    }
  }

  return result;
}

// ─── Promo code ────────────────────────────────────────────────────────────────

async function createCoverArtPromoCode(jobId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const couponId = `ca-30pct-${jobId.slice(-8)}`;
  const codeStr  = `ARTCA${jobId.slice(-6).toUpperCase()}`;

  try {
    await stripe.coupons.create({
      id:                 couponId,
      percent_off:        30,
      duration:           "once",
      max_redemptions:    1,
      redeem_by:          Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60, // 14 days
    });
  } catch { /* coupon may already exist */ }

  try {
    const expires = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
    await stripe.promotionCodes.create({
      promotion:       { coupon: couponId, type: "coupon" },
      code:            codeStr,
      max_redemptions: 1,
      expires_at:      expires,
      metadata:        { coverArtJobId: jobId },
    });
  } catch { /* code may already exist */ }

  return codeStr;
}

// ─── Email helpers ────────────────────────────────────────────────────────────

type JobRef = {
  id:         string;
  guestEmail: string;
  tier:       string;
  selectedUrl?: string | null;
  variationUrls?: unknown;
};

async function sendCoverArtEmail1(job: JobRef) {
  const appUrl = APP_URL();
  const artUrl = job.selectedUrl
    ?? (Array.isArray(job.variationUrls) ? (job.variationUrls as string[])[0] : null)
    ?? null;

  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "Your AI cover art is ready 🎨",
    primaryContent: `
      <p>Your ${job.tier.toLowerCase()} cover art has been generated!</p>
      ${artUrl ? `<p><img src="${artUrl}" alt="Cover art" style="max-width:300px;border-radius:12px;" /></p>` : ""}
      <p><a href="${appUrl}/cover-art?jobId=${job.id}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">View &amp; Download</a></p>
      <p style="color:#888;font-size:13px;">
        Want to generate cover art every month for free?
        <a href="${appUrl}/pricing" style="color:#D4A843;">Check out IndieThis plans &rarr;</a>
      </p>
    `,
    context: "COVER_ART_CONVERSION_EMAIL1",
    tags:    ["cover-art-conversion", "email1"],
  });
}

async function sendCoverArtEmail2(job: JobRef) {
  const appUrl = APP_URL();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "Get monthly cover art credits + 10 more AI tools",
    primaryContent: `
      <p>Glad you tried our Cover Art Studio!</p>
      <p>With an IndieThis subscription you get:</p>
      <ul>
        <li>Up to 15 free cover arts per month</li>
        <li>AI Mastering, Bio Generator, Press Kit, Lyric Videos</li>
        <li>Music distribution, merch store, fan funding, and more</li>
      </ul>
      <p><a href="${appUrl}/pricing" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">View Plans from $9.99/mo</a></p>
    `,
    context: "COVER_ART_CONVERSION_EMAIL2",
    tags:    ["cover-art-conversion", "email2"],
  });
}

async function sendCoverArtEmail3(job: JobRef) {
  const appUrl = APP_URL();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "Thousands of indie artists use IndieThis 🎵",
    primaryContent: `
      <p>Your cover art is just the beginning.</p>
      <p>Join thousands of independent artists who use IndieThis to release music, grow their audience, and get paid.</p>
      <ul>
        <li>Distribute to Spotify, Apple Music, and 150+ stores</li>
        <li>Sell beats, sample packs, and digital downloads</li>
        <li>Book studio sessions and manage clients</li>
      </ul>
      <p><a href="${appUrl}/explore" style="color:#D4A843;">Browse the IndieThis community &rarr;</a></p>
      <p><a href="${appUrl}/pricing" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Start for Free</a></p>
    `,
    context: "COVER_ART_CONVERSION_EMAIL3",
    tags:    ["cover-art-conversion", "email3"],
  });
}

async function sendCoverArtEmail4(job: JobRef, promoCode: string) {
  const appUrl = APP_URL();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "30% off your first month — just for you",
    primaryContent: `
      <p>You&apos;ve been creating great art. Here&apos;s a thank-you gift.</p>
      <p style="font-size:24px;font-weight:900;color:#D4A843;text-align:center;">${promoCode}</p>
      <p style="text-align:center;color:#888;">30% off your first month &mdash; expires in 14 days</p>
      <br />
      <p><a href="${appUrl}/pricing?promo=${promoCode}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Claim 30% Off</a></p>
    `,
    context: "COVER_ART_CONVERSION_EMAIL4",
    tags:    ["cover-art-conversion", "email4"],
  });
}

async function sendAbandonedCartEmail(job: { id: string; guestEmail: string; tier: string }) {
  const appUrl    = APP_URL();
  const tierLabel = job.tier.charAt(0) + job.tier.slice(1).toLowerCase();
  await sendBrandedEmail({
    to:      { email: job.guestEmail },
    subject: "Your cover art is waiting — finish your order",
    primaryContent: `
      <p>You were so close!</p>
      <p>You started a <strong>${tierLabel}</strong> cover art generation but didn&apos;t complete payment.</p>
      <p>Your style and prompt are saved. Just complete the payment to generate your artwork.</p>
      <p><a href="${appUrl}/cover-art" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Complete My Order</a></p>
      <p style="color:#888;font-size:12px;">
        Or <a href="${appUrl}/pricing" style="color:#D4A843;">subscribe for monthly credits</a>
      </p>
    `,
    context: "COVER_ART_ABANDONED_CART",
    tags:    ["cover-art-abandoned-cart"],
  });
}
