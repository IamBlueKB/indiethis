/**
 * /video-studio — Music Video Studio
 *
 * Public — no auth required. Guests and subscribers both land here.
 *
 * URL behaviour:
 *   /video-studio          → VideoStudioLanding  (premium marketing page)
 *   /video-studio?start=1  → VideoStudioClient   (the creation wizard)
 *   /video-studio?start=1&mode=DIRECTOR → wizard pre-set to Director Mode
 */

import { Metadata }          from "next";
import { auth }              from "@/lib/auth";
import { db }                from "@/lib/db";
import VideoStudioClient     from "./VideoStudioClient";
import VideoStudioLanding    from "./VideoStudioLanding";

// ─── OG Metadata ────────────────────────────────────────────────────────────────

const OG_IMAGE = "https://res.cloudinary.com/indiethis/image/upload/v1/video-studio/og-preview.jpg";

export const metadata: Metadata = {
  title:       "Music Video Studio — IndieThis",
  description: "Turn your track into a cinematic music video with AI. No account needed. Quick Mode from $14.99, Director Mode from $24.99. Download MP4, share anywhere.",
  openGraph: {
    title:       "Music Video Studio — IndieThis",
    description: "Turn your track into a cinematic music video with AI. No account needed.",
    url:         "https://indiethis.com/video-studio",
    siteName:    "IndieThis",
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        alt:    "IndieThis Music Video Studio — AI-generated music videos",
      },
    ],
    type: "website",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Turn Your Track Into a Music Video",
    description: "AI-generated music videos from $14.99. No account needed.",
    images:      [OG_IMAGE],
    site:        "@indiethisapp",
  },
  keywords: [
    "AI music video", "music video generator", "AI video creation",
    "music video maker", "no account needed", "indie music video",
    "automatic music video", "fal ai video", "generative video",
  ],
};

// ─── Page ────────────────────────────────────────────────────────────────────────

export default async function VideoStudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session     = await auth();
  const userId      = session?.user?.id ?? null;
  const sp          = await searchParams;
  const startWizard = sp.start === "1";

  let userTier: string | null = null;
  if (userId) {
    const sub = await db.subscription.findFirst({
      where:  { userId, status: "ACTIVE" },
      select: { tier: true },
    });
    userTier = sub?.tier ?? null;
  }

  // If user came via ?start=1 (from landing CTAs or direct link), show the wizard
  if (startWizard) {
    return (
      <VideoStudioClient
        userId={userId}
        userTier={userTier}
        initialMode={sp.mode === "DIRECTOR" ? "DIRECTOR" : sp.mode === "QUICK" ? "QUICK" : undefined}
      />
    );
  }

  // Default: premium landing page
  return (
    <VideoStudioLanding
      userId={userId}
      userTier={userTier}
    />
  );
}
