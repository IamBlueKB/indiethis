import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/producer/stream-leases
// Returns all stream leases on the producer's beats, grouped by beat.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId  = session.user.id as string;
  const now     = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const beats = await db.track.findMany({
    where: { artistId: userId, streamLeases: { some: {} } },
    select: {
      id: true,
      title: true,
      coverArtUrl: true,
      streamLeases: {
        select: {
          id: true,
          trackTitle: true,
          audioUrl: true,
          coverUrl: true,
          isActive: true,
          activatedAt: true,
          cancelledAt: true,
          artist: {
            select: {
              id: true,
              name: true,
              artistName: true,
              artistSlug: true,
              photo: true,
            },
          },
          plays: {
            select: { id: true, playedAt: true },
          },
        },
        orderBy: { activatedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Augment leases with computed stats and filter beats that have leases
  const beatGroups = beats
    .map((beat) => {
      const leases = beat.streamLeases.map((lease) => ({
        id:           lease.id,
        trackTitle:   lease.trackTitle,
        audioUrl:     lease.audioUrl,
        coverUrl:     lease.coverUrl,
        isActive:     lease.isActive,
        activatedAt:  lease.activatedAt,
        cancelledAt:  lease.cancelledAt,
        artist: {
          id:          lease.artist.id,
          name:        lease.artist.artistName ?? lease.artist.name,
          artistSlug:  lease.artist.artistSlug,
          photo:       lease.artist.photo,
        },
        totalPlays:   lease.plays.length,
        playsThisMonth: lease.plays.filter((p) => new Date(p.playedAt) >= monthStart).length,
      }));

      const activeCount   = leases.filter((l) => l.isActive).length;
      const totalPlays    = leases.reduce((s, l) => s + l.totalPlays, 0);
      const playsThisMonth = leases.reduce((s, l) => s + l.playsThisMonth, 0);
      const monthlyIncome = activeCount * 0.70;

      return {
        beatId:        beat.id,
        beatTitle:     beat.title,
        coverArtUrl:   beat.coverArtUrl,
        activeCount,
        totalLeases:   leases.length,
        monthlyIncome,
        totalPlays,
        playsThisMonth,
        leases,
      };
    })
    .filter((b) => b.totalLeases > 0);

  // Global stats
  const totalActiveLeases  = beatGroups.reduce((s, b) => s + b.activeCount, 0);
  const monthlyIncome      = beatGroups.reduce((s, b) => s + b.monthlyIncome, 0);
  const totalPlaysThisMonth = beatGroups.reduce((s, b) => s + b.playsThisMonth, 0);
  const mostPopularBeat    = beatGroups.sort((a, b) => b.totalPlays - a.totalPlays)[0]?.beatTitle ?? null;

  // Re-sort groups by active count desc after computing stats
  beatGroups.sort((a, b) => b.activeCount - a.activeCount);

  return NextResponse.json({
    beatGroups,
    stats: { totalActiveLeases, monthlyIncome, totalPlaysThisMonth, mostPopularBeat },
  });
}
