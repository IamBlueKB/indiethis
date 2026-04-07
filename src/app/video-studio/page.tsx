/**
 * /video-studio — Music Video Studio landing page
 * Public — no auth required. Guests and subscribers both land here.
 */

import { auth }          from "@/lib/auth";
import { db }            from "@/lib/db";
import VideoStudioClient from "./VideoStudioClient";

export const metadata = {
  title:       "Music Video Studio — IndieThis",
  description: "Turn your track into a cinematic music video with AI. Director Mode or Quick Mode.",
};

export default async function VideoStudioPage() {
  const session = await auth();
  const userId  = session?.user?.id ?? null;

  let userTier: string | null = null;
  if (userId) {
    const sub = await db.subscription.findFirst({
      where:  { userId, status: "ACTIVE" },
      select: { tier: true },
    });
    userTier = sub?.tier ?? null;
  }

  return (
    <VideoStudioClient
      userId={userId}
      userTier={userTier}
    />
  );
}
