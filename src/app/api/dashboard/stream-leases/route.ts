import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/brevo/email";
import { getStreamLeasePricing } from "@/lib/stream-lease-pricing";

// ─── Agreement HTML Generator ─────────────────────────────────────────────────

function generateAgreementHtml(params: {
  producerName: string;
  artistName: string;
  beatTitle: string;
  trackTitle: string;
  date: string;
  creditFormat: string;
  revocationPolicy: string;
  contentRestrictions: string[];
  customRestriction: string | null;
  monthlyPrice: number;
  producerShare: number;
  platformShare: number;
}): string {
  const {
    producerName, artistName, beatTitle, trackTitle, date,
    creditFormat, revocationPolicy, contentRestrictions, customRestriction,
    monthlyPrice, producerShare, platformShare,
  } = params;
  const producerCut = (monthlyPrice * producerShare).toFixed(2);
  const platformCut = (monthlyPrice * platformShare).toFixed(2);

  const revocationMap: Record<string, string> = {
    A: "Producer may revoke this Stream Lease at any time with 30 days notice. The Artist receives a notification and the Track is removed after 30 days. Any remaining paid time is not refunded.",
    B: "Producer may revoke this Stream Lease only if the Artist violates the terms of this agreement (e.g., distributes the Track outside IndieThis).",
    C: "Producer may not revoke this Stream Lease as long as the Artist is paying. The Stream Lease can only be ended by the Artist or by non-payment.",
  };
  const revocationText = revocationMap[revocationPolicy] ?? revocationMap["A"];

  const restrictionLabels: Record<string, string> = {
    NO_EXPLICIT: "No explicit lyrics",
    NO_VIOLENCE: "No content promoting violence, hate speech, or illegal activity",
  };
  const restrictionList = contentRestrictions
    .map((r) => restrictionLabels[r] ?? r)
    .filter(Boolean);
  if (customRestriction) restrictionList.push(customRestriction);

  const contentSection =
    restrictionList.length > 0
      ? `<p>The Producer has set the following content restrictions for Tracks made with their Beat:</p><ul>${restrictionList.map((r) => `<li>${r}</li>`).join("")}</ul><p>If the Artist's Track violates these restrictions, the Producer may revoke the Stream Lease immediately without notice.</p>`
      : `<p>The Producer allows any content on Tracks made with their Beat.</p>`;

  const credit = creditFormat.replace("{producerName}", producerName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body{font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#111;max-width:700px;margin:0 auto;padding:40px 20px}
  h1{font-size:20px;text-align:center;letter-spacing:.05em;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:24px}
  h2{font-size:15px;margin-top:28px;margin-bottom:8px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  td{padding:6px 10px;border:1px solid #ddd;vertical-align:top}
  td:first-child{font-weight:bold;width:140px;background:#f8f8f8}
  ul{margin:8px 0;padding-left:20px}
  li{margin-bottom:4px}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#555;text-align:center}
</style>
</head>
<body>
<h1>INDIETHIS STREAM LEASE AGREEMENT</h1>
<table>
  <tr><td>Date</td><td>${date}</td></tr>
  <tr><td>Producer</td><td>${producerName}</td></tr>
  <tr><td>Artist</td><td>${artistName}</td></tr>
  <tr><td>Beat Title</td><td>${beatTitle}</td></tr>
  <tr><td>Track Title</td><td>${trackTitle}</td></tr>
</table>

<h2>1. Grant of License</h2>
<p>Producer grants Artist a non-exclusive, limited license to use the Beat identified above solely for the purpose of recording one (1) song ("the Track") and streaming it exclusively on the IndieThis platform (indiethis.com). This license does NOT grant the Artist the right to distribute, sell, or stream the Track on any other platform, service, or medium, including but not limited to Spotify, Apple Music, YouTube, SoundCloud, TikTok, radio, television, film, or physical media.</p>

<h2>2. Term and Renewal</h2>
<p>This agreement is active on a month-to-month basis beginning on the date above. The license automatically renews each month as long as the Artist's $${monthlyPrice.toFixed(2)} monthly Stream Lease fee is paid through their IndieThis subscription. Either party may terminate this agreement at any time. The Artist may cancel the Stream Lease from their IndieThis dashboard; the Track remains live until the end of the current paid billing period, then is removed.</p>

<h2>3. Fee and Payment</h2>
<p>The Artist pays $${monthlyPrice.toFixed(2)} per month for this Stream Lease, billed as part of their IndieThis subscription invoice. Payment is split: $${producerCut} to the Producer, $${platformCut} to IndieThis as a platform fee.</p>

<h2>4. Ownership and Masters</h2>
<p>The Producer retains full ownership of the Beat, including all copyrights, publishing rights, and master rights to the Beat itself. The Artist owns the vocal performance and lyrics recorded over the Beat. The combined Track (Beat + vocals) is subject to this Stream Lease agreement and may only be used as permitted herein.</p>

<h2>5. Credits</h2>
<p>The Artist agrees to credit the Producer in the following format on the Track listing: <strong>${credit}</strong></p>

<h2>6. Usage Restrictions</h2>
<p>The Artist may NOT: upload or distribute the Track to any platform other than IndieThis; sell the Track in any format; license, sublicense, or transfer rights to the Track to any third party; use the Track in any commercial context without purchasing a full license from the Producer; claim ownership of the Beat; register the Beat with any performance rights organization (ASCAP, BMI, SESAC); or use the Beat in more than one Track under this agreement.</p>

<h2>7. Upgrade to Full License</h2>
<p>If the Artist wishes to distribute the Track beyond IndieThis, the Artist must purchase a full license from the Producer through the IndieThis Beat Marketplace. Upon purchasing a full license, this Stream Lease is automatically terminated, the $1/mo charge stops, and the full license terms supersede this agreement.</p>

<h2>8. Producer's Right to Revoke</h2>
<p>${revocationText}</p>

<h2>9. Content Standards</h2>
${contentSection}

<h2>10. Performance Data</h2>
<p>Both the Artist and Producer will have access to play count data for the Track through their respective IndieThis dashboards. This data includes total plays, plays over time, and listener geography (city-level). Neither party may publicly misrepresent this data.</p>

<h2>11. Indemnification</h2>
<p>The Artist represents that their vocal performance and lyrics are original work and do not infringe on the intellectual property rights of any third party. The Artist agrees to indemnify the Producer and IndieThis against any claims arising from the Artist's recorded content.</p>

<h2>12. Platform Terms</h2>
<p>This agreement is subject to the IndieThis Terms of Service. In the event of a conflict between this agreement and the IndieThis Terms of Service, the Terms of Service shall prevail.</p>

<h2>13. Acceptance</h2>
<p>By clicking "Confirm Stream Lease" on the IndieThis platform, both parties acknowledge that they have read, understood, and agree to the terms of this agreement. This digital acceptance constitutes a legally binding agreement.</p>
<p><strong>Producer:</strong> ${producerName} — Agreed upon listing the Beat with Stream Lease enabled<br><strong>Artist:</strong> ${artistName} — Agreed on ${date}</p>

<h2>14. Dispute Resolution</h2>
<p>Disputes arising from this agreement are first handled through IndieThis support (support@indiethis.com). If unresolved after a good-faith support process, disputes are resolved through binding arbitration in Cook County, Illinois, under the rules of the American Arbitration Association. Both parties waive the right to a jury trial and the right to participate in any class action lawsuit or class-wide arbitration.</p>

<div class="footer">Generated by IndieThis &middot; indiethis.com &middot; This document is a binding agreement</div>
</body>
</html>`;
}

// ─── POST — Create stream lease ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artistId = session.user.id;
  let body: { beatId?: string; trackTitle?: string; audioUrl?: string; coverUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { beatId, trackTitle, audioUrl, coverUrl } = body;
  if (!beatId || !trackTitle?.trim() || !audioUrl) {
    return NextResponse.json(
      { error: "beatId, trackTitle, and audioUrl are required" },
      { status: 400 }
    );
  }

  // 1. Validate beat and load producer settings
  const beat = await db.track.findUnique({
    where: { id: beatId },
    select: {
      id: true, title: true, artistId: true, coverArtUrl: true,
      beatLeaseSettings: true,
      artist: {
        select: {
          id: true, name: true, artistName: true, email: true,
          producerLeaseSettings: true,
        },
      },
    },
  });
  if (!beat) return NextResponse.json({ error: "Beat not found" }, { status: 404 });
  if (beat.artistId === artistId) {
    return NextResponse.json({ error: "You cannot create a stream lease on your own beat" }, { status: 400 });
  }

  // 2. Resolve effective settings: per-beat overrides global
  const perBeat = beat.beatLeaseSettings;
  const global  = beat.artist.producerLeaseSettings;
  const effective = {
    streamLeaseEnabled:  perBeat?.streamLeaseEnabled  ?? global?.streamLeaseEnabled  ?? true,
    maxStreamLeases:     perBeat?.maxStreamLeases     ?? null,  // only per-beat; no global equivalent
    creditFormat:        perBeat?.creditFormat        ?? global?.creditFormat        ?? "Prod. {producerName}",
    revocationPolicy:    perBeat?.revocationPolicy    ?? global?.revocationPolicy    ?? "A",
    contentRestrictions: perBeat?.contentRestrictions ?? global?.contentRestrictions ?? [],
    customRestriction:   perBeat?.customRestriction   ?? global?.customRestriction   ?? null,
  };

  if (!effective.streamLeaseEnabled) {
    return NextResponse.json(
      { error: "The producer has not enabled Stream Leases on this beat" },
      { status: 403 }
    );
  }

  // 3. Active subscription check
  const subscription = await db.subscription.findUnique({
    where: { userId: artistId },
    select: { status: true },
  });
  if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status)) {
    return NextResponse.json(
      { error: "An active IndieThis subscription is required to create a stream lease" },
      { status: 403 }
    );
  }

  // 4. Duplicate check
  const existing = await db.streamLease.findFirst({
    where: { artistId, beatId, isActive: true },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active stream lease on this beat" },
      { status: 409 }
    );
  }

  // 4b. Max stream leases cap (per-beat limit)
  if (effective.maxStreamLeases !== null) {
    const currentCount = await db.streamLease.count({
      where: { beatId, isActive: true },
    });
    if (currentCount >= effective.maxStreamLeases) {
      return NextResponse.json(
        { error: "This beat has reached its stream lease limit." },
        { status: 409 }
      );
    }
  }

  // 5. Artist billing info + pricing
  const [artist, pricing] = await Promise.all([
    db.user.findUnique({
      where: { id: artistId },
      select: { stripeCustomerId: true, name: true, artistName: true, artistSlug: true },
    }),
    getStreamLeasePricing(),
  ]);
  if (!artist?.stripeCustomerId || !stripe) {
    return NextResponse.json(
      { error: "No billing account found. Please complete your subscription setup." },
      { status: 400 }
    );
  }

  const producerName = beat.artist.artistName ?? beat.artist.name;
  const artistName   = artist.artistName      ?? artist.name;
  const acceptedAt   = new Date();
  const dateStr      = acceptedAt.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // 6. Generate agreement HTML snapshot
  const agreementHtml = generateAgreementHtml({
    producerName,
    artistName,
    beatTitle:           beat.title,
    trackTitle:          trackTitle.trim(),
    date:                dateStr,
    creditFormat:        effective.creditFormat,
    revocationPolicy:    effective.revocationPolicy,
    contentRestrictions: effective.contentRestrictions,
    customRestriction:   effective.customRestriction,
    monthlyPrice:        pricing.monthlyPriceDollars,
    producerShare:       pricing.producerShare,
    platformShare:       pricing.platformShare,
  });

  // 7. Create lease + agreement snapshot + Stripe invoice item
  let lease;
  try {
    lease = await db.streamLease.create({
      data: {
        artistId,
        beatId,
        producerId: beat.artistId,
        trackTitle: trackTitle.trim(),
        audioUrl,
        coverUrl:   coverUrl ?? beat.coverArtUrl ?? null,
        isActive:   true,
        agreement: {
          create: {
            agreementHtml,
            producerTerms:    effective as object,
            artistAcceptedAt: acceptedAt,
          },
        },
      },
      include: {
        beat:      { select: { id: true, title: true, coverArtUrl: true } },
        producer:  { select: { name: true, artistName: true } },
        agreement: { select: { id: true } },
      },
    });

    await stripe.invoiceItems.create({
      customer:    artist.stripeCustomerId,
      amount:      pricing.monthlyPriceCents,
      currency:    "usd",
      description: `Stream Lease: ${trackTitle.trim()} (beat: ${beat.title})`,
      metadata:    { streamLeaseId: lease.id, artistId, producerId: beat.artistId, beatId },
    });
  } catch (err) {
    if (lease?.id) {
      await db.streamLease.update({
        where: { id: lease.id },
        data:  { isActive: false, cancelledAt: new Date() },
      });
    }
    console.error("[stream-lease] creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create stream lease. Please try again." },
      { status: 500 }
    );
  }

  // Notify producer async — fire-and-forget, never block the response
  const producerEmail = beat.artist.email;
  const artistSlug    = artist.artistSlug;
  if (producerEmail) {
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
    const artistPage = artistSlug ? `${appUrl}/${artistSlug}` : appUrl;
    void sendEmail({
      to:      { email: producerEmail, name: producerName },
      subject: `${artistName} just recorded a song on your beat "${beat.title}"`,
      htmlContent: `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111;background:#fff">
  <div style="background:#E85D4A;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center">
    <p style="color:#fff;font-size:13px;font-weight:600;margin:0;letter-spacing:.08em;text-transform:uppercase">Stream Lease</p>
    <p style="color:#fff;font-size:22px;font-weight:700;margin:8px 0 0">New song on your beat!</p>
  </div>
  <p style="font-size:15px;line-height:1.6;margin-bottom:12px"><strong>${artistName}</strong> just created a Stream Lease on your beat <strong>${beat.title}</strong> and recorded a song: <em>${trackTitle.trim()}</em>.</p>
  <p style="font-size:15px;line-height:1.6;margin-bottom:24px">You'll earn $${(pricing.monthlyPriceDollars * pricing.producerShare).toFixed(2)} every month this lease is active. Listen to it on their page:</p>
  <a href="${artistPage}" style="display:inline-block;background:#E85D4A;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px">Visit ${artistName}'s Page</a>
  <p style="font-size:12px;color:#888;margin-top:32px">You received this because you're a producer on IndieThis. <a href="${appUrl}/studio/settings" style="color:#D4A843">Manage your notifications</a>.</p>
</body>
</html>`,
      tags: ["stream-lease-new", "producer-notification"],
    }).catch((err) => console.error("[stream-lease] producer notification failed:", err));
  }

  return NextResponse.json({ lease }, { status: 201 });
}

// ─── GET — Artist's leases ────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [leases, pricing] = await Promise.all([
    db.streamLease.findMany({
      where: {
        artistId: session.user.id,
        // Show active + recently cancelled (within 30 days); hide older cancelled
        OR: [
          { isActive: true },
          { isActive: false, cancelledAt: { gte: thirtyDaysAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        beat:      { select: { id: true, title: true, coverArtUrl: true } },
        producer:  { select: { name: true, artistName: true } },
        plays:     { select: { id: true } },
        agreement: { select: { id: true, artistAcceptedAt: true } },
      },
    }),
    getStreamLeasePricing(),
  ]);

  return NextResponse.json({
    leases: leases.map((l) => ({
      ...l,
      playCount: l.plays.length,
      plays:     undefined,
    })),
    monthlyPrice: pricing.monthlyPriceDollars,
  });
}
