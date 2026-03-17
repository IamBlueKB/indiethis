"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function WaveformBars() {
  return (
    <div className="flex items-center gap-[3px] h-[60px] opacity-35">
      {Array.from({ length: 40 }).map((_, i) => {
        const h = Math.sin(i * 0.5) * 0.5 + 0.5;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: `${20 + h * 40}px`,
              backgroundColor: "var(--color-accent)",
              borderRadius: 2,
              animation: `waveform ${1.2 + (i % 5) * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-20 text-center bg-background">
      {/* Radial glows */}
      <div className="pointer-events-none absolute top-[10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.08) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute bottom-[20%] left-[20%] w-[400px] h-[400px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(232,93,74,0.06) 0%, transparent 70%)" }} />

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(42,42,46,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(42,42,46,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="mb-8 flex justify-center">
          <Badge
            variant="outline"
            className="gap-2 rounded-full border-accent/25 bg-accent/10 text-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          >
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(212,168,67,0.8)]" />
            The Artist&apos;s Platform
          </Badge>
        </div>

        {/* Headline */}
        <h1
          className="mb-6 font-display font-extrabold leading-[1.05] tracking-[-2px]"
          style={{ fontSize: "clamp(42px,6vw,80px)" }}
        >
          Everything an{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #D4A843 0%, #E0B85A 50%, #E85D4A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            indie artist
          </span>{" "}
          needs in one place.
        </h1>

        {/* Subheadline */}
        <p
          className="mx-auto mb-12 max-w-[580px] text-muted-foreground leading-relaxed"
          style={{ fontSize: "clamp(17px,2vw,21px)" }}
        >
          AI music videos, cover art, mastering, merch storefronts, studio booking,
          and your own artist site — built for independent musicians who don&apos;t have a label.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-center mb-16">
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ variant: "default" }),
              "rounded-full h-auto px-7 py-3.5 text-base font-bold gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_4px_24px_rgba(212,168,67,0.25)] hover:shadow-[0_6px_32px_rgba(212,168,67,0.4)] transition-all hover:-translate-y-px"
            )}
          >
            Start Creating
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
          <a
            href="#studios"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full h-auto px-7 py-3.5 text-base font-semibold transition-all"
            )}
          >
            Onboard Your Studio
          </a>
        </div>

        {/* Waveform + tagline */}
        <div className="flex flex-col items-center gap-5">
          <WaveformBars />
          <p className="text-sm font-medium text-muted-foreground tracking-wide">
            Built for independent artists.{" "}
            <span className="text-accent">Powered by AI.</span>{" "}
            Owned by you.
          </p>
        </div>
      </div>
    </section>
  );
}
