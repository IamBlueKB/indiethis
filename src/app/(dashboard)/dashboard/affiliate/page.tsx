"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Share2,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

type Referral = {
  id: string;
  isActive: boolean;
  monthsRemaining: number;
  totalCommissionPaid: number;
  createdAt: string;
  referredUser: {
    name: string | null;
    createdAt: string;
    subscription: { tier: string; status: string } | null;
  } | null;
};

type AffiliateData = {
  id: string;
  status: string;
  applicantName: string;
  applicantEmail: string;
  customSlug: string | null;
  discountCode: string | null;
  commissionRate: number;
  commissionDurationMonths: number;
  totalEarned: number;
  pendingPayout: number;
  stripeConnectAccountId: string | null;
  approvedAt: string | null;
  affiliateLink: string | null;
  stripeConnectStatus: "not_connected" | "pending" | "active";
  canRequestPayout: boolean;
  activeReferrals: number;
  totalReferrals: number;
  referrals: Referral[];
};

/* ------------------------------------------------------------------ */
/* Copy button helper                                                   */
/* ------------------------------------------------------------------ */

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: ignore */
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: copied ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.06)",
        color: copied ? "var(--accent)" : "var(--muted-foreground)",
        border: "1px solid",
        borderColor: copied ? "rgba(212,168,67,0.3)" : "var(--border)",
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {label ?? (copied ? "Copied!" : "Copy")}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tier badge                                                            */
/* ------------------------------------------------------------------ */

function TierBadge({ tier }: { tier: string | null | undefined }) {
  const label = tier ?? "Free";
  const colors: Record<string, string> = {
    LAUNCH: "rgba(96,165,250,0.15)",
    PUSH: "rgba(167,139,250,0.15)",
    REIGN: "rgba(212,168,67,0.15)",
  };
  const textColors: Record<string, string> = {
    LAUNCH: "#60a5fa",
    PUSH: "#a78bfa",
    REIGN: "#D4A843",
  };
  return (
    <span
      className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase"
      style={{
        backgroundColor: colors[label] ?? "rgba(255,255,255,0.06)",
        color: textColors[label] ?? "var(--muted-foreground)",
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */

export default function AffiliateDashboardPage() {
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/affiliate/me")
      .then((r) => r.json())
      .then((data) => {
        setAffiliate(data.affiliate);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleConnect() {
    setConnectLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Failed to initiate Stripe Connect.");
        setConnectLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setConnectLoading(false);
    }
  }

  async function handlePayout() {
    setPayoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/payout", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setPayoutSuccess(data.amountPaid);
        setAffiliate((prev) => prev ? { ...prev, pendingPayout: 0, canRequestPayout: false } : prev);
      } else {
        setError(data.error ?? "Payout failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPayoutLoading(false);
    }
  }

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  /* ---------- not an affiliate / pending ---------- */
  if (!affiliate || affiliate.status === "PENDING") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: "rgba(212,168,67,0.1)" }}
        >
          <Share2 size={24} style={{ color: "var(--accent)" }} />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
          {affiliate?.status === "PENDING" ? "Application Under Review" : "Join the Affiliate Program"}
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
          {affiliate?.status === "PENDING"
            ? "Your application is being reviewed. You'll receive an email once approved."
            : "Earn commissions by referring studios and artists to IndieThis."}
        </p>
        {!affiliate && (
          <a
            href="/affiliate/apply"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
          >
            Apply to Become an Affiliate
            <ChevronRight size={16} />
          </a>
        )}
      </div>
    );
  }

  /* ---------- rejected / suspended ---------- */
  if (affiliate.status === "REJECTED" || affiliate.status === "SUSPENDED") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
        >
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
          {affiliate.status === "REJECTED" ? "Application Not Approved" : "Account Suspended"}
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {affiliate.status === "REJECTED"
            ? "Your affiliate application was not approved at this time. Contact support for more information."
            : "Your affiliate account has been suspended. Please contact support."}
        </p>
      </div>
    );
  }

  /* ---------- approved dashboard ---------- */
  const commissionPct = Math.round(affiliate.commissionRate * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Affiliate Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Earn {commissionPct}% commission for {affiliate.commissionDurationMonths} months per referral
        </p>
      </div>

      {/* Success banner */}
      {payoutSuccess !== null && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }}
        >
          <Check size={16} />
          Payout of ${payoutSuccess.toFixed(2)} sent to your Stripe account!
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Referral link + discount code */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          Your Links
        </h2>

        {/* Affiliate link */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Referral Link</p>
          {affiliate.affiliateLink ? (
            <div className="flex items-center gap-2 flex-wrap">
              <code
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm truncate"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  fontFamily: "monospace",
                }}
              >
                {affiliate.affiliateLink}
              </code>
              <CopyButton value={affiliate.affiliateLink} />
              <a
                href={affiliate.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                <ExternalLink size={12} />
                Open
              </a>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Link not yet assigned. Contact support.
            </p>
          )}
        </div>

        {/* Discount code */}
        {affiliate.discountCode && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Discount Code (10% off for 3 months)</p>
            <div className="flex items-center gap-2">
              <code
                className="px-3 py-2 rounded-lg text-sm font-mono tracking-wider"
                style={{
                  backgroundColor: "rgba(212,168,67,0.08)",
                  border: "1px solid rgba(212,168,67,0.2)",
                  color: "var(--accent)",
                }}
              >
                {affiliate.discountCode}
              </code>
              <CopyButton value={affiliate.discountCode} />
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={18} />}
          label="Total Referrals"
          value={String(affiliate.totalReferrals)}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Active Referrals"
          value={String(affiliate.activeReferrals)}
          accent
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label="Total Earned"
          value={`$${affiliate.totalEarned.toFixed(2)}`}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Pending Payout"
          value={`$${affiliate.pendingPayout.toFixed(2)}`}
          accent={affiliate.pendingPayout >= 25}
        />
      </div>

      {/* Payout / Connect stripe */}
      <div
        className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Payouts via Stripe
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {affiliate.stripeConnectStatus === "active" && "Your Stripe account is connected and ready."}
            {affiliate.stripeConnectStatus === "pending" && "Stripe account connected — verification in progress."}
            {affiliate.stripeConnectStatus === "not_connected" && "Connect Stripe to receive payouts. Minimum $25."}
          </p>
        </div>

        {affiliate.stripeConnectStatus === "not_connected" && (
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 shrink-0"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
          >
            {connectLoading ? <Loader2 size={15} className="animate-spin" /> : null}
            Connect Stripe
          </button>
        )}

        {affiliate.stripeConnectStatus === "pending" && (
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 shrink-0"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {connectLoading ? <Loader2 size={15} className="animate-spin" /> : null}
            Complete Onboarding
          </button>
        )}

        {affiliate.stripeConnectStatus === "active" && (
          <button
            onClick={handlePayout}
            disabled={payoutLoading || !affiliate.canRequestPayout}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 shrink-0"
            style={{
              backgroundColor: affiliate.canRequestPayout ? "var(--accent)" : "rgba(255,255,255,0.06)",
              color: affiliate.canRequestPayout ? "#0A0A0A" : "var(--muted-foreground)",
              border: affiliate.canRequestPayout ? "none" : "1px solid var(--border)",
            }}
          >
            {payoutLoading ? <Loader2 size={15} className="animate-spin" /> : null}
            {affiliate.canRequestPayout
              ? `Request Payout ($${affiliate.pendingPayout.toFixed(2)})`
              : `Min. $25 required`}
          </button>
        )}
      </div>

      {/* Referrals list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Referred Users
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
          >
            {affiliate.totalReferrals} total
          </span>
        </div>

        {affiliate.referrals.length === 0 ? (
          <div className="px-5 py-10 text-center" style={{ backgroundColor: "var(--card)" }}>
            <Users size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              No referrals yet. Share your link to start earning!
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: "var(--card)" }}>
            {/* Table header */}
            <div
              className="hidden sm:grid px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide border-b"
              style={{
                gridTemplateColumns: "1fr 100px 90px 90px 90px",
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
                backgroundColor: "rgba(255,255,255,0.02)",
              }}
            >
              <span>User</span>
              <span>Plan</span>
              <span className="text-right">Months Left</span>
              <span className="text-right">Earned</span>
              <span className="text-right">Status</span>
            </div>

            {affiliate.referrals.map((ref, i) => {
              const name = ref.referredUser?.name ?? ref.referredUser?.createdAt
                ? "Unknown User"
                : "Deleted User";
              const signupDate = ref.referredUser?.createdAt
                ? new Date(ref.referredUser.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })
                : "—";
              const tier = ref.referredUser?.subscription?.tier;

              return (
                <div
                  key={ref.id}
                  className={`px-5 py-4 ${i < affiliate.referrals.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{name}</p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Joined {signupDate}</p>
                      </div>
                      <TierBadge tier={tier} />
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <span>{ref.monthsRemaining} months remaining</span>
                      <span>${ref.totalCommissionPaid.toFixed(2)} earned</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                        style={{
                          backgroundColor: ref.isActive ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)",
                          color: ref.isActive ? "#4ade80" : "var(--muted-foreground)",
                        }}
                      >
                        {ref.isActive ? "Active" : "Ended"}
                      </span>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div
                    className="hidden sm:grid items-center"
                    style={{ gridTemplateColumns: "1fr 100px 90px 90px 90px" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Joined {signupDate}</p>
                    </div>
                    <div><TierBadge tier={tier} /></div>
                    <p className="text-sm text-right" style={{ color: "var(--foreground)" }}>
                      {ref.monthsRemaining}
                    </p>
                    <p className="text-sm text-right font-medium" style={{ color: "var(--accent)" }}>
                      ${ref.totalCommissionPaid.toFixed(2)}
                    </p>
                    <div className="flex justify-end">
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase"
                        style={{
                          backgroundColor: ref.isActive ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.06)",
                          color: ref.isActive ? "#4ade80" : "var(--muted-foreground)",
                        }}
                      >
                        {ref.isActive ? "Active" : "Ended"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard helper                                                      */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        backgroundColor: "var(--card)",
        border: `1px solid ${accent ? "rgba(212,168,67,0.2)" : "var(--border)"}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{
          backgroundColor: accent ? "rgba(212,168,67,0.1)" : "rgba(255,255,255,0.05)",
          color: accent ? "var(--accent)" : "var(--muted-foreground)",
        }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
        <p className="text-xl font-bold mt-0.5" style={{ color: "var(--foreground)" }}>{value}</p>
      </div>
    </div>
  );
}
