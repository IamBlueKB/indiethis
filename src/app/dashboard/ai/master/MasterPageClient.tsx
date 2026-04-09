"use client";

/**
 * MasterPageClient — top-level container for /dashboard/ai/master
 *
 * Renders tab switcher: Single track | Album mastering
 */

import { useState } from "react";
import { Music, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MasterWizardClient } from "./MasterWizardClient";
import { AlbumWizardClient } from "./AlbumWizardClient";

type Tab = "single" | "album";

export function MasterPageClient({
  userId,
  creditsUsed  = 0,
  creditsLimit = 0,
}: {
  userId:        string;
  creditsUsed?:  number;
  creditsLimit?: number;
}) {
  const [tab, setTab] = useState<Tab>("single");
  const creditsRemaining = Math.max(0, creditsLimit - creditsUsed);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#fff" }}>
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: "#D4A843" }}>
            AI Mix &amp; Master
          </h1>
          <p className="text-sm mt-2" style={{ color: "#777" }}>
            Professional-grade mixing and mastering — no plug-ins, no engineers
          </p>
          {creditsLimit > 0 && (
            <p className="text-xs mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: creditsRemaining > 0 ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.05)",
                color:           creditsRemaining > 0 ? "#D4A843" : "#666",
                border:          `1px solid ${creditsRemaining > 0 ? "rgba(212,168,67,0.2)" : "#2a2a2a"}`,
              }}>
              {creditsRemaining > 0
                ? `${creditsRemaining} master${creditsRemaining === 1 ? "" : "s"} remaining this month`
                : "No included masters remaining this month"}
            </p>
          )}
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-xl p-1 mb-8"
          style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}
        >
          <button
            onClick={() => setTab("single")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            )}
            style={
              tab === "single"
                ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                : { color: "#777" }
            }
          >
            <Music size={15} />
            Single track
          </button>
          <button
            onClick={() => setTab("album")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            )}
            style={
              tab === "album"
                ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                : { color: "#777" }
            }
          >
            <Disc3 size={15} />
            Album mastering
          </button>
        </div>

        {/* Content */}
        {tab === "single" ? (
          <MasterWizardClient userId={userId} />
        ) : (
          <AlbumWizardClient userId={userId} />
        )}
      </div>
    </div>
  );
}
