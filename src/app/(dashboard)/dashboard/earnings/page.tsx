"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Download, Receipt, TrendingUp, Heart, ChevronDown, ChevronUp,
  Radio, Music2, DollarSign, FileText, Zap, ExternalLink, Loader2,
} from "lucide-react";
import { useEarnings } from "@/hooks/queries";
import EarningsProjector from "@/components/dashboard/EarningsProjector";

// ─── Shared types (artist side) ───────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION:    "Subscription",
  AI_TOOL:         "AI Tool Credits",
  MERCH_SALE:      "Merch Sale",
  BEAT_PURCHASE:   "Beat Purchase",
  SESSION_PAYMENT: "Studio Session",
  SUPPORT_TIP:     "Fan Support",
};

const TYPE_COLORS: Record<string, string> = {
  SUBSCRIPTION:    "text-violet-400",
  AI_TOOL:         "text-blue-400",
  MERCH_SALE:      "text-emerald-400",
  BEAT_PURCHASE:   "text-amber-400",
  SESSION_PAYMENT: "text-rose-400",
  SUPPORT_TIP:     "text-pink-400",
};

type Supporter = { email: string; total: number; count: number; latest: string; messages: string[] };

// ─── Producer types ───────────────────────────────────────────────────────────

type ProducerSummary = {
  leaseTotal:       number;
  leaseThisMonth:   number;
  licenseTotal:     number;
  licenseThisMonth: number;
  monthlyLeaseIncome: number;
  activeLeaseCount: number;
  totalAllTime:     number;
  totalThisMonth:   number;
};

type ProducerTx = {
  id:          string;
  date:        string;
  type:        "STREAM_LEASE" | "LICENSE_SALE";
  beat:        string;
  from:        string;
  fromSlug:    string | null;
  amount:      number;
  licenseType?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TabType = "combined" | "artist" | "producer";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const LICENSE_LABELS: Record<string, string> = {
  EXCLUSIVE:     "Exclusive",
  NON_EXCLUSIVE: "Non-Exclusive",
  LEASE:         "Lease",
};

// ─── Tab Button ───────────────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      style={
        active
          ? { backgroundColor: "var(--accent)", color: "var(--background)" }
          : { color: "var(--muted-foreground)" }
      }
    >
      {label}
    </button>
  );
}

// ─── Combined Header ──────────────────────────────────────────────────────────

function CombinedHeader({
  artistTotal,
  producerTotal,
}: {
  artistTotal:  number;
  producerTotal: number;
}) {
  const total = artistTotal + producerTotal;
  const artistPct   = total > 0 ? (artistTotal   / total) * 100 : 50;
  const producerPct = total > 0 ? (producerTotal / total) * 100 : 50;

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Earnings (All Time)</p>
        <p className="text-2xl font-bold text-foreground">${total.toFixed(2)}</p>
      </div>

      {/* Split bar */}
      <div className="h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-l-full" style={{ width: `${artistPct}%`, backgroundColor: "var(--accent)" }} />
        <div className="h-full rounded-r-full" style={{ width: `${producerPct}%`, backgroundColor: "#E87040" }} />
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
          <span className="text-muted-foreground">Artist</span>
          <span className="font-semibold text-foreground">${artistTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#E87040" }} />
          <span className="text-muted-foreground">Producer</span>
          <span className="font-semibold text-foreground">${producerTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Producer Tab Content ─────────────────────────────────────────────────────

function ProducerTab({ summary, transactions, loading }: {
  summary:      ProducerSummary | null;
  transactions: ProducerTx[];
  loading:      boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-5">
      {/* Earnings totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} className="text-accent" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Time</p>
          </div>
          <p className="text-2xl font-bold text-foreground">${summary.totalAllTime.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">From leases + licenses</p>
        </div>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={15} className="text-accent" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Month</p>
          </div>
          <p className="text-2xl font-bold text-foreground">${summary.totalThisMonth.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Current billing period</p>
        </div>
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 gap-3">
        {/* Stream Lease Income */}
        <div
          className="rounded-xl border p-4 flex items-center justify-between"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(232,112,64,0.12)" }}>
              <Radio size={16} style={{ color: "#E87040" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Stream Lease Income</p>
              <p className="text-xs text-muted-foreground">
                {summary.activeLeaseCount} active lease{summary.activeLeaseCount !== 1 ? "s" : ""} · ${summary.monthlyLeaseIncome.toFixed(2)}/mo recurring
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">${summary.leaseTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">${summary.leaseThisMonth.toFixed(2)} this mo</p>
          </div>
        </div>

        {/* License Sales */}
        <div
          className="rounded-xl border p-4 flex items-center justify-between"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
              <FileText size={16} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">License Sales</p>
              <p className="text-xs text-muted-foreground">Lease, non-exclusive & exclusive</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">${summary.licenseTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">${summary.licenseThisMonth.toFixed(2)} this mo</p>
          </div>
        </div>

        {/* Royalty Pool — placeholder */}
        <div
          className="rounded-xl border p-4 flex items-center justify-between opacity-60"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(129,140,248,0.12)" }}>
              <Zap size={16} style={{ color: "#818CF8" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Royalty Pool</p>
              <p className="text-xs text-muted-foreground">Activates at $2,000/mo platform threshold</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">$0.00</p>
            <p className="text-xs" style={{ color: "#818CF8" }}>Coming soon</p>
          </div>
        </div>
      </div>

      {/* Payout section */}
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Payouts</p>
        <p className="text-sm text-foreground">
          Producer earnings are paid to your Stripe Connect account — the same account linked to your artist earnings.
          Configure payout settings in <a href="/dashboard/settings" className="text-accent hover:underline">Settings</a>.
        </p>
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Transaction History</p>
        </div>

        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <DollarSign size={32} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No producer transactions yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Date", "Type", "Beat", "From", "Amount"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    {tx.type === "STREAM_LEASE" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(232,112,64,0.12)", color: "#E87040" }}>
                        Stream Lease
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
                        {tx.licenseType ? LICENSE_LABELS[tx.licenseType] ?? "License" : "License Sale"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium truncate max-w-[140px]">{tx.beat}</td>
                  <td className="px-4 py-3">
                    {tx.fromSlug ? (
                      <a
                        href={`/${tx.fromSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-foreground hover:text-accent transition-colors"
                      >
                        {tx.from}
                        <ExternalLink size={11} className="text-muted-foreground" />
                      </a>
                    ) : (
                      <span className="text-foreground">{tx.from}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">${tx.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Artist Tab Content ───────────────────────────────────────────────────────

function ArtistTab() {
  const { data: receipts = [], isLoading, isError } = useEarnings();

  const [supporters,     setSupporters]     = useState<Supporter[]>([]);
  const [totalTips,      setTotalTips]      = useState(0);
  const [totalTipCount,  setTotalTipCount]  = useState(0);
  const [loadingSup,     setLoadingSup]     = useState(true);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/dashboard/supporters")
      .then((r) => r.json())
      .then(({ supporters: s = [], totalTips: tt = 0, totalTipCount: tc = 0 }) => {
        setSupporters(s);
        setTotalTips(tt);
        setTotalTipCount(tc);
      })
      .finally(() => setLoadingSup(false));
  }, []);

  function toggleExpand(email: string) {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }

  const totalSpent = receipts.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Total Spent",  value: `$${totalSpent.toFixed(2)}`, sub: "All time",     icon: TrendingUp },
          { label: "Receipts",     value: receipts.length,              sub: "Transactions", icon: Receipt    },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-2xl border p-5" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className="text-accent" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Fan supporters */}
      {(totalTipCount > 0 || !loadingSup) && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-pink-400" />
              <p className="text-sm font-semibold text-foreground">Fan Supporters</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{totalTipCount} tip{totalTipCount !== 1 ? "s" : ""}</span>
              <span className="text-sm font-bold" style={{ color: "#D4A843" }}>${totalTips.toFixed(2)} total</span>
            </div>
          </div>

          {loadingSup ? (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : supporters.length === 0 ? (
            <div className="py-10 text-center">
              <Heart size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No supporters yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Enable the Tip Jar on your Site settings to start receiving support.</p>
            </div>
          ) : (
            supporters.map((sup, i) => (
              <div key={sup.email} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer"
                  onClick={() => sup.messages.length > 0 && toggleExpand(sup.email)}
                >
                  <span className="text-xs font-bold text-muted-foreground/50 w-5 text-center tabular-nums shrink-0">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}>
                    {sup.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{sup.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {sup.count} tip{sup.count !== 1 ? "s" : ""}
                      {sup.messages.length > 0 && <span className="text-pink-400/70"> · {sup.messages.length} message{sup.messages.length !== 1 ? "s" : ""}</span>}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">${sup.total.toFixed(2)}</span>
                  {sup.messages.length > 0 && (expandedEmails.has(sup.email) ? <ChevronUp size={13} className="text-muted-foreground shrink-0" /> : <ChevronDown size={13} className="text-muted-foreground shrink-0" />)}
                </div>
                {expandedEmails.has(sup.email) && sup.messages.length > 0 && (
                  <div className="px-14 pb-3 space-y-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                    {sup.messages.map((msg, mi) => (
                      <p key={mi} className="text-xs text-muted-foreground italic leading-relaxed">&ldquo;{msg}&rdquo;</p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Payment history */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Payment History</p>
        </div>
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-sm text-red-400">Failed to load receipts. Please refresh.</div>
        ) : receipts.length === 0 ? (
          <div className="py-14 text-center">
            <Receipt size={36} className="text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Receipts appear here after each payment.</p>
          </div>
        ) : (
          receipts.map((receipt) => (
            <div key={receipt.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 hover:bg-white/3 transition-colors" style={{ borderColor: "var(--border)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <Receipt size={16} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{receipt.description}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs font-medium ${TYPE_COLORS[receipt.type] ?? "text-muted-foreground"}`}>
                    {TYPE_LABELS[receipt.type] ?? receipt.type}
                  </span>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(receipt.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {receipt.paymentMethod && (
                    <>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{receipt.paymentMethod.toLowerCase()}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-foreground">${receipt.amount.toFixed(2)}</span>
                <a
                  href={`/api/receipts/${receipt.id}/pdf`}
                  title="Download receipt PDF"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <Download size={14} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [tab,              setTab]              = useState<TabType>("combined");
  const [producerSummary,  setProducerSummary]  = useState<ProducerSummary | null>(null);
  const [producerTxs,      setProducerTxs]      = useState<ProducerTx[]>([]);
  const [loadingProducer,  setLoadingProducer]  = useState(true);
  const [hasProducerBeats, setHasProducerBeats] = useState(false);

  const { data: receipts = [] } = useEarnings();

  const loadProducer = useCallback(async () => {
    setLoadingProducer(true);
    try {
      const res = await fetch("/api/dashboard/producer/earnings");
      if (res.ok) {
        const d = await res.json();
        setProducerSummary(d.summary);
        setProducerTxs(d.transactions);
        // Has producer activity if total > 0 or any transactions
        setHasProducerBeats(d.summary.totalAllTime > 0 || d.transactions.length > 0 || d.summary.activeLeaseCount > 0);
      }
    } finally {
      setLoadingProducer(false);
    }
  }, []);

  useEffect(() => { void loadProducer(); }, [loadProducer]);

  const artistTotal   = receipts.reduce((s, r) => s + r.amount, 0);
  const producerTotal = producerSummary?.totalAllTime ?? 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Earnings & Receipts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your payment history and producer income</p>
      </div>

      {/* ── Earnings Projector ── */}
      <EarningsProjector />

      {/* Combined header — always visible */}
      {!loadingProducer && hasProducerBeats && (
        <CombinedHeader artistTotal={artistTotal} producerTotal={producerTotal} />
      )}

      {/* Tabs — only shown when user has producer activity */}
      {hasProducerBeats && (
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <Tab label="Overview"  active={tab === "combined"} onClick={() => setTab("combined")} />
          <Tab label="Artist"    active={tab === "artist"}   onClick={() => setTab("artist")} />
          <Tab label="Producer"  active={tab === "producer"} onClick={() => setTab("producer")} />
        </div>
      )}

      {/* Content */}
      {(!hasProducerBeats || tab === "artist" || tab === "combined") && (
        <div className={tab === "combined" && hasProducerBeats ? "" : ""}>
          <ArtistTab />
        </div>
      )}

      {hasProducerBeats && (tab === "producer" || tab === "combined") && (
        <div>
          {tab === "combined" && (
            <div className="flex items-center gap-2 pt-2 pb-1">
              <Music2 size={14} style={{ color: "#E87040" }} />
              <p className="text-sm font-semibold text-foreground">Producer Earnings</p>
            </div>
          )}
          <ProducerTab
            summary={producerSummary}
            transactions={producerTxs}
            loading={loadingProducer}
          />
        </div>
      )}
    </div>
  );
}
