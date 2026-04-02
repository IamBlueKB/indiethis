import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const SELECT = {
  id:              true,
  title:           true,
  imageUrl:        true,
  imageUrls:       true,
  fulfillmentType: true,
  isFeatured:      true,
  artist: {
    select: {
      id:          true,
      name:        true,
      artistName:  true,
      artistSlug:  true,
      artistSite:  { select: { isPublished: true } },
    },
  },
  variants: {
    where:   { inStock: true },
    orderBy: { retailPrice: "asc" as const },
    select:  { id: true, retailPrice: true },
    take:    1,
  },
} as const;

export async function GET() {
  const [featuredRaw, regularRaw] = await Promise.all([
    // Featured: PLATFORM_ADMIN-pinned products — bypass isPublished filter
    db.merchProduct.findMany({
      where:   { isActive: true, isFeatured: true },
      orderBy: { createdAt: "desc" },
      take:    12,
      select:  SELECT,
    }),
    // Regular: only from artists with published sites
    db.merchProduct.findMany({
      where:   { isActive: true, isFeatured: false },
      orderBy: { createdAt: "desc" },
      take:    24,
      select:  SELECT,
    }),
  ]);

  const featured = featuredRaw.filter((p) => p.artist.artistSlug);
  const products = regularRaw.filter(
    (p) => p.artist.artistSite?.isPublished && p.artist.artistSlug,
  );

  return NextResponse.json({ featured, products });
}
