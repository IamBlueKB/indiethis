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

  const studio = await db.studio.findUnique({
    where: { slug },
    select: { name: true, tagline: true, logoUrl: true },
  });

  if (!studio) return {};

  const faviconUrl = studio.logoUrl ?? "/favicon.ico";

  return {
    title: studio.name,
    description: studio.tagline ?? undefined,
    icons: {
      icon: faviconUrl,
      apple: faviconUrl,
    },
  };
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
