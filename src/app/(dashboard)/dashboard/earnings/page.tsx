"use client";

import { Download, Receipt, TrendingUp } from "lucide-react";
import { useEarnings } from "@/hooks/queries";

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION:    "Subscription",
  AI_TOOL:         "AI Tool Credits",
  MERCH_SALE:      "Merch Sale",
  BEAT_PURCHASE:   "Beat Purchase",
  SESSION_PAYMENT: "Studio Session",
};

const TYPE_COLORS: Record<string, string> = {
  SUBSCRIPTION:    "text-violet-400",
  AI_TOOL:         "text-blue-400",
  MERCH_SALE:      "text-emerald-400",
  BEAT_PURCHASE:   "text-amber-400",
  SESSION_PAYMENT: "text-rose-400",
};

export default function EarningsPage() {
  const { data: receipts = [], isLoading, isError } = useEarnings();

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
