"use client";

import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditExhaustedBannerProps {
  /** e.g. "cover art" */
  toolLabel:       string;
  /**
   * Tool key passed to POST /api/stripe/pay-per-use.
   * Must match PPU_META keys: COVER_ART | MASTERING | LYRIC_VIDEO |
   * AAR_REPORT | PRESS_KIT | AI_VIDEO | CONTRACT_SCANNER
   * Omit for tools that have no PPU option (e.g. SMS broadcasts).
   */
  toolType?:       string;
  /** User's monthly allowance on their current tier (e.g. 5) */
  creditsLimit:    number;
  /** Formatted pay-per-use price e.g. "$4.99" */
  ppuPrice:        string;
  /** e.g. "Push" or "Reign" */
  nextTierName:    string;
  /** Credits available at next tier e.g. 10 */
  nextTierCredits: number;
  /** e.g. "$49/mo" */
  nextTierPrice:   string;
  /** True if the user is already on REIGN — hide upgrade option */
  isMaxTier?:      boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreditExhaustedBanner({
  toolLabel,
  toolType,
  creditsLimit,
  ppuPrice,
  nextTierName,
  nextTierCredits,
  nextTierPrice,
  isMaxTier = false,
}: CreditExhaustedBannerProps) {
  const [loading, setLoading] = useState(false);
  const [ppuError, setPpuError] = useState("");

  const limitText = creditsLimit === 0
    ? `${toolLabel} isn't included in your current plan.`
    : `You've used all ${creditsLimit} ${toolLabel} credit${creditsLimit !== 1 ? "s" : ""} this month.`;

  async function handlePPU() {
    setLoading(true);
    setPpuError("");
    try {
      const res  = await fetch("/api/stripe/pay-per-use", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tool: toolType }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPpuError(data.error ?? "Couldn't start checkout. Please try again.");
        setLoading(false);
      }
    } catch {
      setPpuError("Couldn't start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        backgroundColor: "rgba(212,168,67,0.08)",
        borderColor:     "rgba(212,168,67,0.25)",
      }}
    >
      <p className="text-sm font-semibold text-foreground">{limitText}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Pay-per-use: calls Stripe Checkout — only shown when toolType is provided */}
        {toolType && (
          <button
            onClick={handlePPU}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ color: "#D4A843" }}
          >
            {loading ? (
              <><Loader2 size={12} className="animate-spin" /> Redirecting…</>
            ) : (
              `Generate for ${ppuPrice} →`
            )}
          </button>
        )}

        {/* Upgrade option (hidden for max tier) */}
        {!isMaxTier && (
          <>
            <span className="text-muted-foreground text-xs">or</span>
            <a
              href="/dashboard/upgrade"
              className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: "#E85D4A" }}
            >
              <Zap size={12} />
              Upgrade to {nextTierName} for {nextTierCredits}/month — {nextTierPrice}
            </a>
          </>
        )}

        {isMaxTier && (
          <span className="text-xs text-muted-foreground">Resets next billing cycle.</span>
        )}
      </div>

      {ppuError && (
        <p className="text-xs text-red-400">{ppuError}</p>
      )}
    </div>
  );
}
