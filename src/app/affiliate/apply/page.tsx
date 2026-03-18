"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Music2, Mic2, Settings2, User, Users } from "lucide-react";
import Link from "next/link";

type CreatorType = "producer" | "engineer" | "vocal_coach" | "artist" | "other";

const CREATOR_TYPES: { value: CreatorType; label: string }[] = [
  { value: "producer",     label: "Beat Producer" },
  { value: "engineer",     label: "Recording Engineer" },
  { value: "vocal_coach",  label: "Vocal Coach" },
  { value: "artist",       label: "Recording Artist" },
  { value: "other",        label: "Other Creator" },
];

const AUDIENCE_SIZES = [
  { value: "under_1k",    label: "Under 1,000" },
  { value: "1k_5k",       label: "1,000 – 5,000" },
  { value: "5k_25k",      label: "5,000 – 25,000" },
  { value: "25k_100k",    label: "25,000 – 100,000" },
  { value: "over_100k",   label: "100,000+" },
];

export default function AffiliatePage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    socialLinks: "",
    audienceSize: "",
    creatorType: "" as CreatorType | "",
    promotionPlan: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.audienceSize || !form.creatorType || !form.promotionPlan) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-10 text-center space-y-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <CheckCircle size={40} className="mx-auto" style={{ color: "#34C759" }} />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Application Received!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Thanks for applying to the IndieThis Affiliate Program. We review applications manually and will email you within 3–5 business days with next steps.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium no-underline"
            style={{ color: "#D4A843" }}
          >
            Back to IndieThis →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Header */}
      <header
        className="h-16 flex items-center px-6 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <Link href="/" className="no-underline">
          <img
            src="/images/brand/indiethis-logo-dark-bg.svg"
            alt="IndieThis"
            style={{ height: "22px", width: "auto" }}
          />
        </Link>
      </header>

      {/* Body */}
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl space-y-8">
          {/* Intro */}
          <div className="space-y-2 text-center">
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-1"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
            >
              Affiliate Program
            </span>
            <h1 className="text-2xl font-bold text-foreground">Apply to Partner with IndieThis</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Earn 20% commission for 12 months on every artist you refer. Share your unique link, give your audience 10% off their first 3 months, and get paid monthly.
            </p>
          </div>

          {/* Perks grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "💸", label: "20% commission", sub: "for 12 months" },
              { icon: "🎟️", label: "10% off coupon", sub: "for your audience" },
              { icon: "📈", label: "Real-time stats", sub: "in your dashboard" },
            ].map((p) => (
              <div
                key={p.label}
                className="rounded-xl border p-3 text-center"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="text-xl mb-1">{p.icon}</div>
                <p className="text-xs font-semibold text-foreground">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">{p.sub}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border p-7 space-y-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Name + Email */}
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Full Name <span style={{ color: "#E85D4A" }}>*</span>
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Kendrick L."
                  className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground bg-transparent placeholder:text-muted-foreground focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)", focusRingColor: "#D4A843" } as React.CSSProperties}
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email <span style={{ color: "#E85D4A" }}>*</span>
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground bg-transparent placeholder:text-muted-foreground focus:outline-none focus:ring-1"
                  style={{ borderColor: "var(--border)" } as React.CSSProperties}
                  required
                />
              </label>
            </div>

            {/* Creator type */}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                I am a… <span style={{ color: "#E85D4A" }}>*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {CREATOR_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => set("creatorType", ct.value)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                    style={
                      form.creatorType === ct.value
                        ? { backgroundColor: "rgba(212,168,67,0.15)", borderColor: "#D4A843", color: "#D4A843" }
                        : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                    }
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </label>

            {/* Social links */}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Social Media Links
              </span>
              <textarea
                value={form.socialLinks}
                onChange={(e) => set("socialLinks", e.target.value)}
                placeholder="Instagram, YouTube, TikTok, website — paste links separated by newlines"
                rows={3}
                className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground bg-transparent placeholder:text-muted-foreground focus:outline-none resize-none"
                style={{ borderColor: "var(--border)" }}
              />
            </label>

            {/* Audience size */}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Total Audience Size <span style={{ color: "#E85D4A" }}>*</span>
              </span>
              <select
                value={form.audienceSize}
                onChange={(e) => set("audienceSize", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground bg-transparent focus:outline-none appearance-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                required
              >
                <option value="" disabled>Select range…</option>
                {AUDIENCE_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>

            {/* Promotion plan */}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                How do you plan to promote IndieThis? <span style={{ color: "#E85D4A" }}>*</span>
              </span>
              <textarea
                value={form.promotionPlan}
                onChange={(e) => set("promotionPlan", e.target.value)}
                placeholder="e.g. YouTube tutorials, IG posts to my beat-making audience, podcast mentions…"
                rows={4}
                className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground bg-transparent placeholder:text-muted-foreground focus:outline-none resize-none"
                style={{ borderColor: "var(--border)" }}
                required
              />
            </label>

            {error && (
              <p className="text-sm rounded-xl px-4 py-2.5" style={{ backgroundColor: "rgba(232,93,74,0.1)", color: "#E85D4A" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-black transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#D4A843" }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? "Submitting…" : "Submit Application"}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              By applying you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground transition-colors no-underline" style={{ color: "inherit" }}>
                Terms of Service
              </Link>
              . Applications are reviewed within 3–5 business days.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
