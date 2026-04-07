/**
 * src/lib/agents/video-conversion.ts
 *
 * Video Conversion Agent — converts non-subscriber video buyers into subscribers
 * via a 4-email drip sequence.
 *
 * Email schedule (relative to video completedAt):
 *   Email 1 — immediate  (delivery + soft CTA)
 *   Email 2 — +48 hours  (subscription value pitch)
 *   Email 3 — +5 days    (social proof)
 *   Email 4 — +10 days   (50% off promo — only if any email was opened/clicked)
 *
 * Rules:
 *   - Only fires for videos where userId IS NULL (non-subscribers)
 *   - Stops immediately if the guestEmail creates a subscriber account
 *   - Skips Email 4 if conversionAnyOpened = false
 *   - Each video gets a unique single-use Stripe promo code for Email 4
 */

import { db }             from "@/lib/db";
import { stripe }         from "@/lib/stripe";
import { logAgentAction } from "@/lib/agents";
import { sendBrandedEmail } from "@/lib/brevo/email";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

// ─── Result type ────────────────────────────────────────────────────────────────

export interface VideoConversionResult {
  acted:    number;
  email1:   number;
  email2:   number;
  email3:   number;
  email4:   number;
  stopped:  number;
}

// ─── Main agent function ─────────────────────────────────────────────────────────

export async function runVideoConversionAgent(): Promise<VideoConversionResult> {
  const result: VideoConversionResult = {
    acted: 0, email1: 0, email2: 0, email3: 0, email4: 0, stopped: 0,
  };

  const now       = new Date();
  const cutoffMs  = 10 * 24 * 60 * 60 * 1000; // 10 days
  const cutoff    = new Date(now.getTime() - cutoffMs);

  // Find all non-subscriber completed videos still in the conversion sequence
  const videos = await db.musicVideo.findMany({
    where: {
      userId:          null,
      status:          "COMPLETE",
      conversionDone:  false,
      guestEmail:      { not: null },
      updatedAt:       { gte: cutoff }, // only care about recent ones
      OR: [
        { conversionStep: 0 },                                  // Email 1 not sent
        { conversionStep: { lt: 4 }, conversionNextAt: { lte: now } }, // next email is due
      ],
    },
    select: {
      id:                  true,
      trackTitle:          true,
      guestEmail:          true,
      amount:              true,
      mode:                true,
      finalVideoUrl:       true,
      finalVideoUrls:      true,
      conversionStep:      true,
      conversionNextAt:    true,
      conversionPromoCode: true,
      conversionAnyOpened: true,
      updatedAt:           true,
    },
  });

  for (const video of videos) {
    const { guestEmail } = video;
    if (!guestEmail) continue;

    // Build a narrowed object with guestEmail as `string` (TypeScript-safe)
    const v = { ...video, guestEmail };

    try {
      // Check if this email is now a subscriber — stop if so
      const isSubscriber = await db.user.findFirst({
        where: {
          email:        guestEmail,
          subscription: { status: "ACTIVE" },
        },
        select: { id: true },
      });

      if (isSubscriber) {
        await db.musicVideo.update({
          where: { id: v.id },
          data:  { conversionDone: true },
        });
        result.stopped++;
        result.acted++;
        await logAgentAction("VIDEO_CONVERSION", "SEQUENCE_STOPPED_SUBSCRIBED", "MusicVideo", v.id, {
          email: guestEmail,
        });
        continue;
      }

      const step = v.conversionStep;

      if (step === 0) {
        await sendEmail1(v);
        await db.musicVideo.update({
          where: { id: v.id },
          data:  {
            conversionStep:   1,
            conversionNextAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
        result.email1++;
        result.acted++;

      } else if (step === 1) {
        await sendEmail2(v);
        await db.musicVideo.update({
          where: { id: v.id },
          data:  {
            conversionStep:   2,
            conversionNextAt: new Date(Date.now() + (5 * 24 - 2) * 60 * 60 * 1000),
          },
        });
        result.email2++;
        result.acted++;

      } else if (step === 2) {
        await sendEmail3(v);
        await db.musicVideo.update({
          where: { id: v.id },
          data:  {
            conversionStep:   3,
            conversionNextAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          },
        });
        result.email3++;
        result.acted++;

      } else if (step === 3) {
        if (!v.conversionAnyOpened) {
          await db.musicVideo.update({
            where: { id: v.id },
            data:  { conversionDone: true, conversionStep: 4 },
          });
          result.stopped++;
          result.acted++;
          await logAgentAction("VIDEO_CONVERSION", "EMAIL4_SKIPPED_NO_OPENS", "MusicVideo", v.id, {
            email: guestEmail,
          });
        } else {
          const promoCode = await createPromoCode(v.id);
          await sendEmail4(v, promoCode);
          await db.musicVideo.update({
            where: { id: v.id },
            data:  {
              conversionStep:      4,
              conversionDone:      true,
              conversionPromoCode: promoCode,
            },
          });
          result.email4++;
          result.acted++;
        }
      }

      await logAgentAction("VIDEO_CONVERSION", `EMAIL${step + 1}_SENT`, "MusicVideo", v.id, {
        email:          guestEmail,
        trackTitle:     v.trackTitle,
        conversionStep: step + 1,
      });

    } catch (err) {
      console.error(`[video-conversion] failed for video ${v.id}:`, err);
      await logAgentAction("VIDEO_CONVERSION", "EMAIL_SEND_ERROR", "MusicVideo", v.id, {
        error: String(err),
      });
    }
  }

  return result;
}

// ─── Promo code creation ─────────────────────────────────────────────────────────

async function createPromoCode(videoId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const couponId = `mvideo-50pct-${videoId.slice(-8)}`;
  const codeStr  = `MVIDEO${videoId.slice(-6).toUpperCase()}`;

  // Create coupon (idempotent — same ID is fine if it already exists)
  try {
    await stripe.coupons.create({
      id:          couponId,
      name:        "Music Video 50% Off — First Month",
      percent_off: 50,
      duration:    "once",
      metadata:    { musicVideoId: videoId, source: "video_conversion_agent" },
    });
  } catch (err: unknown) {
    // Idempotency: coupon may already exist if agent ran twice
    if (!(err instanceof Error && err.message.includes("already exists"))) {
      console.warn("[video-conversion] coupon create warning:", err);
    }
  }

  // Create single-use promotional code expiring in 48 hours
  try {
    const expires = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
    await stripe.promotionCodes.create({
      promotion:       { coupon: couponId, type: "coupon" },
      code:            codeStr,
      max_redemptions: 1,
      expires_at:      expires,
      metadata:        { musicVideoId: videoId },
    });
  } catch (err: unknown) {
    // May already exist
    if (!(err instanceof Error && err.message.includes("already exists"))) {
      console.warn("[video-conversion] promo code create warning:", err);
    }
  }

  return codeStr;
}

// ─── Tracking URL builder ─────────────────────────────────────────────────────────

function trackUrl(videoId: string, dest: string): string {
  const base    = APP_URL();
  const encoded = encodeURIComponent(dest);
  return `${base}/api/video-studio/track/click?v=${videoId}&url=${encoded}`;
}

// ─── Email 1: Video delivery + soft upsell ──────────────────────────────────────

/** Exported so generate.ts can fire Email 1 immediately at completion time. */
export async function sendVideoConversionEmail1(video: {
  id: string; trackTitle: string; guestEmail: string; amount: number;
  mode: string; finalVideoUrl: string | null; finalVideoUrls: unknown;
}): Promise<void> {
  return sendEmail1(video);
}

async function sendEmail1(video: {
  id: string; trackTitle: string; guestEmail: string; amount: number;
  mode: string; finalVideoUrl: string | null; finalVideoUrls: unknown;
}): Promise<void> {
  const base       = APP_URL();
  const previewUrl = `${base}/video-studio/${video.id}/preview`;
  const trackedUrl = trackUrl(video.id, previewUrl);
  const amountStr  = `$${(video.amount / 100).toFixed(2)}`;

  await sendBrandedEmail({
    to:      { email: video.guestEmail, name: "Artist" },
    subject: `Your music video is ready — "${video.trackTitle}"`,
    primaryContent: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">Your Music Video is Ready! 🎬</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Your ${video.mode === "DIRECTOR" ? "Director Mode" : "Quick Mode"} music video for
        <strong style="color:#fff;">&ldquo;${video.trackTitle}&rdquo;</strong> has been generated.
        Watch it, download the MP4, or share the link.
      </p>
      <a href="${trackedUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;margin-bottom:28px;">
        Watch Your Video &rarr;
      </a>

      <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Here's what artists do next</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px;background:#111;border:1px solid #222;border-radius:8px;vertical-align:top;">
            <p style="color:#D4A843;font-size:12px;font-weight:700;margin:0 0 4px;">Upload to YouTube</p>
            <p style="color:#888;font-size:11px;margin:0;">Your video is MP4 ready. Add it to your channel with one click.</p>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:10px;background:#111;border:1px solid #222;border-radius:8px;vertical-align:top;">
            <p style="color:#D4A843;font-size:12px;font-weight:700;margin:0 0 4px;">Matching Cover Art</p>
            <p style="color:#888;font-size:11px;margin:0;">Generate AI cover art in the same visual style from $4.99.</p>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:10px;background:#111;border:1px solid #222;border-radius:8px;vertical-align:top;">
            <p style="color:#D4A843;font-size:12px;font-weight:700;margin:0 0 4px;">Share the Link</p>
            <p style="color:#888;font-size:11px;margin:0;">Your preview page is shareable. Drop it in your bio.</p>
          </td>
        </tr>
      </table>

      <p style="color:#666;font-size:12px;margin:24px 0 0;text-align:center;">
        <a href="${trackUrl(video.id, base)}" style="color:#D4A843;text-decoration:none;">Explore IndieThis &rarr;</a>
      </p>
    `,
    context: "VIDEO_CONVERSION_EMAIL1",
    tags:    ["video-conversion", "email1"],
  });
}

// ─── Email 2: Subscription value pitch ───────────────────────────────────────────

async function sendEmail2(video: {
  id: string; trackTitle: string; guestEmail: string; amount: number;
}): Promise<void> {
  const base       = APP_URL();
  const trackedPricing = trackUrl(video.id, `${base}/pricing`);
  const amountPaid = `$${(video.amount / 100).toFixed(2)}`;

  await sendBrandedEmail({
    to:      { email: video.guestEmail, name: "Artist" },
    subject: `You made a video. Now sell the track.`,
    primaryContent: `
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px;">You paid ${amountPaid} for one video.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        A Launch subscription is <strong style="color:#fff;">$19/month</strong> and includes a video every month
        — plus cover art, mastering, press kits, merch store, and your own artist page.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <th style="padding:10px 14px;text-align:left;background:#111;border:1px solid #222;color:#888;font-size:11px;font-weight:600;text-transform:uppercase;">Feature</th>
          <th style="padding:10px 14px;text-align:center;background:#111;border:1px solid #222;color:#888;font-size:11px;font-weight:600;text-transform:uppercase;">One-time</th>
          <th style="padding:10px 14px;text-align:center;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.2);color:#D4A843;font-size:11px;font-weight:600;text-transform:uppercase;">Launch $19/mo</th>
        </tr>
        <tr>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#ccc;font-size:13px;">Music videos</td>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#888;font-size:13px;text-align:center;">$14.99–$24.99 each</td>
          <td style="padding:8px 14px;border:1px solid rgba(212,168,67,0.15);color:#D4A843;font-size:13px;text-align:center;background:rgba(212,168,67,0.04);">1 included/mo</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#ccc;font-size:13px;">AI cover art</td>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#888;font-size:13px;text-align:center;">$4.99</td>
          <td style="padding:8px 14px;border:1px solid rgba(212,168,67,0.15);color:#D4A843;font-size:13px;text-align:center;background:rgba(212,168,67,0.04);">Unlimited</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#ccc;font-size:13px;">Mastering</td>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#888;font-size:13px;text-align:center;">$9.99/track</td>
          <td style="padding:8px 14px;border:1px solid rgba(212,168,67,0.15);color:#D4A843;font-size:13px;text-align:center;background:rgba(212,168,67,0.04);">Included</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#ccc;font-size:13px;">Artist page + merch store</td>
          <td style="padding:8px 14px;border:1px solid #1e1e1e;color:#888;font-size:13px;text-align:center;">—</td>
          <td style="padding:8px 14px;border:1px solid rgba(212,168,67,0.15);color:#D4A843;font-size:13px;text-align:center;background:rgba(212,168,67,0.04);">Included</td>
        </tr>
      </table>

      <a href="${trackedPricing}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        See All Plans &rarr;
      </a>
    `,
    context: "VIDEO_CONVERSION_EMAIL2",
    tags:    ["video-conversion", "email2"],
  });
}

// ─── Email 3: Social proof ────────────────────────────────────────────────────────

async function sendEmail3(video: {
  id: string; trackTitle: string; guestEmail: string;
}): Promise<void> {
  const base           = APP_URL();
  const trackedPricing = trackUrl(video.id, `${base}/pricing`);

  await sendBrandedEmail({
    to:      { email: video.guestEmail, name: "Artist" },
    subject: `Artists on IndieThis are building their careers`,
    primaryContent: `
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px;">Real artists. Real releases.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Every week, artists on IndieThis release tracks with AI-generated cover art, music videos, and press kits —
        then sell merch directly to their fans. One platform. No middlemen.
      </p>

      <div style="background:#111;border:1px solid #222;border-radius:12px;padding:16px;margin-bottom:16px;">
        <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 6px;">"I dropped three singles this month for less than I used to spend on one photo shoot."</p>
        <p style="color:#666;font-size:12px;margin:0;">— Launch subscriber, electronic artist</p>
      </div>
      <div style="background:#111;border:1px solid #222;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#D4A843;font-size:13px;font-weight:700;margin:0 0 6px;">"The music video I made here got more engagement than anything I've posted this year."</p>
        <p style="color:#666;font-size:12px;margin:0;">— Indie artist, R&amp;B/Soul</p>
      </div>

      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Your video for <strong style="color:#fff;">&ldquo;${video.trackTitle}&rdquo;</strong> is already live.
        Join the artists who never stop creating.
      </p>
      <a href="${trackedPricing}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;">
        Join IndieThis &rarr;
      </a>
    `,
    context: "VIDEO_CONVERSION_EMAIL3",
    tags:    ["video-conversion", "email3"],
  });
}

// ─── Email 4: 50% off promo ────────────────────────────────────────────────────────

async function sendEmail4(video: {
  id: string; trackTitle: string; guestEmail: string;
}, promoCode: string): Promise<void> {
  const base           = APP_URL();
  const trackedPricing = trackUrl(video.id, `${base}/pricing?promo=${promoCode}`);

  await sendBrandedEmail({
    to:      { email: video.guestEmail, name: "Artist" },
    subject: `One-time offer: 50% off your first month`,
    primaryContent: `
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px;">A last thing before we go.</h1>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
        You made a music video. You know what IndieThis can do.
        We want to make it easy to stay.
      </p>

      <div style="background:rgba(212,168,67,0.08);border:2px solid rgba(212,168,67,0.3);border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
        <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Your exclusive promo code</p>
        <p style="color:#D4A843;font-size:28px;font-weight:900;letter-spacing:0.1em;margin:0 0 8px;">${promoCode}</p>
        <p style="color:#888;font-size:12px;margin:0;">50% off your first month of Launch &mdash; expires in 48 hours</p>
      </div>

      <p style="color:#ccc;font-size:13px;line-height:1.6;margin:0 0 6px;">Launch plan includes:</p>
      <ul style="color:#ccc;font-size:13px;line-height:2;margin:0 0 20px;padding-left:20px;">
        <li>1 music video per month (normally $19.99)</li>
        <li>Unlimited AI cover art + mastering</li>
        <li>Press kit generation</li>
        <li>Merch store + artist page</li>
        <li>Distribution tools</li>
      </ul>

      <a href="${trackedPricing}" style="background:#D4A843;color:#0A0A0A;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:15px;">
        Claim 50% Off ($9.50 first month) &rarr;
      </a>
      <p style="color:#666;font-size:11px;margin:12px 0 0;">Code expires in 48 hours. One-time use. Applied at checkout.</p>
    `,
    context: "VIDEO_CONVERSION_EMAIL4",
    tags:    ["video-conversion", "email4", "promo"],
  });
}

// ─── Abandoned Cart Agent ─────────────────────────────────────────────────────
//
// Fires once for any MusicVideo where:
//   - guestEmail is set (non-subscriber collected email via gate)
//   - status is PENDING (wizard started but payment never completed)
//   - createdAt > 24 hours ago
//   - abandonedCartSent is false
//
// Sends one "Your music video is waiting" email with a resume link.
// Resume link: /video-studio?resume=[id] — VideoStudioClient reads this to pre-fill
// the wizard with the track/style/format from the saved record.

export interface AbandonedCartResult {
  checked:  number;
  sent:     number;
  skipped:  number;
}

export async function runAbandonedCartAgent(): Promise<AbandonedCartResult> {
  const result: AbandonedCartResult = { checked: 0, sent: 0, skipped: 0 };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
  const maxAge = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7d ago — don't bother after a week

  const abandoned = await db.musicVideo.findMany({
    where: {
      guestEmail:        { not: null },
      status:            "PENDING",
      abandonedCartSent: false,
      createdAt:         { lte: cutoff, gte: maxAge },
    },
    select: {
      id:         true,
      trackTitle: true,
      guestEmail: true,
      mode:       true,
      style:      true,
      aspectRatio: true,
      createdAt:  true,
    },
  });

  result.checked = abandoned.length;

  for (const video of abandoned) {
    const { guestEmail } = video;
    if (!guestEmail) { result.skipped++; continue; }

    try {
      // Check if email already converted (signed up + subscribed)
      const isSubscriber = await db.user.findFirst({
        where:  { email: guestEmail, subscription: { status: "ACTIVE" } },
        select: { id: true },
      });
      if (isSubscriber) {
        // Mark sent so we don't check again
        await db.musicVideo.update({
          where: { id: video.id },
          data:  { abandonedCartSent: true },
        });
        result.skipped++;
        continue;
      }

      const base      = APP_URL();
      const resumeUrl = `${base}/video-studio?start=1&resume=${video.id}&mode=${video.mode}`;

      await sendBrandedEmail({
        to:      { email: guestEmail, name: "Artist" },
        subject: `Your music video is waiting — "${video.trackTitle}"`,
        primaryContent: `
          <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 12px;">You started something. Let's finish it. 🎬</h1>
          <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">
            You uploaded your track <strong style="color:#fff;">&ldquo;${video.trackTitle}&rdquo;</strong>
            to the Music Video Studio — but your video never started generating.
          </p>
          <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Your settings are saved. Pick up right where you left off:
          </p>

          <a href="${resumeUrl}" style="background:#D4A843;color:#0A0A0A;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;font-size:14px;margin-bottom:28px;">
            Resume My Video &rarr;
          </a>

          <div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Your session</p>
            <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 4px;">${video.trackTitle}</p>
            <p style="color:#888;font-size:12px;margin:0;">
              ${video.mode === "DIRECTOR" ? "Director Mode" : "Quick Mode"}
              ${video.style ? ` &middot; ${video.style} style` : ""}
              ${video.aspectRatio ? ` &middot; ${video.aspectRatio}` : ""}
            </p>
          </div>

          <p style="color:#888;font-size:12px;line-height:1.6;margin:0 0 0;">
            Quick Mode videos start at <strong style="color:#D4A843;">$14.99</strong> and are ready in about 15 minutes.
            No account needed — just complete checkout and we&apos;ll email you the finished MP4.
          </p>
        `,
        context: "ABANDONED_CART",
        tags:    ["abandoned-cart", "video-studio"],
      });

      await db.musicVideo.update({
        where: { id: video.id },
        data:  { abandonedCartSent: true },
      });

      await logAgentAction("VIDEO_CONVERSION", "ABANDONED_CART_SENT", "MusicVideo", video.id, {
        email:      guestEmail,
        trackTitle: video.trackTitle,
      });

      result.sent++;
    } catch (err) {
      console.error(`[abandoned-cart] failed for video ${video.id}:`, err);
      await logAgentAction("VIDEO_CONVERSION", "ABANDONED_CART_ERROR", "MusicVideo", video.id, {
        error: String(err),
      });
      result.skipped++;
    }
  }

  return result;
}
