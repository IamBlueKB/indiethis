/**
 * /dashboard/releases/[id] — Individual Release Board
 * Server component: auth check + initial data fetch.
 */

import { redirect, notFound }  from "next/navigation";
import { auth }                from "@/lib/auth";
import { db }                  from "@/lib/db";
import ReleaseBoardClient      from "./ReleaseBoardClient";

export const metadata = { title: "Release Board — IndieThis" };

export default async function ReleaseBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  const release = await db.release.findUnique({ where: { id } });
  if (!release || release.userId !== userId) notFound();

  const trackIds = (release.trackIds as string[]) ?? [];

  // Fetch all linked data in parallel
  const [tracks, coverArtJob, musicVideo, lyricVideo] = await Promise.all([
    db.track.findMany({
      where:  { id: { in: trackIds }, artistId: userId },
      select: { id: true, title: true, coverArtUrl: true, fileUrl: true, canvasVideoUrl: true },
    }),
    release.coverArtJobId
      ? db.coverArtJob.findUnique({ where: { id: release.coverArtJobId }, select: { id: true, status: true, selectedUrl: true, variationUrls: true } })
      : null,
    release.musicVideoId
      ? db.musicVideo.findUnique({ where: { id: release.musicVideoId }, select: { id: true, status: true, finalVideoUrl: true, thumbnailUrl: true } })
      : null,
    release.lyricVideoId
      ? db.lyricVideo.findUnique({ where: { id: release.lyricVideoId }, select: { id: true, status: true, finalVideoUrl: true } })
      : null,
  ]);

  const canvasTrack = release.canvasVideoId ? tracks.find(t => t.id === release.canvasVideoId) ?? null : null;
  const firstTrackId = trackIds[0] ?? null;

  return (
    <ReleaseBoardClient
      release={{
        id:              release.id,
        title:           release.title,
        releaseDate:     release.releaseDate?.toISOString() ?? null,
        trackIds,
        coverArtJobId:   release.coverArtJobId,
        musicVideoId:    release.musicVideoId,
        lyricVideoId:    release.lyricVideoId,
        canvasVideoId:   release.canvasVideoId,
        masteredTrackId: release.masteredTrackId,
      }}
      tracks={tracks}
      coverArtJob={coverArtJob}
      musicVideo={musicVideo}
      lyricVideo={lyricVideo}
      canvasVideoUrl={canvasTrack?.canvasVideoUrl ?? null}
      firstTrackId={firstTrackId}
    />
  );
}
