import type { Metadata } from "next";
import { Suspense } from "react";
import ArtistsClient from "./ArtistsClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Discover Independent Artists & Producers | IndieThis",
  description:
    "Find independent artists and music producers. Listen to new music, browse beats, and connect with creators.",
};

export default function ArtistsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      }
    >
      <ArtistsClient />
    </Suspense>
  );
}
