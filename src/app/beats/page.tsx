import type { Metadata } from "next";
import { Suspense } from "react";
import BeatsClient from "./BeatsClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Buy Beats Online | Beat Marketplace | IndieThis",
  description:
    "Browse and license beats from independent producers. Lease, non-exclusive, and exclusive licenses available. Stream lease beats for $1/mo.",
};

export default function BeatsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      }
    >
      <BeatsClient />
    </Suspense>
  );
}
