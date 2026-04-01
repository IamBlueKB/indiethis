import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/tracks/[id]/card-detail
// Returns credits, DJ crate count, and artist info.
// Public — no auth required.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const track = await db.track.findUnique({
    where: { id },
    select: {
      digitalProducts: {
        select: { id: true, producer: true, songwriter: true },
        take: 1,
      },
      _count: { select: { crateItems: true } },
      artist: {
        select: {
          photo:      true,
          artistSlug: true,
          name:       true,
          artistSite: {
            select: {
              bioContent:  true,
              genre:       true,
              role:        true,
              city:        true,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dp      = track.digitalProducts[0] ?? null;
  const site    = track.artist.artistSite;
  const pubSlug = site?.isPublished ? track.artist.artistSlug : null;

  return NextResponse.json({
    producer:         dp?.producer   ?? null,
    songwriter:       dp?.songwriter ?? null,
    digitalProductId: dp?.id        ?? null,
    crateCount:       track._count.crateItems,
    artistPhoto:      track.artist.photo ?? null,
    artistSlug:       pubSlug,
    artistBio:        site?.bioContent ?? null,
    artistGenre:      site?.genre      ?? null,
    artistRole:       site?.role       ?? null,
    artistCity:       site?.city       ?? null,
  });
}
