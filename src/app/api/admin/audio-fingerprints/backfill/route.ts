import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fingerprintTrack } from "@/lib/fingerprint";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Check admin role
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user?.role || !["SUPER_ADMIN", "OPS_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { page = 0 } = await req.json().catch(() => ({}));
  const batchSize = 50;

  // Tracks without fingerprints
  const tracks = await db.track.findMany({
    where: { fingerprint: { is: null }, fileUrl: { not: null } },
    select: { id: true, fileUrl: true },
    skip: page * batchSize,
    take: batchSize,
  });

  let processed = 0;
  for (const track of tracks) {
    if (!track.fileUrl) continue;
    await fingerprintTrack(track.id, track.fileUrl).catch(() => {});
    processed++;
  }

  const remaining = await db.track.count({ where: { fingerprint: { is: null }, fileUrl: { not: null } } });

  return NextResponse.json({ processed, remaining, page, hasMore: remaining > 0 });
}
