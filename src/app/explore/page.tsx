import { Suspense } from "react";
import ExploreClient from "./ExploreClient";

export const metadata = {
  title: "Explore — IndieThis",
  description: "Discover artists, music, beats, and studios on IndieThis.",
};

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreClient />
    </Suspense>
  );
}
