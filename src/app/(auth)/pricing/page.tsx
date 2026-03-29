"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PublicNav from "@/components/layout/PublicNav";
import { CheckCircle2, Loader2, Mic2, Building2, Music4, Zap, Star } from "lucide-react";
import { PRICING_DEFAULTS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

// ─── Plan Definitions ─────────────────────────────────────────────────────────

type Plan = {
  name:     string;
  key:      string;
  price:    number;
  tagline:  string;
  color:    string;
  popular:  boolean;
  features: string[];
};

const ARTIST_PLANS: Plan[] = [
  {
    name:    "Launch",
    key:     "launch",
    price:   PRICING_DEFAULTS.PLAN_LAUNCH.value,
    tagline: "Start making moves",
    color:   "#9A9A9E",
    popular: false,
    features: [
      "5 AI Cover Arts / month",
      "1 AI Master / month",
      "Artist mini-site (profile only)",
      "Merch storefront",
      "Studio session booking",
      "Split sheet generator",
      "10% off Pay Per Use AI",
    ],
  },
  {
    name:    "Push",
    key:     "push",
    price:   PRICING_DEFAULTS.PLAN_PUSH.value,
    tagline: "Scale your sound",
    color:   "#D4A843",
    popular: true,
    features: [
      "10 AI Cover Arts / month",
      "2 AI Music Videos / month",
      "3 AI Masters / month",
      "1 Lyric Video / month",
      "2 A&R Reports / month",
      "Full artist mini-site",
      "Merch storefront",
      "Split sheet generator",
      "10% off Pay Per Use AI",
    ],
  },
  {
    name:    "Reign",
    key:     "reign",
    price:   PRICING_DEFAULTS.PLAN_REIGN.value,
    tagline: "Own your lane",
    color:   "#E85D4A",
    popular: false,
    features: [
      "15 AI Cover Arts / month",
      "5 AI Music Videos / month",
      "10 AI Masters / month",
      "3 Lyric Videos / month",
      "5 A&R Reports / month",
      "Custom domain artist site",
      "Beat marketplace access",
      "Split sheet generator",
      "Priority support",
      "10% off Pay Per Use AI",
    ],
  },
];

const STUDIO_PLANS: Plan[] = [
  {
    name:    "Pro",
    key:     "studio_pro",
    price:   PRICING_DEFAULTS.STUDIO_PRO.value,
    tagline: "Everything you need to run your studio",
    color:   "#5AC8FA",
    popular: false,
    features: [
      "Public studio website",
      "Unlimited bookings & CRM contacts",
      "File delivery (QuickSend)",
      "Intake forms & e-signatures",
      "Invoice builder",
      "Email blast campaigns",
      "Artist roster management",
      "Studio analytics dashboard",
    ],
  },
  {
    name:    "Elite",
    key:     "studio_elite",
    price:   PRICING_DEFAULTS.STUDIO_ELITE.value,
    tagline: "The full flagship studio experience",
    color:   "#D4A843",
    popular: true,
    features: [
      "Everything in Pro",
      "All 3 site templates",
      "Custom accent color branding",
      "Featured artists section",
      "Gallery carousel",
      "Custom domain support",
      "White-label powered-by removal",
      "Priority support & onboarding",
    ],
  },
];

// ─── Path metadata ─────────────────────────────────────────────────────────────

const PATH_META: Record<string, { icon: React.ReactNode; label: string }> = {
  artist:   { icon: <Mic2 size={14} />,      label: "Artist" },
  producer: { icon: <Music4 size={14} />,    label: "Producer" },
  studio:   { icon: <Building2 size={14} />, label: "Studio" },
};

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function PricingContent() {
  const searchParams = useSearchParams();
  const initialPath  = searchParams.get("path") ?? "artist";
  const pendingId    = searchParams.get("pending") ?? undefined;

  const [activeTab, setActiveTab] = useState<"artist" | "studio">(
    initialPath === "studio" ? "studio" : "artist"
  );

  const isStudio = activeTab === "studio";
  const plans    = isStudio ? STUDIO_PLANS : ARTIST_PLANS;
  const pathMeta = PATH_META[activeTab] ?? PATH_META.artist;

  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  async function handleSelect(planKey: string) {
    setLoading(planKey);
    setError("");
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: planKey, onboarding: true, pendingId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="w-full max-w-4xl">

      {/* Tab switcher */}
      <div className="flex justify-center mb-8">
        <div
          className="inline-flex rounded-xl p-1 gap-1"
          style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}
        >
          {(["artist", "studio"] as const).map((tab) => {
            const meta   = tab === "artist" ? PATH_META.artist : PATH_META.studio;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setError(""); setLoading(null); }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: active ? "#D4A843" : "transparent",
                  color:           active ? "#0A0A0A" : "#888",
                }}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium mb-3"
          style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}
        >
          {pathMeta.icon}
          {pathMeta.label} Account
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Choose your plan
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Month-to-month · Cancel anytime · Upgrade or downgrade whenever you want.
        </p>
      </div>

      {/* Plan Cards */}
      <div className={cn("grid gap-4", isStudio ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 sm:grid-cols-3")}>
        {plans.map((plan) => {
          const isLoading = loading === plan.key;
          const isAnyLoading = loading !== null;

          return (
            <div
              key={plan.key}
              className={cn(
                "relative rounded-2xl border p-6 flex flex-col transition-all",
                plan.popular ? "border-accent" : ""
              )}
              style={{
                backgroundColor: "var(--card)",
                borderColor: plan.popular ? plan.color : "var(--border)",
                boxShadow: plan.popular ? `0 0 0 1px ${plan.color}22` : undefined,
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: plan.color, color: "#0A0A0A" }}
                >
                  <Star size={10} fill="currentColor" />
                  Most Popular
                </div>
              )}

              {/* Plan name + tagline */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={15} style={{ color: plan.color }} />
                  <span className="font-display font-bold text-base text-foreground">
                    {plan.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              </div>

              {/* Price */}
              <div className="mb-5">
                <span className="font-display font-bold text-3xl text-foreground">
                  ${plan.price}
                </span>
                <span className="text-sm text-muted-foreground"> / mo</span>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2
                      size={13}
                      className="shrink-0 mt-0.5"
                      style={{ color: plan.color }}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSelect(plan.key)}
                disabled={isAnyLoading}
                className="w-full h-10 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#E85D4A", color: "#fff" }}
              >
                {isLoading ? (
                  <><Loader2 size={15} className="animate-spin" /> Setting up…</>
                ) : (
                  `Get ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-center mt-4 text-red-400">{error}</p>
      )}

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        Secure checkout via Stripe · You won&apos;t be charged until after your free trial
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ backgroundColor: "#0A0A0A", zIndex: 10 }}>
      <PublicNav />
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center">
        <Suspense>
          <PricingContent />
        </Suspense>
      </div>
    </div>
  );
}
