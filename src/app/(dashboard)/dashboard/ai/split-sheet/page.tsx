"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import SplitSheetGenerator from "@/components/ai-tools/SplitSheetGenerator";
import { FileText } from "lucide-react";

export default function SplitSheetPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AIToolsNav />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(52,199,89,0.12)" }}
          >
            <FileText size={22} style={{ color: "#34C759" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Split Sheet Generator</h1>
            <p className="text-sm mt-0.5" style={{ color: "#888" }}>
              Generate a professional PDF split sheet, automatically saved to your License Vault.
              Free · No limits.
            </p>
          </div>
        </div>

        <SplitSheetGenerator />
      </div>
    </div>
  );
}
