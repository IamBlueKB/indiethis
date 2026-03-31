import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const products = await db.merchProduct.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      imageUrls: true,
      fulfillmentType: true,
      artist: {
        select: {
          id: true,
          name: true,
          artistName: true,
          artistSlug: true,
          artistSite: { select: { isPublished: true } },
        },
      },
      variants: {
        where:   { inStock: true },
        orderBy: { retailPrice: "asc" },
        select:  { id: true, retailPrice: true },
        take:    1,
      },
    },
  });

  // Only return products from artists with published sites
  const visible = products.filter(
    (p) => p.artist.artistSite?.isPublished && p.artist.artistSlug,
  );

  return NextResponse.json({ products: visible });
}
