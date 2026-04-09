/**
 * /lyric-video — Lyric Video Studio (public, no auth required)
 *
 * URL behaviour:
 *   /lyric-video                    → LyricVideoLanding  (premium marketing page)
 *   /lyric-video?start=1            → GateScreen → LyricVideoClient
 *   /lyric-video?start=1&mode=quick    → GateScreen → wizard pre-set to Quick
 *   /lyric-video?start=1&mode=director → GateScreen → wizard pre-set to Director
 *
 * Authenticated subscribers are redirected to the full-featured dashboard wizard.
 */

import { Metadata, Viewport } from "next";
import { redirect }           from "next/navigation";
import { cookies }            from "next/headers";
import { Suspense }           from "react";
import { auth }               from "@/lib/auth";
import { db }                 from "@/lib/db";
import LyricVideoLanding      from "./LyricVideoLanding";
import LyricVideoGateScreen   from "./LyricVideoGateScreen";
import LyricVideoClient       from "./LyricVideoClient";

export const viewport: Viewport = { themeColor: "#0A0A0A" };

// ─── OG Metadata ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       "AI Lyric Video Studio — IndieThis",
  description: "Create cinematic lyric videos in minutes with AI. No account needed. 5 animation styles, AI-generated backgrounds. From $17.99.",
  openGraph: {
    title:       "AI Lyric Video Studio — IndieThis",
    description: "Create cinematic lyric videos with AI. No account needed.",
    url:         "https://indiethis.com/lyric-video",
    siteName:    "IndieThis",
    type:        "website",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "AI Lyric Video — IndieThis",
    description: "Cinematic lyric videos powered by AI. 5 animation styles. Starts at $17.99.",
    site:        "@indiethisapp",
  },
  keywords: [
    "AI lyric video", "lyric video generator", "music video maker",
    "AI music video", "lyric video creator", "indie artist tools",
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LyricVideoPage({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string; mode?: string; paid?: string; jobId?: string }>;
}) {
  const sp      = await searchParams;
  const session = await auth();
  const userId  = session?.user?.id ?? null;

  // Authenticated subscribers → redirect to dashboard wizard
  if (userId) {
    const sub = await db.subscription.findFirst({
      where:  { userId, status: "ACTIVE" },
      select: { tier: true },
    });
    if (sub) redirect("/dashboard/ai/lyric-video");
  }

  // Default view: premium landing page
  if (sp?.start !== "1") {
    return <LyricVideoLanding userId={userId} userTier={null} />;
  }

  // ?start=1 — show gate screen or jump to wizard if cookie already set
  const cookieStore  = await cookies();
  const sharedCookie = cookieStore.get("indiethis_guest_email")?.value;

  let guestEmail: string | null = null;
  let artistName: string | null = null;

  if (session?.user) {
    guestEmail = session.user.email ?? null;
    artistName = (session.user as { artistName?: string }).artistName ?? session.user.name ?? null;
  } else if (sharedCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sharedCookie)) as { email?: string; name?: string };
      guestEmail   = parsed.email ?? null;
      artistName   = parsed.name ?? null;
    } catch { /* malformed cookie */ }
  }

  // No email → gate screen collects it
  if (!guestEmail) {
    return <LyricVideoGateScreen />;
  }

  const initialMode = sp?.mode === "director" ? "director" : sp?.mode === "quick" ? "quick" : null;

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }} />}>
      <LyricVideoClient
        guestEmail={guestEmail}
        artistName={artistName}
        isSubscriber={false}
        initialMode={initialMode as "quick" | "director" | null}
        userId={userId}
      />
    </Suspense>
  );
}
