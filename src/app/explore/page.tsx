import { Suspense } from "react";
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

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreClient />
    </Suspense>
  );
}
