"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Share2, Users, Zap, ArrowRight } from "lucide-react";

// ─── Tier config (matches ReferralRewardTier enum + billing logic) ────────────

const TIERS = [
  { tier: "CREDIT_1",      min: 1,  label: "1 Free Press Kit Credit", color: "#D4A843" },
  { tier: "FREE_MONTH",    min: 3,  label: "Free Month",              color: "#34C759" },
  { tier: "DISCOUNT_20",   min: 5,  label: "20% Off Forever",         color: "#5AC8FA" },
  { tier: "LIFETIME_PUSH", min: 10, label: "Push Plan Free",          color: "#E85D4A" },
  { tier: "LIFETIME_REIGN",min: 25, label: "Reign Plan Free",         color: "#BF5AF2" },
] as const;

type TierKey = (typeof TIERS)[number]["tier"] | "NONE";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReferredUser = {
  firstName: string;
  tier:      string | null;
  isActive:  boolean;
  createdAt: string;
};

type ReferralData = {
  referralCode:  string | null;
  totalCount:    number;
  activeCount:   number;
  currentTier:   TierKey;
  referredUsers: ReferredUser[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierLabel(tier: string | null) {
  if (!tier) return null;
  const MAP: Record<string, string> = {
    LAUNCH: "Launch",
    PUSH:   "Push",
    REIGN:  "Reign",
  };
  return MAP[tier] ?? tier;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [data, setData]     = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/referrals")
      .then((r) => r.json())
      .then((d: ReferralData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const referralLink = data?.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://indiethis.com"}/signup?ref=${data.referralCode}`
    : null;

  async function copyLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Tier progress ──────────────────────────────────────────────────────────
  const activeCount  = data?.activeCount ?? 0;
  const currentTier  = data?.currentTier ?? "NONE";
  const currentIndex = TIERS.findIndex((t) => t.tier === currentTier);
  const nextTier     = currentIndex === -1 ? TIERS[0] : TIERS[currentIndex + 1] ?? null;
  const needed       = nextTier ? nextTier.min - activeCount : 0;

  // Progress bar: 0–1 within current tier range
  const prevMin      = currentIndex <= 0 ? 0 : TIERS[currentIndex - 1]?.min ?? 0;
  const nextMin      = nextTier?.min ?? (TIERS[TIERS.length - 1].min + 1);
  const progress     = nextTier
    ? Math.min(1, (activeCount - prevMin) / (nextMin - prevMin))
    : 1;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referrals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Invite friends and earn rewards — the more active referrals, the better your tier
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total */}
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Referred</p>
          </div>
          <p className="text-3xl font-bold text-foreground font-display">
            {loading ? "—" : data?.totalCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">all time sign-ups</p>
        </div>

        {/* Active */}
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={15} style={{ color: "#34C759" }} />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Now</p>
          </div>
          <p className="text-3xl font-bold text-foreground font-display">
            {loading ? "—" : activeCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">paid subscribers</p>
        </div>
      </div>

      {/* Tier progress card */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Current Reward Tier</p>
          {currentTier !== "NONE" ? (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `${TIERS.find((t) => t.tier === currentTier)?.color ?? "#D4A843"}20`,
                color: TIERS.find((t) => t.tier === currentTier)?.color ?? "#D4A843",
              }}
            >
              {TIERS.find((t) => t.tier === currentTier)?.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No tier yet</span>
          )}
        </div>

        {/* Progress bar */}
        {!loading && (
          <>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: nextTier?.color ?? "#D4A843",
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {nextTier ? (
                <>
                  <span className="font-semibold text-foreground">{activeCount}</span>
                  {" of "}
                  <span className="font-semibold text-foreground">{nextTier.min}</span>
                  {" active — "}
                  <span className="font-semibold" style={{ color: nextTier.color }}>
                    {needed} more
                  </span>
                  {" for "}
                  <span className="font-semibold text-foreground">{nextTier.label}</span>
                </>
              ) : (
                <span className="font-semibold text-foreground">Maximum tier reached — enjoy your free plan 🎉</span>
              )}
            </p>
          </>
        )}
      </div>

      {/* Referral link */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Share2 size={15} style={{ color: "#D4A843" }} />
          <h2 className="text-sm font-semibold text-foreground">Your Referral Link</h2>
        </div>

        {loading ? (
          <div className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: "var(--border)" }} />
        ) : referralLink ? (
          <>
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
            >
              <p className="text-sm text-muted-foreground flex-1 truncate font-mono">{referralLink}</p>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="px-2 py-0.5 rounded font-mono font-semibold text-xs"
                style={{ backgroundColor: "var(--border)", color: "var(--foreground)" }}
              >
                {data?.referralCode}
              </span>
              <span>Share with friends. Rewards apply automatically when they stay subscribed.</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load referral link. Refresh to try again.</p>
        )}
      </div>

      {/* Reward milestones */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: "#D4A843" }} />
            <p className="text-sm font-semibold text-foreground">Reward Tiers</p>
          </div>
        </div>

        {TIERS.map((t, i) => {
          const achieved  = activeCount >= t.min;
          const isCurrent = t.tier === currentTier;
          const isNext    = !isCurrent && nextTier?.tier === t.tier;
          return (
            <div
              key={t.tier}
              className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
              style={{ borderColor: "var(--border)", opacity: achieved || isCurrent || isNext ? 1 : 0.4 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm font-display"
                style={{
                  backgroundColor: achieved ? `${t.color}20` : "var(--border)",
                  color: achieved ? t.color : "var(--muted-foreground)",
                  border: isCurrent ? `1px solid ${t.color}80` : "none",
                }}
              >
                {achieved ? <Check size={16} /> : t.min}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.min} active referral{t.min !== 1 ? "s" : ""} required</p>
              </div>
              {achieved && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${t.color}18`, color: t.color }}
                >
                  Active
                </span>
              )}
              {isNext && !achieved && (
                <div className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: t.color }}>
                  <ArrowRight size={12} />
                  Next
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Referred users list */}
      {!loading && (data?.referredUsers.length ?? 0) > 0 && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: "#D4A843" }} />
                <p className="text-sm font-semibold text-foreground">People You&apos;ve Referred</p>
              </div>
              <p className="text-xs text-muted-foreground">{data!.referredUsers.length} total</p>
            </div>
          </div>

          {data!.referredUsers.map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              {/* Avatar initial */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
              >
                {u.firstName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{u.firstName}</p>
                <p className="text-xs text-muted-foreground">Joined {formatDate(u.createdAt)}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {u.tier && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: "var(--border)", color: "var(--muted-foreground)" }}
                  >
                    {tierLabel(u.tier)}
                  </span>
                )}
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={
                    u.isActive
                      ? { backgroundColor: "rgba(52,199,89,0.15)", color: "#34C759" }
                      : { backgroundColor: "var(--border)", color: "var(--muted-foreground)" }
                  }
                >
                  {u.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
        <div className="space-y-2.5">
          {[
            { step: "1", text: "Copy your referral link and share it with other artists." },
            { step: "2", text: "When they sign up and start a paid subscription, they count as an active referral." },
            { step: "3", text: "Your reward tier is based on active (paying) referrals. If they cancel, your count drops." },
            { step: "4", text: "Rewards are applied automatically on each billing cycle — no action needed from you." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
              >
                {step}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
