import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/producer/licensing
// Returns all beat license sales where the current user is the producer.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId     = session.user.id as string;
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const licenses = await db.beatLicense.findMany({
    where:   { producerId: userId },
    include: {
      track:  { select: { id: true, title: true, coverArtUrl: true } },
      artist: { select: { id: true, name: true, artistName: true, artistSlug: true, photo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Stats
  const totalSales       = licenses.length;
  const totalRevenue     = licenses.reduce((s, l) => s + l.price, 0);
  const thisMonthRevenue = licenses
    .filter((l) => new Date(l.createdAt) >= monthStart)
    .reduce((s, l) => s + l.price, 0);
  const avgSalePrice     = totalSales > 0 ? totalRevenue / totalSales : 0;

  const rows = licenses.map((l) => ({
    id:          l.id,
    createdAt:   l.createdAt,
    beat: {
      id:          l.track.id,
      title:       l.track.title,
      coverArtUrl: l.track.coverArtUrl,
    },
    buyer: {
      id:         l.artist.id,
      name:       l.artist.artistName ?? l.artist.name,
      artistSlug: l.artist.artistSlug,
      photo:      l.artist.photo,
    },
    licenseType: l.licenseType,
    price:       l.price,
    pdfUrl:      l.pdfUrl,
    status:      l.status,
  }));

  return NextResponse.json({
    licenses: rows,
    stats: { totalSales, totalRevenue, thisMonthRevenue, avgSalePrice },
  });
}
