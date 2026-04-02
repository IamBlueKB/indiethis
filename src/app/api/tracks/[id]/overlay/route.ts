import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/tracks/[id]/overlay
// Returns everything the TrackDetailOverlay needs in one request.
// Public — no auth required.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [track, djPickCount] = await Promise.all([
    db.track.findUnique({
      where: { id },
      select: {
        id:             true,
        title:          true,
        fileUrl:        true,
        coverArtUrl:    true,
        canvasVideoUrl: true,
        price:          true,
        bpm:            true,
        musicalKey:     true,
        genre:          true,
        producer:       true,
        songwriter:     true,
        featuredArtists:true,
        beatLeaseSettings: {
          select: { streamLeaseEnabled: true },
        },
        artist: {
          select: {
            name:       true,
            artistSlug: true,
            artistSite: { select: { isPublished: true } },
          },
        },
        audioFeatures: {
          select: {
            energy:          true,
            danceability:    true,
            valence:         true,
            acousticness:    true,
            instrumentalness:true,
            liveness:        true,
            speechiness:     true,
            loudness:        true,
            mood:            true,
            genre:           true,
          },
        },
        digitalProducts: {
          where:   { published: true },
          select:  { id: true, price: true, title: true },
          take:    1,
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.crateItem.count({ where: { trackId: id } }),
  ]);

  if (!track) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const site      = track.artist.artistSite;
  const artistSlug = site?.isPublished ? track.artist.artistSlug : null;
  const dp        = track.digitalProducts[0] ?? null;

  return NextResponse.json({
    id:             track.id,
    title:          track.title,
    fileUrl:        track.fileUrl,
    coverArtUrl:    track.coverArtUrl,
    canvasVideoUrl: track.canvasVideoUrl,
    bpm:            track.bpm,
    musicalKey:     track.musicalKey,
    genre:          track.genre,
    producer:       track.producer,
    songwriter:     track.songwriter,
    featuredArtists:track.featuredArtists,
    artist: {
      name:  track.artist.name,
      slug:  artistSlug,
    },
    price:         track.price,
    beatLeaseSettings: track.beatLeaseSettings ?? null,
    audioFeatures: track.audioFeatures ?? null,
    djPickCount,
    digitalProduct: dp
      ? { id: dp.id, price: dp.price / 100, title: dp.title }
      : null,
  });
}
