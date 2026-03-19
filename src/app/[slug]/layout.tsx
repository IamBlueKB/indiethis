import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { db } from "@/lib/db";
import MiniPlayer from "@/components/audio/MiniPlayer";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // ── Studio metadata ──────────────────────────────────────────────────────
  const studio = await db.studio.findUnique({
    where:  { slug },
    select: { name: true, tagline: true, logoUrl: true },
  });

  if (studio) {
    const faviconUrl = studio.logoUrl ?? "/favicon.ico";
    return {
      title:       studio.name,
      description: studio.tagline ?? undefined,
      icons:       { icon: faviconUrl, apple: faviconUrl },
    };
  }

  // ── Artist metadata ───────────────────────────────────────────────────────
  const artist = await db.user.findUnique({
    where:  { artistSlug: slug },
    select: {
      name:       true,
      artistName: true,
      bio:        true,
      photo:      true,
      artistSite: { select: { isPublished: true, bioContent: true, heroImage: true } },
    },
  });

  if (artist?.artistSite?.isPublished) {
    const displayName = artist.artistName || artist.name;
    const description = artist.artistSite.bioContent || artist.bio || undefined;
    const ogImage     = artist.photo || artist.artistSite.heroImage || undefined;

    return {
      title:       displayName,
      description,
      openGraph:   ogImage ? { images: [{ url: ogImage }] } : undefined,
      twitter:     {
        card:        "summary_large_image",
        title:       displayName,
        description,
        images:      ogImage ? [ogImage] : [],
      },
    };
  }

  return {};
}

export default function SlugLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${playfair.variable} ${dmSans.variable}`}>
      <div className="pb-20">
        {children}
      </div>
      <MiniPlayer />
    </div>
  );
}
