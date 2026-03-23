import type { Metadata } from "next";
import { Suspense } from "react";
import StudiosClient from "./StudiosClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Find a Recording Studio | IndieThis",
  description:
    "Browse recording studios on IndieThis. Find professional studios for recording, mixing, and mastering.",
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
