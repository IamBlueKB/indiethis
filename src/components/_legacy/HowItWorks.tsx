"use client";

import { UserPlus, Wand2, DollarSign, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  detail: string;
};

const steps: Step[] = [
  {
    number: "01", icon: UserPlus, color: "#D4A843",
    title: "Join",
    detail: "Setup takes under 5 minutes",
    description: "Sign up and connect with your studio — or join on your own. Your account comes pre-loaded with AI credits, a merch storefront builder, and your own artist page. No label required.",
  },
  {
    number: "02", icon: Wand2, color: "#E85D4A",
    title: "Create",
    detail: "AI video in under 30 minutes",
    description: "Use AI to generate music videos, cover art, and mastered tracks. Build your merch catalog. Customize your artist site. All of it in one dashboard, built for working musicians.",
  },
  {
    number: "03", icon: DollarSign, color: "#34C759",
    title: "Earn",
    detail: "Direct payouts, no delays",
    description: "Sell music, merch, and beats directly through your artist page. Keep the majority of every sale. Get paid via Stripe Connect. Track every dollar in your earnings dashboard.",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative py-24 px-6 overflow-hidden" style={{ backgroundColor: "#0D0D0F" }}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block rounded-full border border-accent/25 bg-accent/10 px-4 py-1 mb-5">
            <span className="text-accent text-[11px] font-semibold uppercase tracking-[0.08em]">
              How It Works
            </span>
          </div>
          <h2
            className="font-display font-extrabold text-foreground leading-[1.1] mb-4"
            style={{ fontSize: "clamp(32px,4vw,52px)", letterSpacing: "-1.5px" }}
          >
            From first track to{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #D4A843, #E85D4A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              first sale.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-[420px] mx-auto">
            Three steps. No label. No middleman.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.number} className="text-center relative">
                {/* Step number */}
                <span className="absolute top-5 right-5 font-mono text-xs font-semibold text-border tracking-widest">
                  {s.number}
                </span>

                <CardContent className="pt-8 pb-8 flex flex-col items-center">
                  {/* Icon ring */}
                  <div
                    className="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-7"
                    style={{
                      backgroundColor: `${s.color}15`,
                      border: `2px solid ${s.color}30`,
                      boxShadow: `0 0 32px ${s.color}20`,
                    }}
                  >
                    <Icon size={28} color={s.color} strokeWidth={1.8} />
                  </div>

                  <h3
                    className="font-display font-extrabold mb-4 tracking-tight"
                    style={{ fontSize: "28px", color: s.color, letterSpacing: "-0.5px" }}
                  >
                    {s.title}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-[280px]">
                    {s.description}
                  </p>

                  <Badge
                    variant="outline"
                    className="rounded-full text-xs font-medium gap-1.5"
                    style={{
                      backgroundColor: `${s.color}12`,
                      borderColor: `${s.color}25`,
                      color: s.color,
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.detail}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
