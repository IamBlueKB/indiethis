"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Mic2, Music4, Building2, Gift, ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type PathType = "artist" | "producer" | "studio";

const PATH_OPTIONS: {
  value: PathType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value:       "artist",
    label:       "Artist",
    description: "Release music, sell beats, grow your fan base",
    icon:        <Mic2 size={18} />,
  },
  {
    value:       "producer",
    label:       "Producer",
    description: "Sell beats, manage licenses, collect royalties",
    icon:        <Music4 size={18} />,
  },
  {
    value:       "studio",
    label:       "Studio",
    description: "Manage bookings, artists, and file delivery",
    icon:        <Building2 size={18} />,
  },
];

// ─── Form ─────────────────────────────────────────────────────────────────────

function SignupForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from URL params
  const refCode      = searchParams.get("ref")          ?? undefined;
  const affiliateId  = searchParams.get("affiliate")    ?? undefined;
  const discountCode = searchParams.get("discount")     ?? undefined;
  const initialPromo = searchParams.get("promo")        ?? "";
  const source       = searchParams.get("source")       ?? undefined;
  const utmSource    = searchParams.get("utm_source")   ?? undefined;
  const utmMedium    = searchParams.get("utm_medium")   ?? undefined;
  const utmCampaign  = searchParams.get("utm_campaign") ?? undefined;
  const [landingPage] = useState<string | undefined>(() =>
    typeof window !== "undefined" ? (document.referrer || window.location.href) : undefined
  );

  // Form state
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [path,     setPath]     = useState<PathType>("artist");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Promo code
  const [promoExpanded,    setPromoExpanded]    = useState(!!initialPromo);
  const [promoCode,        setPromoCode]        = useState(initialPromo);
  const [promoValidating,  setPromoValidating]  = useState(false);
  const [promoError,       setPromoError]       = useState("");
  const [promoValid,       setPromoValid]       = useState<{ benefitDescription: string } | null>(null);

  async function validatePromo(c: string) {
    if (!c.trim()) return;
    setPromoValidating(true);
    setPromoError("");
    setPromoValid(null);
    try {
      const res  = await fetch("/api/promo/validate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: c.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setPromoError(data.error ?? "Invalid code.");
      else         setPromoValid(data.promoCode);
    } finally {
      setPromoValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // Map path → DB role
      const role = path === "studio" ? "STUDIO_ADMIN" : "ARTIST";

      const res = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name,
          email,
          password,
          role,
          referralCode: refCode,
          affiliateId,
          promoCode:    promoCode.trim() || undefined,
          source,
          utmSource,
          utmMedium,
          utmCampaign,
          landingPage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      // Auto sign-in
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login?registered=1");
      } else {
        // Send to pricing so they can pick a plan
        router.push(`/pricing?onboarding=1&path=${path}`);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[460px]">
      {/* Logo */}
      <div className="flex justify-center mb-7">
        <img
          src="/images/brand/indiethis-logo-dark-bg.svg"
          alt="IndieThis"
          style={{ height: "32px", width: "auto" }}
        />
      </div>

      <div
        className="rounded-2xl border p-8"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="text-center mb-6">
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            No credit card required to get started
          </p>
        </div>

        {/* Referral / affiliate banners */}
        {affiliateId && discountCode && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-5 text-xs font-medium"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)", color: "#D4A843" }}
          >
            <Gift size={13} className="shrink-0 mt-0.5" />
            <span>
              <strong>10% off your first 3 months</strong> — discount code{" "}
              <code className="font-mono">{discountCode}</code> will auto-apply at checkout.
            </span>
          </div>
        )}
        {!affiliateId && refCode && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-5 text-xs font-medium"
            style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)", color: "#D4A843" }}
          >
            <Gift size={13} className="shrink-0" />
            You were invited! You&apos;ll both get a bonus when you upgrade.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="name">
              Artist / Display Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="How you&apos;ll appear on the platform"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* I am a... */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">I am a…</label>
            <div className="grid grid-cols-3 gap-2">
              {PATH_OPTIONS.map((opt) => {
                const active = path === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPath(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
                      active
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background/50 hover:border-border/80"
                    )}
                  >
                    <span style={{ color: active ? "#E85D4A" : "var(--muted-foreground)" }}>
                      {opt.icon}
                    </span>
                    <span className="text-xs font-bold text-foreground leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-snug">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Promo code */}
          <div>
            <button
              type="button"
              onClick={() => { setPromoExpanded(!promoExpanded); setPromoError(""); setPromoValid(null); }}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--accent)" }}
            >
              <Gift size={14} />
              Have a promo code?
              <ChevronDown
                size={13}
                className="transition-transform"
                style={{ transform: promoExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {promoExpanded && (
              <div className="mt-2 flex gap-2">
                <input
                  placeholder="Enter code"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValid(null); setPromoError(""); }}
                  onBlur={() => promoCode.trim() && validatePromo(promoCode)}
                  className="flex-1 rounded-xl border px-3 py-2 text-sm font-mono tracking-widest uppercase bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/40"
                  style={{ borderColor: "var(--border)" }}
                  maxLength={20}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => validatePromo(promoCode)}
                  disabled={promoValidating || !promoCode.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  {promoValidating ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                </button>
              </div>
            )}
            {promoError && <p className="text-xs mt-1.5 text-red-400">{promoError}</p>}
            {promoValid && (
              <div
                className="flex items-center gap-2 mt-2 text-xs font-medium rounded-xl px-3 py-2"
                style={{ backgroundColor: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)", color: "#D4A843" }}
              >
                <CheckCircle2 size={13} className="shrink-0" />
                {promoValid.benefitDescription}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm rounded-xl px-3 py-2.5 bg-red-400/10 border border-red-400/20 text-red-400">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Creating account…</>
            ) : (
              "Create Account"
            )}
          </button>

          <p className="text-[11px] text-muted-foreground text-center">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline hover:text-foreground transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
