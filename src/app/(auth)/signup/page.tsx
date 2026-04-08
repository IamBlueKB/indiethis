"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Mic2, Music4, Building2, Gift, ChevronDown, CheckCircle2, Eye, EyeOff } from "lucide-react";
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

  // OAuth detection — set when redirected from NextAuth signIn callback
  const oauthProvider = searchParams.get("oauth") ?? "";          // "google" | "facebook" | ""
  const isOAuth       = !!oauthProvider;
  const socialName    = searchParams.get("name")  ?? "";
  const socialEmail   = searchParams.get("email") ?? "";

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

  const [firstVisitAt] = useState<string | undefined>(() => {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.split(";").find((c) => c.trim().startsWith("itev="));
    return match ? match.trim().slice(5) : undefined;
  });

  // Form state — pre-fill from social if OAuth
  const [email,    setEmail]    = useState(socialEmail);
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState(socialName);
  const [path,     setPath]     = useState<PathType>("artist");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Promo code
  const [promoExpanded,    setPromoExpanded]    = useState(!!initialPromo);
  const [promoCode,        setPromoCode]        = useState(initialPromo);
  const [promoValidating,  setPromoValidating]  = useState(false);
  const [promoError,       setPromoError]       = useState("");
  const [promoValid,       setPromoValid]       = useState<{ benefitDescription: string } | null>(null);

  async function handleSocial(provider: "google" | "facebook") {
    setSocialLoading(provider);
    setError("");
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
      setSocialLoading(null);
    }
  }

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

    if (!isOAuth && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    try {
      const role = path === "studio" ? "STUDIO_ADMIN" : "ARTIST";

      const res = await fetch("/api/auth/signup-init", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name,
          email,
          password:     isOAuth ? undefined : password,
          authProvider: isOAuth ? oauthProvider : "email",
          role,
          signupPath:   path,
          referralCode: refCode,
          affiliateId,
          promoCode:       promoCode.trim() || undefined,
          source,
          utmSource,
          utmMedium,
          utmCampaign,
          landingPage,
          firstVisitAt:    firstVisitAt ? new Date(Number(firstVisitAt)).toISOString() : undefined,
          agreedToTerms:   true,
          agreedToTermsAt: new Date().toISOString(),
        }),
      });

      const data = await res.json() as { pendingId?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      router.push(`/pricing?onboarding=1&path=${path}&pending=${data.pendingId}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputBase = "w-full rounded-xl border px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 transition-shadow";

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
            {isOAuth
              ? `Signed in with ${oauthProvider === "google" ? "Google" : "Facebook"} — pick your path below`
              : "Create your account, then pick a plan"}
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

        {/* ── Social login buttons (only show when NOT already in OAuth flow) ── */}
        {!isOAuth && (
          <>
            <div className="space-y-3 mb-5">
              <button
                type="button"
                onClick={() => handleSocial("google")}
                disabled={!!socialLoading || loading}
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-input bg-white text-[#0A0A0A] text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {socialLoading === "google" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => handleSocial("facebook")}
                disabled={!!socialLoading || loading}
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#1877F2" }}
              >
                {socialLoading === "facebook" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                Continue with Facebook
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center mb-5">
              <div className="flex-1 border-t border-border" />
              <span className="mx-3 text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>
          </>
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
              readOnly={isOAuth}
              className={cn(inputBase, isOAuth && "opacity-60 cursor-not-allowed")}
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {/* Password — hidden for OAuth users */}
          {!isOAuth && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputBase, "pr-10")}
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Display name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="name">
              Artist / Display Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="How you'll appear on the platform"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
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

          {/* Terms checkbox */}
          <label
            style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => { setAgreedToTerms(e.target.checked); if (e.target.checked) setError(""); }}
              style={{
                marginTop: 2,
                width: 16,
                height: 16,
                flexShrink: 0,
                accentColor: "#D4A843",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#D4A843", textDecoration: "none" }}
              >
                Terms of Service
              </Link>
              {" "}and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#D4A843", textDecoration: "none" }}
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          {/* CTA */}
          <button
            type="submit"
            disabled={loading || !!socialLoading}
            className="w-full h-11 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#E85D4A", color: "#fff" }}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Creating account…</>
            ) : (
              "Continue to Payment →"
            )}
          </button>
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
