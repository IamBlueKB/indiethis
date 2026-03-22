import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

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

  return NextResponse.json({ ok: true, counted: true });
}
