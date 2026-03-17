"use client";

import { useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SocialProof() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { setSubmitted(true); setEmail(""); }
  };

  return (
    <section className="relative py-24 px-6 bg-background overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Subtle glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px]"
        style={{ background: "radial-gradient(ellipse at center, rgba(212,168,67,0.05) 0%, transparent 70%)" }} />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Waitlist CTA */}
        <div className="text-center mb-20">
          <div className="inline-block rounded-full border border-accent/25 bg-accent/10 px-4 py-1 mb-6">
            <span className="text-accent text-[11px] font-semibold uppercase tracking-[0.08em]">Early Access</span>
          </div>

          <h2
            className="font-display font-extrabold text-foreground leading-[1.1] mb-4"
            style={{ fontSize: "clamp(32px,4vw,52px)", letterSpacing: "-1.5px" }}
          >
            Be one of the first artists on{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #D4A843, #E85D4A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              IndieThis.
            </span>
          </h2>

          <p className="text-lg text-muted-foreground mb-10 max-w-[480px] mx-auto leading-relaxed">
            Join the waitlist. Early access members get first dibs on every AI tool,
            priority studio onboarding, and locked-in launch pricing.
          </p>

          {submitted ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-6 py-3.5 text-sm font-semibold text-accent">
              <span className="size-2 rounded-full bg-accent shadow-[0_0_8px_rgba(212,168,67,0.8)]" />
              You&apos;re on the list. We&apos;ll be in touch.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-[480px] mx-auto"
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="rounded-full bg-card border-border h-12 text-base flex-1 px-5"
              />
              <Button
                type="submit"
                className="rounded-full h-12 px-6 font-bold bg-accent text-accent-foreground hover:bg-accent/90 gap-2 shadow-[0_4px_24px_rgba(212,168,67,0.2)] hover:shadow-[0_6px_32px_rgba(212,168,67,0.35)] transition-all hover:-translate-y-px shrink-0"
              >
                Join Waitlist
                <ArrowRight size={16} strokeWidth={2.5} />
              </Button>
            </form>
          )}

          <p className="mt-4 text-xs text-muted-foreground/60">
            No spam. Unsubscribe anytime. We launch soon.
          </p>
        </div>

        {/* Coming soon — artist stories */}
        <div className="rounded-2xl border border-border-subtle bg-card/50 px-8 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock size={14} className="text-muted-foreground/50" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              Coming Soon
            </span>
          </div>
          <p className="text-base font-medium text-muted-foreground">
            Stories from real artists on IndieThis.
          </p>
        </div>
      </div>
    </section>
  );
}
