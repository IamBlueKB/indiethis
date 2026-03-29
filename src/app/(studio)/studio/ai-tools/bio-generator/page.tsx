"use client";

import BioGenerator from "@/components/ai-tools/BioGenerator";
import { Sparkles } from "lucide-react";

export default function StudioBioGeneratorPage() {
  return (
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
          <h1 className="text-xl font-bold text-foreground">Studio Bio Generator</h1>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>
            Generate professional bios for your studio — short, medium, and full versions.
            Free · 5 generations per day.
          </p>
        </div>
      </div>

      {/* Tool */}
      <BioGenerator isStudio={true} />
    </div>
  );
}
