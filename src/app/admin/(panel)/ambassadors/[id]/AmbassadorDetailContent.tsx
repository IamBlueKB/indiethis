"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Star, Copy, Check, RefreshCw, X } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type PromoRedemption = {
  id: string;
  user: { name: string; email: string } | null;
  redeemedAt: string;
  status: string;
  convertedAt?: string | null;
};

type PromoCode = {
  id: string;
  code: string;
  type: string;
  isActive: boolean;
  redemptions: PromoRedemption[];
  _count?: { redemptions: number };
};

type AmbassadorPayout = {
  id: string;
  amount: number;
  method: string;
  stripePayoutId?: string | null;
  createdAt: string;
};

type AmbassadorDetail = {
  id: string;
  name: string;
  email: string;
  tier: string;
  rewardType: string;
  rewardValue: number;
  rewardDurationMonths?: number | null;
  creditBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  isActive: boolean;
  notes?: string | null;
  stripeConnectId?: string | null;
  user?: { id: string; name: string; email: string } | null;
  promoCodes: PromoCode[];
  payouts: AmbassadorPayout[];
  createdAt: string;
};

type Stats = {
  totalRedemptions: number;
  totalConversions: number;
  totalUpgrades: number;
  creditBalance: number;
  totalEarned: number;
  totalPaidOut: number;
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function AmbassadorDetailContent({ id }: { id: string }) {
  const [ambassador, setAmbassador] = useState<AmbassadorDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ambassadors/${id}`);
      const data = await res.json();
      setAmbassador(data.ambassador);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function toggleActive() {
    if (!ambassador) return;
    await fetch(`/api/admin/ambassadors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !ambassador.isActive }),
    });
    fetchDetail();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm py-12 text-center">Loading…</div>;
  }
  if (!ambassador) {
    return <div className="text-muted-foreground text-sm py-12 text-center">Ambassador not found.</div>;
  }

  // Flatten all redemptions for timeline
  const allRedemptions = ambassador.promoCodes.flatMap((pc) =>
    pc.redemptions.map((r) => ({ ...r, codeStr: pc.code }))
  ).sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/ambassadors" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-2xl">{ambassador.name}</h1>
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ color: TIER_COLORS[ambassador.tier] ?? "#888", backgroundColor: `${TIER_COLORS[ambassador.tier] ?? "#888"}22` }}
            >
              <Star size={10} fill="currentColor" />
              {ambassador.tier}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                backgroundColor: ambassador.isActive ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                color: ambassador.isActive ? "#34D399" : "#f87171",
              }}
            >
              {ambassador.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{ambassador.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleActive}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
            style={{ borderColor: "var(--border)" }}
          >
            {ambassador.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => setShowPayoutModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            Issue Payout
          </button>
          <button onClick={fetchDetail} className="p-2 rounded-lg border transition-colors hover:opacity-80" style={{ borderColor: "var(--border)" }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Referrals", value: stats.totalRedemptions, color: "#5AC8FA" },
            { label: "Conversions", value: stats.totalConversions, color: "#D4A843" },
            { label: "Credit Balance", value: `$${stats.creditBalance.toFixed(2)}`, color: "#34D399" },
            { label: "Total Earned", value: `$${stats.totalEarned.toFixed(2)}`, color: "#E85D4A" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reward config */}
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <h3 className="font-semibold mb-2 text-muted-foreground uppercase text-xs tracking-wide">Reward Configuration</h3>
        <div className="flex flex-wrap gap-6">
          <span><span className="text-muted-foreground">Type:</span> <strong>{ambassador.rewardType.replace(/_/g, " ")}</strong></span>
          <span><span className="text-muted-foreground">Value:</span> <strong>${ambassador.rewardValue.toFixed(2)}</strong></span>
          {ambassador.rewardDurationMonths && (
            <span><span className="text-muted-foreground">Duration:</span> <strong>{ambassador.rewardDurationMonths} months</strong></span>
          )}
          {ambassador.user && (
            <span><span className="text-muted-foreground">Linked User:</span> <strong style={{ color: "#5AC8FA" }}>{ambassador.user.name}</strong></span>
          )}
          {ambassador.notes && (
            <span><span className="text-muted-foreground">Notes:</span> {ambassador.notes}</span>
          )}
        </div>
      </div>

      {/* Assigned Promo Codes */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-4 py-3 font-semibold text-sm border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          Assigned Codes ({ambassador.promoCodes.length})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Code</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Type</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Redemptions</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {ambassador.promoCodes.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No codes assigned.</td></tr>
            ) : ambassador.promoCodes.map((pc) => (
              <tr key={pc.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2.5 font-mono font-bold">
                  <div className="flex items-center gap-2">
                    {pc.code}
                    <button onClick={() => copyCode(pc.code)} className="text-muted-foreground hover:text-foreground">
                      {copiedCode === pc.code ? <Check size={12} style={{ color: "#34D399" }} /> : <Copy size={12} />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{pc.type.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 font-medium">{pc.redemptions.length}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{
                      backgroundColor: pc.isActive ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                      color: pc.isActive ? "#34D399" : "#f87171",
                    }}
                  >
                    {pc.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Redemption Timeline */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-4 py-3 font-semibold text-sm border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          Redemption Timeline ({allRedemptions.length})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">User</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Code</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Date</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Status</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Converted</th>
            </tr>
          </thead>
          <tbody>
            {allRedemptions.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No redemptions yet.</td></tr>
            ) : allRedemptions.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-xs">{r.user?.name ?? "—"}</p>
                  <p className="text-muted-foreground text-xs">{r.user?.email ?? "—"}</p>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.codeStr}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(r.redeemedAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ color: STATUS_COLORS[r.status] ?? "#888", backgroundColor: `${STATUS_COLORS[r.status] ?? "#888"}22` }}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {r.convertedAt ? new Date(r.convertedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payout History */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-4 py-3 font-semibold text-sm border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          Payout History ({ambassador.payouts.length})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Date</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Amount</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Method</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Stripe ID</th>
            </tr>
          </thead>
          <tbody>
            {ambassador.payouts.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No payouts yet.</td></tr>
            ) : ambassador.payouts.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2.5 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: "#34D399" }}>${p.amount.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.method.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.stripePayoutId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manual payout modal */}
      {showPayoutModal && (
        <PayoutModal
          ambassador={ambassador}
          onClose={() => setShowPayoutModal(false)}
          onSuccess={fetchDetail}
        />
      )}
    </div>
  );
}

// ── Payout Modal ──────────────────────────────────────────────────────────────

function PayoutModal({
  ambassador,
  onClose,
  onSuccess,
}: {
  ambassador: AmbassadorDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(ambassador.creditBalance.toFixed(2));
  const [method, setMethod] = useState("MANUAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ambassadors/${ambassador.id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), method }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Payout failed."); return; }
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = "w-full rounded-lg px-3 py-2 text-sm border outline-none bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-6 space-y-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Issue Payout</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <p className="text-sm text-muted-foreground">
          Available balance: <span className="font-semibold" style={{ color: "#34D399" }}>${ambassador.creditBalance.toFixed(2)}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={inputStyle}
              min={0.01}
              step={0.01}
              max={ambassador.creditBalance}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className={inputStyle}>
              <option value="MANUAL">Manual (cash/check/wire)</option>
              <option value="CREDIT">Stripe Account Credit</option>
              <option value="STRIPE_CONNECT">Stripe Connect</option>
            </select>
          </div>
          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border hover:opacity-80" style={{ borderColor: "var(--border)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
              {loading ? "Processing…" : "Issue Payout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
