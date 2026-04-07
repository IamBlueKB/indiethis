/**
 * /video-studio/director/[id] — Director Mode multi-phase UI
 * Public — accessed after creating a Director Mode video record.
 */

import { db }            from "@/lib/db";
import { auth }          from "@/lib/auth";
import { notFound }      from "next/navigation";
import DirectorClient    from "./DirectorClient";

export const metadata = { title: "Director Mode — Music Video Studio" };

export default async function DirectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }  = await params;
  const session = await auth();
  const userId  = session?.user?.id ?? null;

  const video = await db.musicVideo.findUnique({
    where:  { id },
    select: {
      id:              true,
      trackTitle:      true,
      trackDuration:   true,
      audioUrl:        true,
      mode:            true,
      status:          true,
      videoLength:     true,
      aspectRatio:     true,
      style:           true,
      bpm:             true,
      musicalKey:      true,
      energy:          true,
      conversationLog: true,
      creativeBrief:   true,
      shotList:        true,
      amount:          true,
      userId:          true,
    },
  });

  if (!video || video.mode !== "DIRECTOR") notFound();

  // If in generating/complete state, redirect
  if (video.status === "GENERATING" || video.status === "STITCHING") {
    return <meta httpEquiv="refresh" content={`0;url=/video-studio/${id}/generating`} />;
  }
  if (video.status === "COMPLETE") {
    return <meta httpEquiv="refresh" content={`0;url=/video-studio/${id}/preview`} />;
  }

  return (
    <DirectorClient
      id={id}
      trackTitle={video.trackTitle}
      trackDuration={video.trackDuration}
      audioUrl={video.audioUrl}
      videoLength={video.videoLength}
      aspectRatio={video.aspectRatio}
      bpm={video.bpm}
      musicalKey={video.musicalKey}
      energy={video.energy}
      initialConversation={((video.conversationLog ?? []) as unknown as { role: "user" | "assistant"; content: string; createdAt: string }[])}
      initialBrief={(video.creativeBrief as object | null) ?? null}
      initialShotList={(video.shotList as object[] | null) ?? null}
      userId={userId}
    />
  );
}
