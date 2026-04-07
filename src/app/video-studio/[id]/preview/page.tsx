/**
 * /video-studio/[id]/preview — Final video preview + download
 * Public — accessible by anyone with the link.
 */

import { db }            from "@/lib/db";
import { auth }          from "@/lib/auth";
import { notFound }      from "next/navigation";
import PreviewClient     from "./PreviewClient";

export const metadata = { title: "Your Music Video — IndieThis" };

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }    = await params;
  const session   = await auth();
  const userId    = session?.user?.id ?? null;

  const video = await db.musicVideo.findUnique({
    where:  { id },
    select: {
      id:             true,
      status:         true,
      trackTitle:     true,
      finalVideoUrl:  true,
      finalVideoUrls: true,
      thumbnailUrl:   true,
      aspectRatio:    true,
      mode:           true,
      videoLength:    true,
      style:          true,
      bpm:            true,
      musicalKey:     true,
      energy:         true,
      amount:         true,
      userId:         true,
      guestEmail:     true,
      createdAt:      true,
    },
  });

  if (!video) notFound();

  // If still generating, redirect to generating screen
  if (video.status !== "COMPLETE") {
    return (
      <meta httpEquiv="refresh" content={`0;url=/video-studio/${id}/generating`} />
    );
  }

  return (
    <PreviewClient
      id={id}
      trackTitle={video.trackTitle}
      finalVideoUrl={video.finalVideoUrl ?? ""}
      finalVideoUrls={(video.finalVideoUrls as Record<string, string> | null) ?? null}
      aspectRatio={video.aspectRatio}
      style={video.style}
      bpm={video.bpm}
      musicalKey={video.musicalKey}
      energy={video.energy}
      amount={video.amount}
      isOwner={!!userId && userId === video.userId}
      isGuest={!video.userId}
    />
  );
}
