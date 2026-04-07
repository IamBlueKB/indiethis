/**
 * /lyric-video — Lyric Video Studio (public, no auth required)
 *
 * URL behaviour:
 *   /lyric-video                   → LyricVideoGateScreen (if no email cookie)
 *   /lyric-video (cookie set)      → LyricVideoClient mode picker
 *   /lyric-video?paid=1&jobId=...  → LyricVideoClient (post-Stripe return, auto-shows wizard)
 *   /lyric-video?mode=director     → LyricVideoClient (pre-selects Director Mode)
 *
 * Authenticated subscribers are redirected to the full-featured dashboard wizard.
 */

import { Metadata, Viewport } from "next";
import { redirect }           from "next/navigation";
import { cookies }            from "next/headers";
import { Suspense }           from "react";
import { auth }               from "@/lib/auth";
import { db }                 from "@/lib/db";
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
  searchParams?: Promise<{ mode?: string; paid?: string; jobId?: string }>;
}) {
  const sp     = await searchParams;
  const session = await auth();

  // Authenticated subscribers → redirect to dashboard wizard
  if (session?.user?.id) {
    const sub = await db.subscription.findFirst({
      where:  { userId: session.user.id, status: "ACTIVE" },
      select: { tier: true },
    });
    if (sub) {
      redirect("/dashboard/ai/lyric-video");
    }
  }

  const cookieStore = await cookies();

  // Read shared guest email cookie (set by GateScreen)
  const sharedCookie = cookieStore.get("indiethis_guest_email")?.value;

  let guestEmail:  string | null = null;
  let artistName:  string | null = null;

  // Authenticated non-subscriber — use their profile
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

  // No email → show gate screen
  if (!guestEmail) {
    return <LyricVideoGateScreen />;
  }

  // Determine initial mode from URL param
  const initialMode = sp?.mode === "director" ? "director" : sp?.mode === "quick" ? "quick" : null;

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }} />}>
      <LyricVideoClient
        guestEmail={guestEmail}
        artistName={artistName}
        isSubscriber={false}
        initialMode={initialMode as "quick" | "director" | null}
        userId={session?.user?.id ?? null}
      />
    </Suspense>
  );
}
