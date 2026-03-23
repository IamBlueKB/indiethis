import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/producer/beats
// Returns all beats this user has uploaded, with per-beat stats and global producer stats.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const [beats, totalRevenue] = await Promise.all([
    db.track.findMany({
      where: { artistId: userId },
      include: {
        beatLeaseSettings: true,
        streamLeases: {
          select: {
            id: true,
            isActive: true,
            plays: { select: { id: true } },
          },
        },
        beatLicenses: { select: { id: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.streamLeasePayment.aggregate({
      where: { producerId: userId, status: "PAID" },
      _sum: { producerAmount: true },
    }),
  ]);

  // Augment each beat with computed stats
  const beatsWithStats = beats.map((beat) => {
    const activeLeases = beat.streamLeases.filter((l) => l.isActive);
    const totalPlays   = beat.streamLeases.reduce((sum, l) => sum + l.plays.length, 0);
    const licensesCount = beat.beatLicenses.length;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { streamLeases, beatLicenses, ...beatData } = beat;
    return {
      ...beatData,
      activeLeaseCount: activeLeases.length,
      totalLeaseCount:  beat.streamLeases.length,
      licensesCount,
      totalPlays,
    };
  });

  // Global producer stats
  const totalBeats        = beats.length;
  const totalActiveLeases = beats.reduce((sum, b) => sum + b.streamLeases.filter((l) => l.isActive).length, 0);
  const totalLicenses     = beats.reduce((sum, b) => sum + b.beatLicenses.length, 0);
  const totalRevenueAmount = totalRevenue._sum.producerAmount ?? 0;

  return NextResponse.json({
    beats: beatsWithStats,
    stats: {
      totalBeats,
      totalActiveLeases,
      totalLicenses,
      totalRevenue: totalRevenueAmount,
    },
  });
}
