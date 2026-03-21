"use client";

import Link from "next/link";
import {
  ArrowRight,
  Wand2,
  Globe,
  ShoppingBag,
  Music2,
  Users,
  BarChart3,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ArtistFeature = { icon: LucideIcon; title: string; description: string; color: string; bg: string; border: string };

const artistFeatures: ArtistFeature[] = [
  {
    icon: Wand2,
    title: "AI Tools Suite",
    description:
      "Cover art, music videos, mastering, lyric videos, press kits, and A&R reports — all AI-powered and built for indie artists.",
    color: "text-[#D4A843]",
    bg: "bg-[#D4A843]/10",
    border: "border-[#D4A843]/20",
  },
  {
    icon: Globe,
    title: "Artist Website",
    description:
      "An 18-section public page: hero, music, videos, merch, shows, gallery, press, booking, and more — live in minutes.",
    color: "text-[#5AC8FA]",
    bg: "bg-[#5AC8FA]/10",
    border: "border-[#5AC8FA]/20",
  },
  {
    icon: Music2,
    title: "Beat Marketplace",
    description:
      "Sell beats directly to artists on the platform. Set your price, keep your masters, get paid instantly via Stripe.",
    color: "text-[#00C7BD]",
    bg: "bg-[#00C7BD]/10",
    border: "border-[#00C7BD]/20",
  },
  {
    icon: ShoppingBag,
    title: "Merch Storefront",
    description:
      "Launch a merch store on your artist page. Sell tees, hats, and physical products without a separate Shopify account.",
    color: "text-[#E85D4A]",
    bg: "bg-[#E85D4A]/10",
    border: "border-[#E85D4A]/20",
  },
  {
    icon: Users,
    title: "Fan Database & SMS",
    description:
      "Build your fan list, capture emails, and send SMS blasts. Own your audience — not an algorithm.",
    color: "text-[#34C759]",
    bg: "bg-[#34C759]/10",
    border: "border-[#34C759]/20",
  },
  {
    icon: BarChart3,
    title: "Earnings & Analytics",
    description:
      "Track merch sales, beat revenue, studio sessions, and streaming in one dashboard. Know exactly where your money comes from.",
    color: "text-[#BF5AF2]",
    bg: "bg-[#BF5AF2]/10",
    border: "border-[#BF5AF2]/20",
  },
];

const tiers = [
  { name: "Launch", price: 19, tagline: "Start making moves", color: "#9A9A9E" },
  { name: "Push",   price: 49, tagline: "Scale your sound",   color: "#D4A843", popular: true },
  { name: "Reign",  price: 149, tagline: "Own your lane",     color: "#E85D4A" },
];

export default function ForArtists() {
  return (
    <section id="artists" className="relative py-24 px-6 overflow-hidden" style={{ backgroundColor: "#0A0A0B" }}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div
        className="pointer-events-none absolute top-1/3 -left-20 w-[600px] h-[600px]"
        style={{ background: "radial-gradient(ellipse, rgba(212,168,67,0.06) 0%, transparent 70%)" }}
      />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Left: Copy */}
          <div>
            <div className="inline-block rounded-full border border-accent/25 bg-accent/10 px-4 py-1 mb-6">
              <span className="text-accent text-[11px] font-semibold uppercase tracking-[0.08em]">For Artists</span>
            </div>

            <h2
              className="font-display font-extrabold text-foreground leading-[1.1] mb-5"
              style={{ fontSize: "clamp(32px,3.5vw,48px)", letterSpacing: "-1.5px" }}
            >
              Your music.{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #D4A843, #E85D4A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Your fans.
              </span>
              <br />
              More money.
            </h2>

            <p className="text-[17px] text-muted-foreground leading-relaxed mb-8 max-w-[480px]">
              IndieThis gives independent artists everything they need to release,
              promote, and monetize — without a label. AI tools, a full artist
              website, merch, beats, fan management, and real earnings analytics,
              all in one place built for you.
            </p>

            {/* Tier mini-cards */}
            <div className="flex gap-3 mb-9 flex-wrap">
              {tiers.map((t) => (
                <Card
                  key={t.name}
                  className={cn(
                    "flex-1 min-w-[90px] transition-all duration-200",
                    t.popular ? "ring-1" : ""
                  )}
                  style={t.popular ? { borderColor: t.color, boxShadow: `0 0 12px ${t.color}22` } : {}}
                >
                  <CardContent className="pt-4 pb-4 px-4 text-center">
                    {t.popular && (
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: t.color }}>
                        Most Popular
                      </div>
                    )}
                    <div className="font-display font-bold text-base text-foreground tracking-tight" style={{ color: t.color }}>
                      {t.name}
                    </div>
                    <div className="text-xl font-extrabold text-foreground mt-0.5">
                      ${t.price}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t.tagline}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "rounded-full h-auto px-6 py-3 text-sm font-bold gap-2 bg-accent text-accent-foreground hover:bg-accent/90 hover:-translate-y-px transition-all"
                )}
              >
                Start for Free
                <ArrowRight size={15} strokeWidth={2.5} />
              </Link>
              <Link
                href="#pricing"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "rounded-full h-auto px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                See All Plans
              </Link>
            </div>
          </div>

          {/* Right: Feature grid */}
          <div className="grid grid-cols-2 gap-4">
            {artistFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <Card key={i} className="transition-all duration-200 hover:bg-surface-hover hover:ring-border/40">
                  <CardContent className="pt-5 pb-5">
                    <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center mb-3.5", f.bg, f.border)}>
                      <Icon size={15} className={f.color} strokeWidth={2} />
                    </div>
                    <h4 className="text-sm font-bold text-foreground mb-1.5 tracking-tight">{f.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
