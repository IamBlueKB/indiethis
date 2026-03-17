"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ArrowRight, ExternalLink, Zap, Users, Mic2, Star } from "lucide-react";

type Plan = {
  name: string;
  key: string;
  price: number;
  tagline: string;
  color: string;
  popular: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "Launch", key: "launch", price: 19, tagline: "Start making moves",
    color: "#9A9A9E", popular: false,
    features: [
      "5 AI Cover Arts / month",
      "1 AI Master / month",
      "Artist mini-site (profile only)",
      "Merch storefront",
      "Studio session booking",
      "10% off Pay Per Use",
    ],
  },
  {
    name: "Push", key: "push", price: 49, tagline: "Scale your sound",
    color: "#D4A843", popular: true,
    features: [
      "10 AI Cover Arts / month",
      "2 AI Music Videos / month",
      "3 AI Masters / month",
      "1 Lyric Video / month",
      "2 A&R Reports / month",
      "Full artist mini-site",
      "Merch storefront",
      "10% off Pay Per Use",
    ],
  },
  {
    name: "Reign", key: "reign", price: 149, tagline: "Own your lane",
    color: "#E85D4A", popular: false,
    features: [
      "15 AI Cover Arts / month",
      "5 AI Music Videos / month",
      "10 AI Masters / month",
      "3 Lyric Videos / month",
      "5 A&R Reports / month",
      "Custom domain artist site",
      "Beat marketplace access",
      "Priority support",
      "10% off Pay Per Use",
    ],
  },
];

const STUDIO_PLANS: Plan[] = [
  {
    name: "Pro", key: "studio_pro", price: 49, tagline: "Everything you need to run your studio",
    color: "#5AC8FA", popular: false,
    features: [
      "Public studio website (Classic or Bold template)",
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
    name: "Elite", key: "studio_elite", price: 99, tagline: "The full flagship studio experience",
    color: "#D4A843", popular: true,
    features: [
      "Everything in Pro",
      "All 3 templates (Classic, Bold, Editorial)",
      "Custom accent color branding",
      "Featured artists section",
      "Gallery carousel (Embla)",
      "Custom domain support",
      "Priority support & onboarding",
      "White-label powered-by removal",
    ],
  },
];

export default function UpgradePage() {
  const [activeTab, setActiveTab] = useState<"artist" | "studio">("artist");
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleUpgrade(planKey: string) {
    setLoading(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Something went wrong.");
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setPortalLoading(false);
    }
  }

  const activePlans = activeTab === "artist" ? PLANS : STUDIO_PLANS;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
          Choose a Plan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Month-to-month. Cancel anytime. All plans include the full IndieThis platform.
        </p>
      </div>

      {/* Artist / Studio toggle */}
      <div className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <button
          onClick={() => setActiveTab("artist")}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: activeTab === "artist" ? "var(--accent)" : "transparent",
            color: activeTab === "artist" ? "#0A0A0A" : "var(--muted-foreground)",
          }}
        >
          <Mic2 size={14} />
          Artists
        </button>
        <button
          onClick={() => setActiveTab("studio")}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: activeTab === "studio" ? "var(--accent)" : "transparent",
            color: activeTab === "studio" ? "#0A0A0A" : "var(--muted-foreground)",
          }}
        >
          <Users size={14} />
          Studios
        </button>
      </div>

      {activeTab === "studio" && (
        <p className="text-xs text-muted-foreground -mt-4">
          Studio plans power your public booking page, CRM, file delivery, invoices, and more.
        </p>
      )}

      <div className={`grid grid-cols-1 gap-5 ${activeTab === "artist" ? "md:grid-cols-3" : "md:grid-cols-2 max-w-3xl"}`}>
        {activePlans.map((plan) => (
          <div
            key={plan.key}
            className="rounded-2xl border flex flex-col relative"
            style={{
              backgroundColor: "var(--card)",
              borderColor: plan.popular ? plan.color : "var(--border)",
              boxShadow: plan.popular ? `0 0 0 1px ${plan.color}40` : undefined,
            }}
          >
            {plan.popular && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: plan.color, color: "#0A0A0A" }}
              >
                Most Popular
              </div>
            )}

            <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-display font-bold text-lg text-foreground">{plan.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
                </div>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${plan.color}18` }}
                >
                  <Zap size={14} style={{ color: plan.color }} />
                </div>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-display font-bold text-foreground">${plan.price}</span>
                <span className="text-sm text-muted-foreground mb-1">/mo</span>
              </div>
            </div>

            <div className="p-6 flex-1">
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: plan.color }} />
                    <span className="text-sm text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={loading === plan.key}
                className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-50"
                style={{
                  backgroundColor: plan.popular ? plan.color : "var(--border)",
                  color: plan.popular ? "#0A0A0A" : "var(--foreground)",
                }}
              >
                {loading === plan.key
                  ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
                  : <>{plan.key.startsWith("studio") ? `Get ${plan.name}` : `Subscribe to ${plan.name}`} <ArrowRight size={13} /></>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Manage existing subscription */}
      <div
        className="rounded-2xl border p-5 flex items-center justify-between"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Already subscribed?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your plan, update payment method, or cancel anytime.
          </p>
        </div>
        <button
          onClick={handleManage}
          disabled={portalLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:border-accent/40 disabled:opacity-50 shrink-0 ml-4"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {portalLoading
            ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
            : <><ExternalLink size={13} /> Manage Billing</>}
        </button>
      </div>
    </div>
  );
}
