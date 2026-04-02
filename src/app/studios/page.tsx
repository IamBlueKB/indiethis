import type { Metadata } from "next";
import { Suspense } from "react";
import StudiosClient from "./StudiosClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Find a Recording Studio | IndieThis",
  description:
    "Browse recording studios on IndieThis. Find professional studios for recording, mixing, and mastering.",
  openGraph: {
    title: "Find a Recording Studio | IndieThis",
    description: "Browse recording studios on IndieThis. Find professional studios for recording, mixing, and mastering.",
    images: [{ url: "/api/og/static/studios", width: 1200, height: 630, alt: "Recording Studios on IndieThis" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Find a Recording Studio | IndieThis",
    images: ["/api/og/static/studios"],
  },
};

export default function StudiosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#D4A843" }} />
        </div>
      }
    >
      <StudiosClient />
    </Suspense>
  );
}
