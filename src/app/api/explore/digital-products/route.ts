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

  return NextResponse.json({ products });
}
