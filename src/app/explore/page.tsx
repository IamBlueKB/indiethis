import { Suspense }  from "react";
import { auth }      from "@/lib/auth";
import { db }        from "@/lib/db";
import ExploreClient from "./ExploreClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore — IndieThis",
  description: "Discover independent artists, music, beats, sample packs, and studios on IndieThis.",
  openGraph: {
    title: "Explore — IndieThis",
    description: "Discover independent artists, music, beats, sample packs, and studios on IndieThis.",
    images: [{ url: "/api/og/static/explore", width: 1200, height: 630, alt: "Explore IndieThis" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore — IndieThis",
    images: ["/api/og/static/explore"],
  },
};

export default async function ExplorePage() {
  const session = await auth();
  let isSubscriber = false;

  if (session?.user?.id) {
    const sub = await db.subscription.findFirst({
      where:  { userId: session.user.id, status: "ACTIVE" },
      select: { id: true },
    });
    isSubscriber = !!sub;
  }

  return (
    <Suspense>
      <ExploreClient isSubscriber={isSubscriber} />
    </Suspense>
  );
}
