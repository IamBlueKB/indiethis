"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Zap } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PRICING_DEFAULTS } from "@/lib/pricing";

type FeatureValue = string | boolean | null;
type TierFeature = { label: string; value: FeatureValue };

export interface PricingProps {
  planLaunch?:    number;
  planPush?:      number;
  planReign?:     number;
  studioPro?:     number;
  studioElite?:   number;
  coverArt?:      string;
  mastering?:     string;
  lyricVideo?:    string;
  aarReport?:     string;
  pressKit?:      string;
  videoShort?:    string;
  videoMedium?:   string;
  videoLong?:     string;
  cutMerchPush?:  string;
  cutMerchReign?: string;
}

function buildArtistTiers(p: Required<PricingProps>) {
  return [
    {
      name: "Launch", price: p.planLaunch, tagline: "Start making moves", color: "#9A9A9E", popular: false,
      features: [
        { label: "AI Cover Art",        value: "5 / month" },
        { label: "AI Music Videos",     value: null },
        { label: "AI Mastering",        value: "1 / month" },
        { label: "Lyric Video",         value: false },
        { label: "AI A&R Report",       value: false },
        { label: "Press Kit Generator", value: true },
        { label: "Artist Mini-Site",    value: "Profile only" },
        { label: "Merch Storefront",    value: false },
        { label: "Beat Marketplace",    value: false },
        { label: "Studio Time",         value: false },
        { label: "10% Off À La Carte",  value: false },
      ] as TierFeature[],
    },
    {
      name: "Push", price: p.planPush, tagline: "Scale your sound", color: "#D4A843", popular: true,
      features: [
        { label: "AI Cover Art",        value: "10 / month" },
        { label: "AI Music Videos",     value: "2 / month" },
        { label: "AI Mastering",        value: "3 / month" },
        { label: "Lyric Video",         value: true },
        { label: "AI A&R Report",       value: "1 / month" },
        { label: "Press Kit Generator", value: true },
        { label: "Artist Mini-Site",    value: "Full site" },
        { label: "Merch Storefront",    value: `Yes (${p.cutMerchPush} cut)` },
        { label: "Beat Marketplace",    value: false },
        { label: "Studio Time",         value: false },
        { label: "10% Off À La Carte",  value: true },
      ] as TierFeature[],
    },
    {
      name: "Reign", price: p.planReign, tagline: "Own your lane", color: "#E85D4A", popular: false,
      features: [
        { label: "AI Cover Art",        value: "15 / month" },
        { label: "AI Music Videos",     value: "5 / month" },
        { label: "AI Mastering",        value: "10 / month" },
        { label: "Lyric Video",         value: true },
        { label: "AI A&R Report",       value: "3 / month" },
        { label: "Press Kit Generator", value: true },
        { label: "Artist Mini-Site",    value: "Full + custom domain" },
        { label: "Merch Storefront",    value: `Yes (${p.cutMerchReign} cut)` },
        { label: "Beat Marketplace",    value: true },
        { label: "Studio Time",         value: "2 hrs / month" },
        { label: "10% Off À La Carte",  value: true },
      ] as TierFeature[],
    },
  ];
}

function buildStudioTiers(p: Required<PricingProps>) {
  return [
    {
      name: "Pro", price: p.studioPro, tagline: "Run your studio smarter", color: "#9A9A9E", popular: false, cta: "Get Started",
      features: [
        { label: "Studio admin dashboard",           value: true },
        { label: "Bookings + CRM",                   value: true },
        { label: "Intake, invoicing, file delivery",  value: true },
        { label: "Email blasts",                     value: "500/mo" },
        { label: "Public page (AI styles)",           value: "3 styles" },
        { label: "AI page generations",              value: "3/mo" },
        { label: "Contact form on page",             value: true },
        { label: "AI video upsell at intake",        value: true },
        { label: "Featured artists section",         value: false },
        { label: "Gallery",                          value: "6 photos" },
        { label: "Custom accent color",              value: false },
        { label: "Custom domain",                    value: false },
        { label: "Analytics dashboard",              value: false },
        { label: "Priority support",                 value: false },
      ] as TierFeature[],
    },
    {
      name: "Elite", price: p.studioElite, tagline: "The full studio experience", color: "#E85D4A", popular: true, cta: "Go Elite",
      features: [
        { label: "Studio admin dashboard",           value: true },
        { label: "Bookings + CRM",                   value: true },
        { label: "Intake, invoicing, file delivery",  value: true },
        { label: "Email blasts",                     value: "2,000/mo" },
        { label: "Public page (AI styles)",           value: "All styles" },
        { label: "AI page generations",              value: "10/mo" },
        { label: "Contact form on page",             value: true },
        { label: "AI video upsell at intake",        value: true },
        { label: "Featured artists section",         value: true },
        { label: "Gallery",                          value: "12 photos" },
        { label: "Custom accent color",              value: true },
        { label: "Custom domain",                    value: true },
        { label: "Analytics dashboard",              value: true },
        { label: "Priority support",                 value: true },
      ] as TierFeature[],
    },
  ];
}

function FeatureRow({ value }: { value: FeatureValue }) {
  if (value === null || value === false)
    return <Minus size={15} className="text-border" />;
  if (value === true)
    return <Check size={15} className="text-success" strokeWidth={2.5} />;
  return <span className="text-xs font-medium text-foreground">{value}</span>;
}

function ArtistCards({ p }: { p: Required<PricingProps> }) {
  const tiers = buildArtistTiers(p);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-14">
      {tiers.map((tier) => (
        <Card
          key={tier.name}
          className={cn("relative transition-all", tier.popular && "scale-[1.02]")}
          style={{
            backgroundColor: "var(--card)",
            ...(tier.popular
              ? { border: `2px solid ${tier.color}70`, boxShadow: `0 0 48px ${tier.color}15, 0 0 0 1px ${tier.color}40` }
              : { border: "1px solid var(--border)" }),
          }}
        >
          <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {tier.popular && (
              <Badge className="rounded-full text-xs font-bold gap-1 px-3 py-1 bg-accent text-accent-foreground border-0 shadow-lg whitespace-nowrap">
                <Zap size={10} strokeWidth={3} />
                Most Popular
              </Badge>
            )}
          </div>
          <CardHeader className="pb-2 pt-1">
            <h3 className="font-display font-extrabold text-xl tracking-tight mb-1" style={{ color: tier.color }}>
              {tier.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{tier.tagline}</p>
            <div className="flex items-baseline gap-1">
              <span className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: "52px", letterSpacing: "-2px" }}>
                ${tier.price}
              </span>
              <span className="text-base text-muted-foreground font-medium">/mo</span>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="py-4">
            <div className="space-y-0">
              {tier.features.map((f, i) => (
                <div
                  key={i}
                  className={cn("flex items-center justify-between py-2.5", i < tier.features.length - 1 && "border-b border-border-subtle")}
                >
                  <span className="text-sm" style={{ color: f.value === null || f.value === false ? "#4A4A4E" : "var(--color-muted-foreground)" }}>
                    {f.label}
                  </span>
                  <FeatureRow value={f.value} />
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-transparent border-t-0 px-4 pb-5 pt-2">
            <Link
              href="/signup"
              className={cn(
                "w-full rounded-full h-11 font-bold text-sm transition-all inline-flex items-center justify-center",
                tier.popular
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "border hover:bg-surface-hover"
              )}
              style={!tier.popular ? { borderColor: `${tier.color}50`, color: tier.color } : undefined}
            >
              Get {tier.name}
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function StudioCards({ p }: { p: Required<PricingProps> }) {
  const tiers = buildStudioTiers(p);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-14 max-w-3xl mx-auto w-full">
      {tiers.map((tier) => (
        <Card
          key={tier.name}
          className={cn("relative transition-all", tier.popular && "scale-[1.02]")}
          style={{
            backgroundColor: "var(--card)",
            ...(tier.popular
              ? { border: `2px solid ${tier.color}70`, boxShadow: `0 0 48px ${tier.color}15, 0 0 0 1px ${tier.color}40` }
              : { border: "1px solid var(--border)" }),
          }}
        >
          <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {tier.popular && (
              <Badge className="rounded-full text-xs font-bold gap-1 px-3 py-1 border-0 shadow-lg whitespace-nowrap" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
                <Zap size={10} strokeWidth={3} />
                Most Popular
              </Badge>
            )}
          </div>
          <CardHeader className="pb-2 pt-1">
            <h3 className="font-display font-extrabold text-xl tracking-tight mb-1" style={{ color: tier.color }}>
              {tier.name}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{tier.tagline}</p>
            <div className="flex items-baseline gap-1">
              <span className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: "52px", letterSpacing: "-2px" }}>
                ${tier.price}
              </span>
              <span className="text-base text-muted-foreground font-medium">/mo</span>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="py-4">
            <div className="space-y-0">
              {tier.features.map((f, i) => (
                <div
                  key={i}
                  className={cn("flex items-center justify-between py-2.5", i < tier.features.length - 1 && "border-b border-border-subtle")}
                >
                  <span className="text-sm" style={{ color: f.value === null || f.value === false ? "#4A4A4E" : "var(--color-muted-foreground)" }}>
                    {f.label}
                  </span>
                  <FeatureRow value={f.value} />
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-transparent border-t-0 px-4 pb-5 pt-2">
            <Link
              href="/signup"
              className="w-full rounded-full h-11 font-bold text-sm transition-all inline-flex items-center justify-center"
              style={
                tier.popular
                  ? { backgroundColor: "#E85D4A", color: "#fff" }
                  : { border: "1px solid #E85D4A80", color: "#E85D4A" }
              }
            >
              {tier.cta}
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function Pricing({ pricing = {} }: { pricing?: PricingProps }) {
  const [tab, setTab] = useState<"artists" | "studios">("artists");

  // Merge with defaults
  const p: Required<PricingProps> = {
    planLaunch:    pricing.planLaunch    ?? PRICING_DEFAULTS.PLAN_LAUNCH.value,
    planPush:      pricing.planPush      ?? PRICING_DEFAULTS.PLAN_PUSH.value,
    planReign:     pricing.planReign     ?? PRICING_DEFAULTS.PLAN_REIGN.value,
    studioPro:     pricing.studioPro     ?? PRICING_DEFAULTS.STUDIO_PRO.value,
    studioElite:   pricing.studioElite   ?? PRICING_DEFAULTS.STUDIO_ELITE.value,
    coverArt:      pricing.coverArt      ?? PRICING_DEFAULTS.AI_COVER_ART.display,
    mastering:     pricing.mastering     ?? PRICING_DEFAULTS.AI_MASTERING.display,
    lyricVideo:    pricing.lyricVideo    ?? PRICING_DEFAULTS.AI_LYRIC_VIDEO.display,
    aarReport:     pricing.aarReport     ?? PRICING_DEFAULTS.AI_AAR_REPORT.display,
    pressKit:      pricing.pressKit      ?? PRICING_DEFAULTS.AI_PRESS_KIT.display,
    videoShort:    pricing.videoShort    ?? PRICING_DEFAULTS.AI_VIDEO_SHORT.display,
    videoMedium:   pricing.videoMedium   ?? PRICING_DEFAULTS.AI_VIDEO_MEDIUM.display,
    videoLong:     pricing.videoLong     ?? PRICING_DEFAULTS.AI_VIDEO_LONG.display,
    cutMerchPush:  pricing.cutMerchPush  ?? PRICING_DEFAULTS.CUT_MERCH_PUSH.display,
    cutMerchReign: pricing.cutMerchReign ?? PRICING_DEFAULTS.CUT_MERCH_REIGN.display,
  };

  const alaCarteItems = [
    { name: "AI Music Video",  options: [`${p.videoShort} (30s)`, `${p.videoMedium} (1min)`, `${p.videoLong} (3min)`] },
    { name: "AI Cover Art",    options: [p.coverArt] },
    { name: "AI Mastering",    options: [p.mastering] },
    { name: "Lyric Video",     options: [p.lyricVideo] },
    { name: "AI A&R Report",   options: [p.aarReport] },
    { name: "Press Kit",       options: [p.pressKit] },
  ];

  return (
    <section id="pricing" className="relative py-24 px-6 bg-background">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block rounded-full border border-accent/25 bg-accent/10 px-4 py-1 mb-5">
            <span className="text-accent text-[11px] font-semibold uppercase tracking-[0.08em]">Pricing</span>
          </div>
          <h2
            className="font-display font-extrabold text-foreground leading-[1.1] mb-4"
            style={{ fontSize: "clamp(32px,4vw,52px)", letterSpacing: "-1.5px" }}
          >
            Simple pricing.{" "}
            <span className="text-muted-foreground">No surprises.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-[420px] mx-auto mb-8">
            Every tier is month-to-month. Cancel anytime.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setTab("artists")}
              className="rounded-full px-6 py-2.5 text-sm font-bold transition-all"
              style={
                tab === "artists"
                  ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }
                  : { border: "1px solid var(--border)", color: "var(--muted-foreground)", backgroundColor: "transparent" }
              }
            >
              For Artists
            </button>
            <button
              onClick={() => setTab("studios")}
              className="rounded-full px-6 py-2.5 text-sm font-bold transition-all"
              style={
                tab === "studios"
                  ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }
                  : { border: "1px solid var(--border)", color: "var(--muted-foreground)", backgroundColor: "transparent" }
              }
            >
              For Studios
            </button>
          </div>
        </div>

        {/* Tier cards */}
        {tab === "artists" ? <ArtistCards p={p} /> : <StudioCards p={p} />}

        {/* À La Carte — artists only */}
        {tab === "artists" && (
          <Card style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <CardHeader>
              <h3 className="text-xl font-bold tracking-tight">Pay Per Use</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No subscription needed. Just pick a tool and go. Push and Reign subscribers save 10%.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {alaCarteItems.map((item, i) => (
                  <div key={i} className="rounded-[10px] border border-border-subtle bg-background p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">{item.name}</div>
                    {item.options.map((opt, j) => (
                      <div key={j} className="text-xs text-accent font-medium leading-[1.8]">{opt}</div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
