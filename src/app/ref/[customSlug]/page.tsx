import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ customSlug: string }> }
): Promise<Metadata> {
  const { customSlug } = await params;
  const affiliate = await db.affiliate.findUnique({
    where: { customSlug, status: "APPROVED" },
    select: { applicantName: true },
  });
  if (!affiliate) return { title: "IndieThis" };
  return {
    title: `${affiliate.applicantName} recommends IndieThis`,
    description: `${affiliate.applicantName} uses IndieThis to power their music career. Get 10% off your first 3 months.`,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AffiliateLandingPage(
  { params }: { params: Promise<{ customSlug: string }> }
) {
  const { customSlug } = await params;

  const affiliate = await db.affiliate.findUnique({
    where: { customSlug, status: "APPROVED" },
    select: {
      id: true,
      applicantName: true,
      discountCode: true,
    },
  });

  if (!affiliate) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
  const signupUrl =
    `${appUrl}/signup?affiliate=${affiliate.id}&discount=${affiliate.discountCode ?? ""}`;

  const firstName = affiliate.applicantName.split(" ")[0];

  const features = [
    { emoji: "🎵", title: "Artist Profiles & Site Builder", desc: "Your own page at indiethis.com/[you]" },
    { emoji: "🤖", title: "AI Music Tools", desc: "Music videos, cover art, mastering & A&R reports" },
    { emoji: "🛍️", title: "Merch & Beat Store", desc: "Sell digital downloads and merch with zero platform cut" },
    { emoji: "📅", title: "Booking & Studio Sessions", desc: "Manage sessions and get paid automatically" },
    { emoji: "📊", title: "Career Analytics", desc: "Track streams, earnings, and audience growth" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0A0A0A", color: "#F5F5F5" }}
    >
      {/* Nav */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/8">
        <Link href="/" className="no-underline">
          <img
            src="/images/brand/indiethis-logo-dark-bg.svg"
            alt="IndieThis"
            style={{ height: "26px", width: "auto" }}
          />
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium no-underline"
          style={{ color: "var(--muted-foreground, #888)" }}
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pt-16 pb-20">
        <div className="w-full max-w-2xl space-y-10 text-center">

          {/* Referrer pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border" style={{ borderColor: "rgba(212,168,67,0.3)", backgroundColor: "rgba(212,168,67,0.08)" }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg,#D4A843,#E85D4A)", color: "#0A0A0A" }}
            >
              {firstName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium" style={{ color: "#D4A843" }}>
              {affiliate.applicantName} recommends IndieThis
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              The all-in-one platform<br />
              <span style={{ color: "#D4A843" }}>built for independent artists</span>
            </h1>
            <p className="text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
              Sell music, book studios, run AI tools, and grow your fanbase — all in one place. {firstName} sent you here for a reason.
            </p>
          </div>

          {/* Discount offer card */}
          <div
            className="rounded-2xl p-6 text-center mx-auto max-w-sm"
            style={{
              background: "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(232,93,74,0.08))",
              border: "1px solid rgba(212,168,67,0.35)",
            }}
          >
            <div className="text-3xl mb-2">🎁</div>
            <p className="text-base font-bold text-white mb-1">Special offer from {firstName}</p>
            <p className="text-sm text-white/60 mb-3">
              Use{" "}
              {affiliate.discountCode && (
                <code
                  className="font-mono font-bold px-1.5 py-0.5 rounded text-sm mx-0.5"
                  style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
                >
                  {affiliate.discountCode}
                </code>
              )}{" "}
              at checkout
            </p>
            <div
              className="inline-block px-4 py-2 rounded-xl text-sm font-bold"
              style={{ backgroundColor: "rgba(212,168,67,0.2)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.4)" }}
            >
              10% off your first 3 months
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link
              href={signupUrl}
              className="inline-flex items-center justify-center gap-2 w-full max-w-sm px-8 py-4 rounded-2xl text-base font-bold no-underline transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              Join IndieThis — Free to explore →
            </Link>
            <p className="text-xs text-white/40">
              Free plan available. No credit card required to get started.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-xl p-4"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-xl shrink-0 mt-0.5">{f.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-white/50 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer nudge */}
          <p className="text-sm text-white/40 pt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-white/60 underline hover:text-white transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Bottom branding */}
      <footer className="border-t border-white/8 py-6 px-6 flex items-center justify-center gap-2">
        <img
          src="/images/brand/indiethis-watermark.svg"
          alt="IndieThis"
          style={{ height: "16px", width: "auto", opacity: 0.5 }}
        />
      </footer>
    </div>
  );
}
