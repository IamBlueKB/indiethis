"use client";

import Link from "next/link";
import { ArrowRight, Users, MessageSquare, BarChart3, Mail, Upload, Calendar, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudioFeature = { icon: LucideIcon; title: string; description: string };

const studioFeatures: StudioFeature[] = [
  { icon: Calendar,     title: "Booking Management",
    description: "Send branded SMS intake links. Artists complete intake forms from their phone — session locked in before they arrive." },
  { icon: Users,        title: "Artist Roster",
    description: "Every artist you work with gets an IndieThis account. Track sessions, files, subscriptions, and revenue in one view." },
  { icon: Upload,       title: "File Delivery",
    description: "Upload mastered tracks, stems, and project files. Artists receive instant notifications and download from their dashboard." },
  { icon: Mail,         title: "Email Campaigns",
    description: "Send targeted email blasts to your roster — by genre, frequency, or subscription tier. Schedule or send immediately." },
  { icon: MessageSquare,title: "SMS Notifications",
    description: "Automated booking confirmations, session reminders, and file delivery alerts — built directly into the platform." },
  { icon: BarChart3,    title: "Revenue Tracking",
    description: "Stripe, PayPal, Zelle, and CashApp — all in one payment dashboard with daily, weekly, and monthly reporting." },
];

export default function ForStudios() {
  return (
    <section id="studios" className="relative py-24 px-6 overflow-hidden" style={{ backgroundColor: "#0D0D0F" }}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute top-1/3 -right-20 w-[500px] h-[500px]"
        style={{ background: "radial-gradient(ellipse, rgba(212,168,67,0.05) 0%, transparent 70%)" }} />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Left: Copy */}
          <div>
            <div className="inline-block rounded-full border border-accent/25 bg-accent/10 px-4 py-1 mb-6">
              <span className="text-accent text-[11px] font-semibold uppercase tracking-[0.08em]">For Studios</span>
            </div>

            <h2
              className="font-display font-extrabold text-foreground leading-[1.1] mb-5"
              style={{ fontSize: "clamp(32px,3.5vw,48px)", letterSpacing: "-1.5px" }}
            >
              Your studio.
              <br />
              Our platform.{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #D4A843, #E85D4A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                More revenue.
              </span>
            </h2>

            <p className="text-[17px] text-muted-foreground leading-relaxed mb-8 max-w-[480px]">
              IndieThis started in a recording studio in Chicago. We built the tools
              we needed — and now every studio on the platform gets them. CRM,
              booking, file delivery, email campaigns, and payments in one place.
            </p>

            {/* Flagship studio callout */}
            <Card className="mb-9">
              <CardContent className="pt-5 pb-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
                  Flagship Studio
                </div>
                <div className="font-display font-bold text-lg text-foreground tracking-tight mb-0.5">
                  Clear Ear Studios
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  Chicago, IL
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["Recording", "Mixing", "Mastering"].map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="rounded-full text-xs font-semibold border-accent/20 bg-accent/10 text-accent"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/studios"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "rounded-full h-auto px-6 py-3 text-sm font-bold gap-2 bg-accent text-accent-foreground hover:bg-accent/90 hover:-translate-y-px transition-all"
                )}
              >
                Onboard Your Studio
                <ArrowRight size={15} strokeWidth={2.5} />
              </Link>
              <Link
                href="/clearearstudios"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "rounded-full h-auto px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                See Example Studio
              </Link>
            </div>
          </div>

          {/* Right: Feature grid */}
          <div className="grid grid-cols-2 gap-4">
            {studioFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <Card key={i} className="transition-all duration-200 hover:bg-surface-hover hover:ring-border/40">
                  <CardContent className="pt-5 pb-5">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-3.5">
                      <Icon size={15} className="text-accent" strokeWidth={2} />
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
