"use client";

import { Video, ImageIcon, Zap, FileText, ShoppingBag, Globe, Calendar, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  badge?: string;
};

const features: Feature[] = [
  { icon: Video,       title: "AI Music Videos",  color: "#D4A843", badge: "Most Popular",
    description: "Upload your track and a photo. Our AI generates cinematic music videos — vertical, horizontal, and square — in minutes." },
  { icon: ImageIcon,   title: "AI Cover Art",      color: "#E85D4A",
    description: "Describe your vision or upload a reference image. Get 4 stunning 3000×3000 options generated in seconds." },
  { icon: Zap,         title: "AI Mastering",      color: "#34C759",
    description: "Upload your unmastered track. Set your target loudness and style. A/B compare with your original before downloading." },
  { icon: FileText,    title: "AI A&R Report",     color: "#5AC8FA",
    description: "Get professional genre positioning, comparable artists, quality scores, playlist recommendations, and social strategy." },
  { icon: ShoppingBag, title: "Merch Storefronts", color: "#E85D4A",
    description: "Upload your artwork, apply it to 7 product types, set your markup, and sell — with zero inventory." },
  { icon: Globe,       title: "Artist Mini-Sites", color: "#00C7BD",
    description: "Your music, videos, merch, and bio — live on your own artist page. Reign tier gets a custom domain." },
  { icon: Calendar,    title: "Studio Booking",    color: "#5AC8FA",
    description: "Studios send you a branded SMS intake link. Everything from session details to deposit happens in one tap." },
  { icon: TrendingUp,  title: "Beat Marketplace",  color: "#34C759",
    description: "Sell beats with license tiers, preview clips, and direct checkout. Reign artists only." },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block rounded-full border border-accent/25 bg-accent/10 px-4 py-1 mb-5">
      <span className="text-accent text-[11px] font-semibold uppercase tracking-[0.08em]">
        {children}
      </span>
    </div>
  );
}

export default function Features() {
  return (
    <section id="features" className="relative py-24 px-6 bg-background overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-18">
          <SectionLabel>Platform Features</SectionLabel>
          <h2
            className="font-display font-extrabold text-foreground tracking-tight leading-[1.1] mb-4"
            style={{ fontSize: "clamp(32px,4vw,52px)", letterSpacing: "-1.5px" }}
          >
            Your music. Your money.{" "}
            <span className="text-muted-foreground">Your move.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-[520px] mx-auto leading-relaxed">
            One platform. Everything you need to create, sell, and grow as an
            independent artist.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-16">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card
                key={i}
                className="relative group/card transition-all duration-200 hover:-translate-y-0.5 hover:ring-border/40 hover:bg-surface-hover cursor-default overflow-visible"
              >
                {f.badge && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-cta/15 text-cta border border-cta/30 text-[11px] font-semibold tracking-wide px-3">
                      {f.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-0">
                  {/* 48px icon container with per-feature tint */}
                  <div
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center mb-3"
                    style={{
                      backgroundColor: `${f.color}18`,
                      border: `1px solid ${f.color}35`,
                    }}
                  >
                    <Icon size={24} color={f.color} strokeWidth={1.75} />
                  </div>
                  <CardTitle className="text-[17px] font-bold text-foreground tracking-tight">
                    {f.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
