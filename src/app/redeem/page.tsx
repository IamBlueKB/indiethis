"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Gift, CheckCircle2, Loader2, Zap, Star, Music2, ArrowRight } from "lucide-react";
import Link from "next/link";

// ── Tier feature lists ────────────────────────────────────────────────────────

const TIER_FEATURES: Record<string, string[]> = {
  LAUNCH: [
    "5 AI Cover Arts / month",
    "1 AI Master / month",
    "Artist mini-site",
    "Merch storefront",
    "Studio session booking",
  ],
  PUSH: [
    "10 AI Cover Arts / month",
    "2 AI Music Videos / month",
    "3 AI Masters / month",
    "1 Lyric Video / month",
    "2 A&R Reports / month",
    "Full artist mini-site",
  ],
  REIGN: [
    "15 AI Cover Arts / month",
    "5 AI Music Videos / month",
    "10 AI Masters / month",
    "3 Lyric Videos / month",
    "5 A&R Reports / month",
    "Custom domain artist site",
    "Beat marketplace access",
    "Priority support",
  ],
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  FREE_TRIAL: <Zap size={28} />,
  DISCOUNT:   <Star size={28} />,
  COMP:       <CheckCircle2 size={28} />,
  CREDIT:     <Gift size={28} />,
  AI_BUNDLE:  <Music2 size={28} />,
};

const BG = "#0A0A0A";
const GOLD = "#D4A843";
const CORAL = "#E85D4A";
const SANS = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";
const SERIF = "var(--font-playfair, 'Playfair Display', Georgia, serif)";

// ── Main component ────────────────────────────────────────────────────────────

function RedeemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [promoData, setPromoData] = useState<{
    type: string;
    tier?: string | null;
    benefitDescription: string;
  } | null>(null);

  // Auto-validate if code comes from URL
  useEffect(() => {
    if (searchParams.get("code")) {
      handleValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleValidate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return;
    setError("");
    setPromoData(null);
    setLoading(true);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code.");
      } else {
        setPromoData(data.promoCode);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    if (!promoData) return;
    setActivating(true);
    setError("");
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to activate code.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    } finally {
      setActivating(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 size={56} className="mx-auto mb-6" style={{ color: GOLD }} />
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: SERIF }}>
          Code activated!
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)" }}>Taking you to your dashboard…</p>
      </div>
    );
  }

  const features = promoData?.tier ? TIER_FEATURES[promoData.tier] ?? [] : [];

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-12">
        <Link href="/">
          <img src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" style={{ height: 36 }} />
        </Link>
      </div>

      {/* Heading */}
      <div className="text-center mb-10">
        <h1 className="font-bold mb-3" style={{ fontSize: "clamp(1.8rem,5vw,2.8rem)", fontFamily: SERIF }}>
          Enter your promo code
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontFamily: SANS }}>
          Unlock free access, discounts, and exclusive benefits.
        </p>
      </div>

      {/* Code input */}
      <form onSubmit={handleValidate} className="flex gap-3 mb-8">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setPromoData(null);
            setError("");
          }}
          placeholder="YOURCODE"
          className="flex-1 rounded-xl px-5 py-4 text-center text-xl font-bold tracking-widest outline-none border"
          style={{
            backgroundColor: "#111",
            borderColor: promoData ? GOLD : "rgba(255,255,255,0.1)",
            color: "#FAFAFA",
            fontFamily: SANS,
          }}
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="px-6 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: GOLD, color: BG, fontFamily: SANS, minWidth: 90 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Apply"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="text-center text-sm mb-6" style={{ color: CORAL }}>{error}</p>
      )}

      {/* Benefit card */}
      {promoData && (
        <div
          className="rounded-2xl border p-7 mb-8"
          style={{ borderColor: `${GOLD}40`, backgroundColor: "#111" }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${GOLD}18`, color: GOLD }}
            >
              {TYPE_ICONS[promoData.type] ?? <Gift size={28} />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg mb-1" style={{ fontFamily: SERIF }}>
                {promoData.benefitDescription}
              </p>
              {features.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <span style={{ color: GOLD }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6">
            {sessionStatus === "authenticated" ? (
              // Logged in → activate directly
              <button
                onClick={handleActivate}
                disabled={activating}
                className="w-full py-4 rounded-xl font-bold text-base transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: CORAL, color: "#fff", fontFamily: SANS }}
              >
                {activating ? (
                  <><Loader2 size={18} className="animate-spin" /> Activating…</>
                ) : (
                  <>Activate Now <ArrowRight size={18} /></>
                )}
              </button>
            ) : (
              // Not logged in → go to signup with code pre-attached
              <Link
                href={`/signup?promo=${encodeURIComponent(code)}`}
                className="w-full py-4 rounded-xl font-bold text-base no-underline transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: CORAL, color: "#fff", fontFamily: SANS }}
              >
                Create Account &amp; Activate <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Already have an account */}
      {!session && (
        <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.35)", fontFamily: SANS }}>
          Already have an account?{" "}
          <Link href="/login" className="no-underline hover:opacity-80" style={{ color: GOLD }}>
            Sign in to activate
          </Link>
        </p>
      )}
    </>
  );
}

export default function RedeemPage() {
  return (
    <div
      className="min-h-screen flex items-start justify-center px-4 py-16"
      style={{ backgroundColor: BG, color: "#FAFAFA" }}
    >
      <div className="w-full max-w-md">
        <Suspense>
          <RedeemContent />
        </Suspense>
      </div>
    </div>
  );
}
