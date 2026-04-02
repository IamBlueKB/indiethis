import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/explore/digital-products
// Returns published DigitalProducts from all artists
export async function GET() {
  const products = await db.digitalProduct.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      type: true,
      price: true,
      coverArtUrl: true,
      tracks: {
        select: { id: true, title: true, fileUrl: true, coverArtUrl: true },
        orderBy: { createdAt: "asc" },
      },
      user: {
        select: {
          id: true,
          name: true,
          artistName: true,
          artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
    },
  });

  // Ensure tracks is always an array (defensive — Prisma should always return [] for empty relations)
  const normalized = products.map(p => ({ ...p, tracks: p.tracks ?? [] }));

  return NextResponse.json({ products: normalized });
}
