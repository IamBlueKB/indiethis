import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { sendEmail } from "@/lib/brevo/email";

const PLAY_MILESTONES = [100, 500, 1000];

// POST /api/public/stream-lease-play
// Records a play event for a stream-leased track.
// Deduplicates by IP hash within a 30-minute window.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { leaseId } = body as { leaseId?: string };

  if (!leaseId) {
    return NextResponse.json({ ok: false, error: "leaseId required" }, { status: 400 });
  }

  // Verify lease exists and is active
  const lease = await db.streamLease.findUnique({
    where: { id: leaseId },
    select: { id: true, isActive: true },
  });

  if (!lease || !lease.isActive) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  // Hash the IP for privacy — combine with secret so hashes can't be reversed
  const ip = (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
  const secret = process.env.NEXTAUTH_SECRET ?? "stream-play-salt";
  const viewerIpHash = crypto
    .createHash("sha256")
    .update(ip + secret + leaseId)
    .digest("hex")
    .slice(0, 32);

  // 30-minute deduplication: same IP hash + lease within window
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const existing = await db.streamLeasePlay.findFirst({
    where: {
      streamLeaseId: leaseId,
      viewerIpHash,
      playedAt: { gte: thirtyMinAgo },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, counted: false });
  }

  await db.streamLeasePlay.create({
    data: { streamLeaseId: leaseId, viewerIpHash },
  });

  // Milestone check — fire emails async so the response doesn't block
  void (async () => {
    try {
      const totalPlays = await db.streamLeasePlay.count({ where: { streamLeaseId: leaseId } });

      if (!PLAY_MILESTONES.includes(totalPlays)) return;

      const leaseFull = await db.streamLease.findUnique({
        where: { id: leaseId },
        select: {
          trackTitle: true,
          beat:     { select: { title: true } },
          artist:   { select: { email: true, name: true, artistName: true, artistSlug: true } },
          producer: { select: { email: true, name: true, artistName: true } },
        },
      });
      if (!leaseFull) return;

      const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
      const artistName   = leaseFull.artist.artistName  ?? leaseFull.artist.name;
      const producerName = leaseFull.producer.artistName ?? leaseFull.producer.name;
      const playsStr     = totalPlays.toLocaleString();
      const artistPage   = leaseFull.artist.artistSlug
        ? `${appUrl}/${leaseFull.artist.artistSlug}`
        : appUrl;

      const milestoneHtml = (recipientName: string, headline: string, body: string, ctaUrl: string, ctaLabel: string) =>
        `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111;background:#fff">
  <div style="background:#E85D4A;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center">
    <p style="color:#fff;font-size:13px;font-weight:600;margin:0;letter-spacing:.08em;text-transform:uppercase">Stream Lease Milestone</p>
    <p style="color:#fff;font-size:28px;font-weight:800;margin:8px 0 0">${playsStr} Plays 🎉</p>
  </div>
  <p style="font-size:15px;line-height:1.6;margin-bottom:12px">Hi ${recipientName},</p>
  <p style="font-size:15px;line-height:1.6;margin-bottom:24px">${body}</p>
  <a href="${ctaUrl}" style="display:inline-block;background:#E85D4A;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px">${ctaLabel}</a>
  <p style="font-size:12px;color:#888;margin-top:32px">IndieThis · <a href="${appUrl}" style="color:#D4A843">indiethis.com</a></p>
</body>
</html>`;

      // Email artist
      if (leaseFull.artist.email) {
        void sendEmail({
          to:      { email: leaseFull.artist.email, name: artistName },
          subject: `🎉 "${leaseFull.trackTitle}" just hit ${playsStr} plays on IndieThis!`,
          htmlContent: milestoneHtml(
            artistName,
            `${playsStr} Plays`,
            `Your track <strong>"${leaseFull.trackTitle}"</strong> just hit <strong>${playsStr} plays</strong> on IndieThis. Keep it going!`,
            artistPage,
            "View Your Page"
          ),
          tags: ["stream-lease-milestone", "artist"],
        }).catch(console.error);
      }

      // Email producer
      if (leaseFull.producer.email) {
        void sendEmail({
          to:      { email: leaseFull.producer.email, name: producerName },
          subject: `${artistName}'s track on your beat "${leaseFull.beat.title}" just hit ${playsStr} plays`,
          htmlContent: milestoneHtml(
            producerName,
            `${playsStr} Plays`,
            `<strong>${artistName}</strong>'s track recorded on your beat <strong>"${leaseFull.beat.title}"</strong> just hit <strong>${playsStr} plays</strong> on IndieThis.`,
            artistPage,
            `Listen to ${artistName}'s Track`
          ),
          tags: ["stream-lease-milestone", "producer"],
        }).catch(console.error);
      }
    } catch (err) {
      console.error("[stream-lease-play] milestone notification error:", err);
    }
  })();

  return NextResponse.json({ ok: true, counted: true });
}
