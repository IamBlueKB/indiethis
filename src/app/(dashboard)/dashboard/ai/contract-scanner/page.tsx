"use client";

import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import ContractScanner from "@/components/ai-tools/ContractScanner";
import { Shield } from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";

export default function ContractScannerPage() {
  const price = PRICING_DEFAULTS.AI_CONTRACT_SCANNER.display;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AIToolsNav />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(232,93,74,0.12)" }}
          >
            <Shield size={22} style={{ color: "#E85D4A" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Contract Red Flag Scanner</h1>
            <p className="text-sm mt-0.5" style={{ color: "#888" }}>
              Upload a contract PDF and get an AI-powered breakdown of red flags, unfavorable terms,
              and negotiation tips. 3 free scans/day with subscription · {price} per additional scan.
            </p>
          </div>
        </div>

        {/* Tool */}
        <ContractScanner />
      </div>
    </div>
  );
}
