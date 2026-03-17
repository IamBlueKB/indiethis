import Link from "next/link";
import {
  Calendar, Users, Upload, Mail, MessageSquare, BarChart3,
  ArrowRight, CheckCircle2, Building2,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Booking Management",
    description: "Send branded SMS intake links. Artists fill intake forms from their phone — session details and deposit collected before they walk in.",
  },
  {
    icon: Users,
    title: "Artist Roster CRM",
    description: "Every artist you work with gets a profile. Track sessions, files delivered, subscription tier, and contact history in one view.",
  },
  {
    icon: Upload,
    title: "File Delivery",
    description: "Upload mastered tracks, stems, and project files. Artists are notified instantly and download directly from their dashboard.",
  },
  {
    icon: Mail,
    title: "Email Campaigns",
    description: "Send targeted email blasts to your roster. Filter by genre, visit frequency, or subscription tier. Schedule or send immediately.",
  },
  {
    icon: MessageSquare,
    title: "SMS Notifications",
    description: "Automated booking confirmations, session reminders, and file delivery alerts built directly into the booking workflow.",
  },
  {
    icon: BarChart3,
    title: "Payment Tracking",
    description: "Track payments across Stripe, Zelle, PayPal, and CashApp in one dashboard. Daily, weekly, and monthly reporting built in.",
  },
];

const included = [
  "Branded intake form links via SMS",
  "Full artist CRM with session history",
  "Unlimited file delivery with download tracking",
  "Email blast campaigns to your roster",
  "Automated booking reminders",
  "Payment dashboard with multi-method tracking",
  "Invoice generation and PDF export",
  "Public studio profile page",
];

export default function StudiosPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>

      {/* Nav */}
      <header className="border-b px-6 h-16 flex items-center justify-between max-w-7xl mx-auto w-full"
        style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #D4A843, #E85D4A)" }}>
            <Building2 size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-[17px] text-foreground tracking-tight">IndieThis</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
            Sign in
          </Link>
          <Link href="/signup?role=STUDIO_ADMIN"
            className="rounded-full px-5 py-2 text-sm font-semibold no-underline transition-all hover:-translate-y-px"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]"
          style={{ background: "radial-gradient(ellipse, rgba(212,168,67,0.07) 0%, transparent 70%)" }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-block rounded-full border px-4 py-1 mb-6"
            style={{ borderColor: "rgba(212,168,67,0.3)", backgroundColor: "rgba(212,168,67,0.1)" }}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#D4A843" }}>
              For Recording Studios
            </span>
          </div>
          <h1 className="font-display font-extrabold text-foreground leading-[1.05] mb-6"
            style={{ fontSize: "clamp(40px, 5vw, 68px)", letterSpacing: "-2px" }}>
            Run your studio
            <br />
            <span style={{
              background: "linear-gradient(135deg, #D4A843, #E85D4A)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              like a business.
            </span>
          </h1>
          <p className="text-[18px] text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
            Booking management, artist CRM, file delivery, email campaigns, and payment tracking —
            all built for recording studios. No spreadsheets. No missed sessions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup?role=STUDIO_ADMIN"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold no-underline transition-all hover:-translate-y-px"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
              Onboard Your Studio
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <Link href="/#studios"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium no-underline border transition-colors hover:border-accent/40"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-6" style={{ backgroundColor: "#0D0D0F" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
              Everything Included
            </p>
            <h2 className="font-display font-extrabold text-foreground leading-tight"
              style={{ fontSize: "clamp(28px,3vw,40px)", letterSpacing: "-1px" }}>
              One platform. Every tool you need.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border p-6"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)" }}>
                    <Icon size={17} strokeWidth={1.75} style={{ color: "#D4A843" }} />
                  </div>
                  <h3 className="font-display font-bold text-foreground mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What's included checklist */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border p-10 md:p-14"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
                  Studio Plan
                </p>
                <h2 className="font-display font-extrabold text-foreground mb-4 leading-tight"
                  style={{ fontSize: "clamp(26px,3vw,38px)", letterSpacing: "-1px" }}>
                  Everything included.
                  <br />
                  <span style={{ color: "#D4A843" }}>No extras.</span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  One flat monthly rate. All features. Unlimited artists on your roster.
                  Cancel anytime.
                </p>
                <Link href="/signup?role=STUDIO_ADMIN"
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold no-underline transition-all hover:-translate-y-px"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  Get Started
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
              </div>
              <ul className="space-y-3">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: "#34C759" }} />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 text-center border-t" style={{ borderColor: "var(--border)" }}>
        <h2 className="font-display font-extrabold text-foreground mb-4 leading-tight"
          style={{ fontSize: "clamp(28px,3vw,42px)", letterSpacing: "-1px" }}>
          Ready to streamline your studio?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Join IndieThis and spend less time on admin, more time recording.
        </p>
        <Link href="/signup?role=STUDIO_ADMIN"
          className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold no-underline transition-all hover:-translate-y-px"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
          Onboard Your Studio
          <ArrowRight size={16} strokeWidth={2.5} />
        </Link>
      </section>

    </div>
  );
}
