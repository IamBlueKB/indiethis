import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/explore/sample-packs
// Returns published sample packs for the explore page
export async function GET() {
  const packs = await prisma.digitalProduct.findMany({
    where:   { type: "SAMPLE_PACK", published: true },
    orderBy: [{ purchases: { _count: "desc" } }, { createdAt: "desc" }],
    take:    24,
    select: {
      id: true, title: true, price: true, genre: true,
      coverArtUrl: true, sampleCount: true, previewSampleUrls: true,
      user: {
        select: {
          id:         true,
          name:       true,
          artistName: true,
          artistSlug: true,
        },
      },
    },
  });

  return NextResponse.json({
    packs: packs.map((p) => ({
      id:                p.id,
      title:             p.title,
      price:             p.price,
      genre:             p.genre,
      coverArtUrl:       p.coverArtUrl,
      sampleCount:       p.sampleCount,
      previewSampleUrls: p.previewSampleUrls as string[] | null,
      artist: {
        id:         p.user.id,
        name:       p.user.name,
        artistName: p.user.artistName,
        artistSlug: p.user.artistSlug,
      },
    })),
  });
}
