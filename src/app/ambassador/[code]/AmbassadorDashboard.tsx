"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Star, ExternalLink, DollarSign } from "lucide-react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

type AmbassadorData = {
  ambassador: {
    id: string;
    name: string;
    tier: string;
    rewardType: string;
    rewardValue: number;
    creditBalance: number;
    totalEarned: number;
    totalPaidOut: number;
    stripeConnectId: boolean;
    promoCodes: Array<{ code: string; type: string }>;
  };
  stats: { totalRedemptions: number; totalConversions: number };
  redemptions: Array<{ email: string; redeemedAt: string; status: string; code: string }>;
  payouts: Array<{ amount: number; method: string; createdAt: string }>;
  primaryCode: string;
};

const TIER_COLORS: Record<string, string> = {
  STANDARD:  "#9A9A9E",
  PREFERRED: "#D4A843",
  ELITE:     "#E85D4A",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "#34D399",
  CONVERTED: "#D4A843",
  EXPIRED:   "#f87171",
  REVOKED:   "#9A9A9E",
};

const SOCIAL_TEMPLATES = {
  Instagram: (code: string, url: string) => `🎵 Been using IndieThis for my music career and it's been a game changer! Distribution, AI tools, studio booking — all in one.

Use my code ${code} at signup and get a free trial 🔥

➡️ ${url}

#IndieThisMusic #IndieArtist #MusicProduction #IndependentArtist`,
  Twitter: (code: string, url: string) => `If you're a musician grinding independently, you need @IndieThis

Use my code ${code} → free trial waiting for you

${url}`,
  TikTok: (code: string, url: string) => `POV: you finally found the all-in-one platform for independent musicians 🎵✨

Link in bio — use code ${code} for a free trial

${url}`,
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AmbassadorDashboard({
  code,
  ambassadorName,
}: {
  code: string;
  ambassadorName: string;
}) {
  const [data, setData] = useState<AmbassadorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<keyof typeof SOCIAL_TEMPLATES>("Instagram");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://indiethis.com";
  const referralUrl = `${appUrl}/signup?promo=${code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=0A0A0A&color=D4A843&data=${encodeURIComponent(referralUrl)}`;

  useEffect(() => {
    fetch(`/api/ambassador/${code}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, [code]);

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function copyTemplate(platform: string) {
    if (!data) return;
    const fn = SOCIAL_TEMPLATES[platform as keyof typeof SOCIAL_TEMPLATES];
    if (!fn) return;
    await navigator.clipboard.writeText(fn(code, referralUrl));
    setCopiedTemplate(platform);
    setTimeout(() => setCopiedTemplate(null), 2000);
  }

  async function requestPayout() {
    setPayoutLoading(true);
    setPayoutMsg("");
    try {
      const res = await fetch(`/api/ambassador/${code}/payout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      if (res.ok) {
        setPayoutMsg(`✓ Payout of $${d.amount.toFixed(2)} requested successfully!`);
        // Refresh data
        fetch(`/api/ambassador/${code}`).then((r) => r.json()).then((nd) => { if (!nd.error) setData(nd); });
      } else {
        setPayoutMsg(d.error ?? "Payout failed.");
      }
    } finally {
      setPayoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background, #0A0A0A)", color: "#fff" }}>
        <p className="text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const amb = data?.ambassador;
  const stats = data?.stats ?? { totalRedemptions: 0, totalConversions: 0 };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A", color: "#fff" }}>
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/brand/indiethis-logo-dark-bg.svg" alt="IndieThis" width={120} height={28} />
            <span className="text-xs text-white/40 hidden sm:block">Ambassador Dashboard</span>
          </div>
          {amb && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/70">{amb.name}</span>
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ color: TIER_COLORS[amb.tier] ?? "#888", backgroundColor: `${TIER_COLORS[amb.tier] ?? "#888"}22` }}
              >
                <Star size={9} fill="currentColor" />
                {amb.tier}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {ambassadorName.split(" ")[0]}!</h1>
          <p className="text-white/50 text-sm mt-1">Here&apos;s how your referrals are performing.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Referrals", value: stats.totalRedemptions, color: "#5AC8FA" },
            { label: "Conversions", value: stats.totalConversions, color: "#D4A843" },
            { label: "Balance", value: `$${(amb?.creditBalance ?? 0).toFixed(2)}`, color: "#34D399" },
            { label: "Total Earned", value: `$${(amb?.totalEarned ?? 0).toFixed(2)}`, color: "#E85D4A" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border p-5"
              style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <p className="text-xs text-white/40 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Referral Link + QR */}
        <div className="rounded-2xl border p-6" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}>
          <h2 className="font-semibold mb-4">Your Referral Link</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-3">
              <div
                className="flex items-center gap-2 rounded-xl border px-4 py-3 cursor-pointer hover:border-[#D4A843]/50 transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.03)" }}
                onClick={copyLink}
              >
                <span className="flex-1 text-sm font-mono text-white/70 truncate">{referralUrl}</span>
                <button className="shrink-0 text-white/40 hover:text-white transition-colors">
                  {copiedLink ? <Check size={16} style={{ color: "#34D399" }} /> : <Copy size={16} />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {copiedLink ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                </button>
                <a
                  href={referralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80"
                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                >
                  <ExternalLink size={14} /> Preview
                </a>
              </div>
            </div>
            {/* QR Code */}
            <div
              className="rounded-xl p-3 border shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR Code" width={160} height={160} className="rounded-lg" />
              <p className="text-xs text-white/30 text-center mt-2">Scan to sign up</p>
            </div>
          </div>
        </div>

        {/* Social Asset Templates */}
        <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}>
          <h2 className="font-semibold">Social Assets</h2>
          <div className="flex gap-2">
            {(Object.keys(SOCIAL_TEMPLATES) as (keyof typeof SOCIAL_TEMPLATES)[]).map((platform) => (
              <button
                key={platform}
                onClick={() => setActiveTab(platform)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === platform ? "#D4A843" : "rgba(255,255,255,0.06)",
                  color: activeTab === platform ? "#0A0A0A" : "rgba(255,255,255,0.6)",
                }}
              >
                {platform}
              </button>
            ))}
          </div>
          <div
            className="rounded-xl p-4 text-sm text-white/70 font-mono whitespace-pre-wrap"
            style={{ backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {SOCIAL_TEMPLATES[activeTab](code, referralUrl)}
          </div>
          <button
            onClick={() => copyTemplate(activeTab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
          >
            {copiedTemplate === activeTab ? <><Check size={14} style={{ color: "#34D399" }} /> Copied!</> : <><Copy size={14} /> Copy Caption</>}
          </button>
        </div>

        {/* Referral List + Payout side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          {/* Referral List */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}>
            <div className="px-5 py-3.5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <h2 className="font-semibold text-sm">Recent Referrals</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-white/40">Email</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-white/40">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-white/40">Status</th>
                </tr>
              </thead>
              <tbody>
                {!data?.redemptions?.length ? (
                  <tr><td colSpan={3} className="text-center py-8 text-white/30 text-xs">No referrals yet. Share your link to get started!</td></tr>
                ) : data.redemptions.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-5 py-2.5 text-xs text-white/60">{r.email}</td>
                    <td className="px-5 py-2.5 text-xs text-white/40">{new Date(r.redeemedAt).toLocaleDateString()}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-bold"
                        style={{ color: STATUS_COLORS[r.status] ?? "#888", backgroundColor: `${STATUS_COLORS[r.status] ?? "#888"}22` }}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payout Section */}
          <div
            className="rounded-2xl border p-5 space-y-4 h-fit"
            style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <h2 className="font-semibold text-sm">Payouts</h2>
            <div>
              <p className="text-xs text-white/40">Available Balance</p>
              <p className="text-3xl font-bold mt-0.5" style={{ color: "#34D399" }}>
                ${(amb?.creditBalance ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="text-xs text-white/30 space-y-1">
              <p>• Minimum payout: $25</p>
              <p>• Payouts sent via Stripe</p>
              <p>• Allow 1–3 business days</p>
            </div>

            {amb?.stripeConnectId ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: "#34D399" }}>
                  <Check size={13} />
                  <span>Stripe account connected</span>
                </div>
                <button
                  onClick={requestPayout}
                  disabled={payoutLoading || (amb?.creditBalance ?? 0) < 25}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
                >
                  {payoutLoading ? "Processing…" : "Request Payout"}
                </button>
              </div>
            ) : (
              <a
                href={`/api/ambassador/${code}/stripe-connect`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80"
                style={{ borderColor: "rgba(212,168,67,0.4)", color: "#D4A843" }}
              >
                <DollarSign size={14} />
                Connect Stripe Account
              </a>
            )}

            {payoutMsg && (
              <p
                className="text-xs"
                style={{ color: payoutMsg.startsWith("✓") ? "#34D399" : "#f87171" }}
              >
                {payoutMsg}
              </p>
            )}

            {/* Payout history */}
            {data?.payouts && data.payouts.length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <p className="text-xs text-white/40 mb-2">History</p>
                <div className="space-y-1.5">
                  {data.payouts.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-white/50">{new Date(p.createdAt).toLocaleDateString()}</span>
                      <span style={{ color: "#34D399" }}>${p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
