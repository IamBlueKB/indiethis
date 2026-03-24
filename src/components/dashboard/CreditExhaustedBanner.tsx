"use client";

import { Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditExhaustedBannerProps {
  /** e.g. "cover art" */
  toolLabel:       string;
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
  creditsLimit,
  ppuPrice,
  nextTierName,
  nextTierCredits,
  nextTierPrice,
  isMaxTier = false,
}: CreditExhaustedBannerProps) {
  const limitText = creditsLimit === 0
    ? `${toolLabel} isn't included in your current plan.`
    : `You've used all ${creditsLimit} ${toolLabel} credit${creditsLimit !== 1 ? "s" : ""} this month.`;

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
        {/* Pay-per-use option */}
        <a
          href="/dashboard/settings"
          className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "#D4A843" }}
        >
          Generate for {ppuPrice} →
        </a>

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
    </div>
  );
}
