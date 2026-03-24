"use client";

import { Lock, Zap } from "lucide-react";
import { useUserStore } from "@/store";
import { PRICING_DEFAULTS } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequiredTier = "PUSH" | "REIGN" | "ELITE";

interface UpgradeGateProps {
  requiredTier:       RequiredTier;
  featureName:        string;
  featureDescription: string;
  /** 2–3 bullet points describing what this feature enables */
  features:           string[];
  /** Defaults to /dashboard/upgrade */
  upgradeHref?:       string;
  /** Override for studio context where useUserStore isn't relevant */
  currentTier?:       string;
}

// ─── Tier metadata ────────────────────────────────────────────────────────────

const TIER_META: Record<RequiredTier, { label: string; price: string }> = {
  PUSH:  { label: "Push",  price: PRICING_DEFAULTS.PLAN_PUSH.display  },
  REIGN: { label: "Reign", price: PRICING_DEFAULTS.PLAN_REIGN.display },
  ELITE: { label: "Elite", price: PRICING_DEFAULTS.STUDIO_ELITE.display },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function UpgradeGate({
  requiredTier,
  featureName,
  featureDescription,
  features,
  upgradeHref = "/dashboard/upgrade",
  currentTier,
}: UpgradeGateProps) {
  // Only used to satisfy the hook rules — currentTier prop overrides when provided
  const { user } = useUserStore();
  void user; // suppress unused warning; currentTier prop or caller controls rendering

  const { label, price } = TIER_META[requiredTier];

  return (
    <div className="p-6 max-w-md mx-auto">
      <div
        className="rounded-2xl border p-8 text-center space-y-5"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
        >
          <Lock size={28} style={{ color: "#D4A843" }} />
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-foreground">{featureName}</h1>
          <p className="text-sm font-semibold" style={{ color: "#D4A843" }}>
            Available on {label} and above
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {featureDescription}
          </p>
        </div>

        {/* Feature bullets */}
        <div
          className="rounded-xl border p-4 text-left space-y-2"
          style={{
            backgroundColor: "rgba(212,168,67,0.06)",
            borderColor:     "rgba(212,168,67,0.2)",
          }}
        >
          {features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="shrink-0 mt-0.5" style={{ color: "#D4A843" }}>•</span>
              {f}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <a
            href={upgradeHref}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm w-full justify-center"
            style={{ backgroundColor: "#E85D4A", color: "white" }}
          >
            <Zap size={14} />
            Upgrade to {label} — {price}
          </a>
          <a
            href="/pricing"
            className="block text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            See all plans
          </a>
        </div>
      </div>
    </div>
  );
}
