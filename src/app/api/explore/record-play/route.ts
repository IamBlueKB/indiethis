import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/explore/record-play
 * Records a play in the user's recent history (auth required).
 * Body: { trackId: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false });

  const body = await req.json() as { trackId?: string };
  if (!body.trackId) return NextResponse.json({ ok: false });

  // Upsert by deleting old entry and creating new (to update playedAt)
  await db.recentPlay.deleteMany({
    where: { userId: session.user.id, trackId: body.trackId },
  });
  await db.recentPlay.create({
    data: { userId: session.user.id, trackId: body.trackId },
  });

  // Keep only 20 most recent plays per user
  const all = await db.recentPlay.findMany({
    where: { userId: session.user.id },
    orderBy: { playedAt: "desc" },
    select: { id: true },
  });
  if (all.length > 20) {
    const toDelete = all.slice(20).map((p) => p.id);
    await db.recentPlay.deleteMany({ where: { id: { in: toDelete } } });
  }

  return NextResponse.json({ ok: true });
}
