"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import BioGenerator from "@/components/ai-tools/BioGenerator";
import { Sparkles } from "lucide-react";

export default function BioGeneratorPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AIToolsNav />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(212,168,67,0.12)" }}
          >
            <Sparkles size={22} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Bio Generator</h1>
            <p className="text-sm mt-0.5" style={{ color: "#888" }}>
              Generate three professional bio versions — short, medium, and full — tailored to your sound.
              Free · 5 generations per day.
            </p>
          </div>
        </div>

        {/* Tool */}
        <BioGenerator isStudio={false} />
      </div>
    </div>
  );
}
