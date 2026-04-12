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
import { cookies }           from "next/headers";
import { auth }              from "@/lib/auth";
import { db }                from "@/lib/db";
import VideoStudioClient     from "./VideoStudioClient";
import VideoStudioLanding    from "./VideoStudioLanding";
import GateScreen            from "./GateScreen";

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

  let userTier:  string | null = null;
  let userPhoto: string | null = null;
  if (userId) {
    const [sub, user] = await Promise.all([
      db.subscription.findFirst({
        where:  { userId, status: "ACTIVE" },
        select: { tier: true },
      }),
      db.user.findUnique({
        where:  { id: userId },
        select: { photo: true },
      }),
    ]);
    userTier  = sub?.tier ?? null;
    userPhoto = user?.photo ?? null;
  }

  const initialMode     = sp.mode === "DIRECTOR" ? "DIRECTOR" : sp.mode === "QUICK" ? "QUICK" : undefined;
  const initialCoverArtUrl = sp.coverArtUrl ? decodeURIComponent(sp.coverArtUrl) : undefined;

  // If user came via ?start=1 (from landing CTAs or direct link), show the wizard
  // Also show wizard directly if coverArtUrl was passed from cover art studio
  const showWizard = startWizard || !!initialCoverArtUrl;

  if (showWizard) {
    // Non-authenticated users must pass through the gate screen first.
    // Gate is skipped if: (a) user is authenticated, OR (b) guest cookie already set.
    const cookieStore = await cookies();
    const guestCookie = cookieStore.get("indiethis_guest_email")?.value;

    if (!userId && !guestCookie) {
      // Show gate — collect email before entering wizard
      return <GateScreen initialMode={initialMode} />;
    }

    // Parse guest email from cookie for pre-filling Step 3
    let initialGuestEmail: string | undefined;
    if (guestCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(guestCookie)) as { email?: string };
        initialGuestEmail = parsed.email ?? undefined;
      } catch {
        // Malformed cookie — ignore; gate will collect email at Step 3
      }
    }

    return (
      <VideoStudioClient
        userId={userId}
        userTier={userTier}
        initialMode={initialMode}
        initialGuestEmail={initialGuestEmail}
        initialCoverArtUrl={initialCoverArtUrl}
        userPhoto={userPhoto}
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
