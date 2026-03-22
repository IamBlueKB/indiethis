"use client";

import { useEffect, useState } from "react";
import { Download, Receipt, TrendingUp, Heart, ChevronDown, ChevronUp, Radio, Music2 } from "lucide-react";
import { useEarnings } from "@/hooks/queries";

type StreamLeaseGroup = {
  beatId:       string;
  beatTitle:    string;
  coverArtUrl:  string | null;
  artistCount:  number;
  monthlyIncome: number;
  totalEarned:  number;
};

type StreamLeaseEarnings = {
  totalEarned:   number;
  monthlyIncome: number;
  beatGroups:    StreamLeaseGroup[];
};

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION:    "Subscription",
  AI_TOOL:         "AI Tool Credits",
  MERCH_SALE:      "Merch Sale",
  BEAT_PURCHASE:   "Beat Purchase",
  SESSION_PAYMENT: "Studio Session",
  SUPPORT_TIP:     "Fan Support",
};

type Supporter = {
  email:    string;
  total:    number;
  count:    number;
  latest:   string;
  messages: string[];
};

const TYPE_COLORS: Record<string, string> = {
  SUBSCRIPTION:    "text-violet-400",
  AI_TOOL:         "text-blue-400",
  MERCH_SALE:      "text-emerald-400",
  BEAT_PURCHASE:   "text-amber-400",
  SESSION_PAYMENT: "text-rose-400",
  SUPPORT_TIP:     "text-pink-400",
};

export default function EarningsPage() {
  const { data: receipts = [], isLoading, isError } = useEarnings();

  const [supporters,     setSupporters]     = useState<Supporter[]>([]);
  const [totalTips,      setTotalTips]      = useState(0);
  const [totalTipCount,  setTotalTipCount]  = useState(0);
  const [loadingSup,     setLoadingSup]     = useState(true);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  const [leaseEarnings, setLeaseEarnings]       = useState<StreamLeaseEarnings | null>(null);
  const [loadingLeases, setLoadingLeases]       = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/supporters")
      .then((r) => r.json())
      .then(({ supporters: s = [], totalTips: tt = 0, totalTipCount: tc = 0 }) => {
        setSupporters(s);
        setTotalTips(tt);
        setTotalTipCount(tc);
      })
      .finally(() => setLoadingSup(false));

    fetch("/api/dashboard/stream-lease-earnings")
      .then((r) => r.json())
      .then((d) => setLeaseEarnings(d))
      .finally(() => setLoadingLeases(false));
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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Earnings & Receipts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your payment history and downloadable receipts
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Total Spent", value: `$${totalSpent.toFixed(2)}`, sub: "All time", icon: TrendingUp },
          { label: "Receipts", value: receipts.length, sub: "Transactions", icon: Receipt },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className="text-accent" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Supporters / Tips */}
      {(totalTipCount > 0 || !loadingSup) && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-pink-400" />
              <p className="text-sm font-semibold text-foreground">Fan Supporters</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{totalTipCount} tip{totalTipCount !== 1 ? "s" : ""}</span>
              <span className="text-sm font-bold" style={{ color: "#D4A843" }}>
                ${totalTips.toFixed(2)} total
              </span>
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
              <p className="text-xs text-muted-foreground/60 mt-1">
                Enable the Tip Jar on your Site settings to start receiving support.
              </p>
            </div>
          ) : (
            supporters.map((sup, i) => (
              <div
                key={sup.email}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer"
                  onClick={() => sup.messages.length > 0 && toggleExpand(sup.email)}
                >
                  {/* Rank */}
                  <span className="text-xs font-bold text-muted-foreground/50 w-5 text-center tabular-nums shrink-0">
                    #{i + 1}
                  </span>

                  {/* Avatar placeholder */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: "rgba(232,93,74,0.15)", color: "#E85D4A" }}
                  >
                    {sup.email[0].toUpperCase()}
                  </div>

                  {/* Email + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{sup.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {sup.count} tip{sup.count !== 1 ? "s" : ""}
                      {sup.messages.length > 0 && (
                        <span className="text-pink-400/70"> · {sup.messages.length} message{sup.messages.length !== 1 ? "s" : ""}</span>
                      )}
                    </p>
                  </div>

                  {/* Total */}
                  <span className="text-sm font-bold text-foreground shrink-0">
                    ${sup.total.toFixed(2)}
                  </span>

                  {/* Expand chevron if has messages */}
                  {sup.messages.length > 0 && (
                    expandedEmails.has(sup.email)
                      ? <ChevronUp size={13} className="text-muted-foreground shrink-0" />
                      : <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Messages panel */}
                {expandedEmails.has(sup.email) && sup.messages.length > 0 && (
                  <div
                    className="px-14 pb-3 space-y-1.5"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {sup.messages.map((msg, mi) => (
                      <p key={mi} className="text-xs text-muted-foreground italic leading-relaxed">
                        &ldquo;{msg}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Stream Lease Income — only show if user has producer activity */}
      {!loadingLeases && leaseEarnings && (leaseEarnings.beatGroups.length > 0 || leaseEarnings.totalEarned > 0) && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Radio size={14} style={{ color: "#E85D4A" }} />
              <p className="text-sm font-semibold text-foreground">Stream Lease Income</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                ${leaseEarnings.monthlyIncome.toFixed(2)}/mo
              </span>
              <span className="text-sm font-bold" style={{ color: "#E85D4A" }}>
                ${leaseEarnings.totalEarned.toFixed(2)} earned
              </span>
            </div>
          </div>

          {leaseEarnings.beatGroups.length === 0 ? (
            <div className="py-10 text-center">
              <Radio size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No active stream leases on your beats yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Artists can lease your published beats for $1/mo from the Marketplace.
              </p>
            </div>
          ) : (
            leaseEarnings.beatGroups.map((group) => (
              <div
                key={group.beatId}
                className="flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                  style={{
                    backgroundImage:    group.coverArtUrl ? `url(${group.coverArtUrl})` : undefined,
                    backgroundSize:     "cover",
                    backgroundPosition: "center",
                    backgroundColor:    group.coverArtUrl ? undefined : "var(--border)",
                  }}
                >
                  {!group.coverArtUrl && <Music2 size={14} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{group.beatTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.artistCount} artist{group.artistCount !== 1 ? "s" : ""} recording
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold" style={{ color: "#E85D4A" }}>
                    ${group.monthlyIncome.toFixed(2)}/mo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${group.totalEarned.toFixed(2)} total
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Receipt list */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-foreground">Payment History</p>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-sm text-red-400">
            Failed to load receipts. Please refresh.
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-14 text-center">
            <Receipt size={36} className="text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Receipts appear here after each payment.
            </p>
          </div>
        ) : (
          receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 hover:bg-white/3 transition-colors"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
              >
                <Receipt size={16} className="text-accent" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {receipt.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs font-medium ${TYPE_COLORS[receipt.type] ?? "text-muted-foreground"}`}>
                    {TYPE_LABELS[receipt.type] ?? receipt.type}
                  </span>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(receipt.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                  {receipt.paymentMethod && (
                    <>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {receipt.paymentMethod.toLowerCase()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-foreground">
                  ${receipt.amount.toFixed(2)}
                </span>
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
