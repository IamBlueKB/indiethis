"use client";

import { useEffect, useState } from "react";
import {
  Gift, CheckCircle2, Clock, TrendingUp, Users, DollarSign,
  ChevronDown, ChevronUp, Info, Loader2,
} from "lucide-react";
import type { CreditEvent } from "@/lib/studio-referral";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CreditsData {
  balance: number;
  history: CreditEvent[];
  stats: {
    totalEarned:      number;
    totalApplied:     number;
    referredArtists:  number;
    pendingReferrals: number;
  };
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--muted-foreground)" }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1A` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{sub}</p>
      )}
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks({ expanded, onToggle }: {
  expanded: boolean; onToggle: () => void;
}) {
  const steps = [
    {
      n: "1",
      title: "You bring in artists",
      body: "When you book or manually add a client to your CRM (source: Booking or Manual), they're automatically eligible for referral tracking.",
    },
    {
      n: "2",
      title: "They join IndieThis",
      body: "If your client signs up for IndieThis using the same email address, we detect the match and mark them as a referred artist.",
    },
    {
      n: "3",
      title: "They make a purchase",
      body: "When your referred artist subscribes to a plan or makes a pay-per-use purchase, you earn $5 in referral credits — one time per artist.",
    },
    {
      n: "4",
      title: "Credits apply automatically",
      body: "Your accumulated credits are applied as a discount on your next IndieThis subscription invoice, automatically reducing what you pay.",
    },
  ];

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Info size={16} style={{ color: "#D4A843" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            How referral credits work
          </span>
        </div>
        {expanded
          ? <ChevronUp  size={16} style={{ color: "var(--muted-foreground)" }} />
          : <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 grid grid-cols-2 gap-4 border-t"
          style={{ borderColor: "var(--border)" }}>
          {steps.map(s => (
            <div key={s.n} className="pt-4 flex gap-3">
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                {s.n}
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  {s.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Credit History Row ────────────────────────────────────────────────────────

function HistoryRow({ event, isEven }: { event: CreditEvent; isEven: boolean }) {
  const isEarned  = event.type === "EARNED";
  const isApplied = event.type === "APPLIED";

  return (
    <div className="flex items-center gap-4 px-5 py-3.5"
      style={{ background: isEven ? "var(--card)" : "transparent" }}>

      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0`}
        style={{
          background: isEarned
            ? "rgba(16,185,129,0.12)"
            : "rgba(212,168,67,0.12)",
        }}>
        {isEarned
          ? <TrendingUp size={15} style={{ color: "#10B981" }} />
          : <CheckCircle2 size={15} style={{ color: "#D4A843" }} />}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
          {event.reason}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {new Date(event.date).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
          {event.purchaseType && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>
              {event.purchaseType === "SUBSCRIPTION" ? "Subscription" : "Pay-per-use"}
            </span>
          )}
        </p>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <span className="text-sm font-bold"
          style={{ color: isEarned ? "#10B981" : isApplied ? "#D4A843" : "var(--muted-foreground)" }}>
          {isEarned ? "+" : ""}${Math.abs(event.amount).toFixed(2)}
        </span>
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          {isEarned ? "earned" : "applied"}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StudioCreditsPage() {
  const [data,    setData]    = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    fetch("/api/studio/credits")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div className="border-b px-8 py-5 flex items-center gap-3"
        style={{ borderColor: "var(--border)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(212,168,67,0.12)" }}>
          <Gift size={18} style={{ color: "#D4A843" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            Referral Credits
          </h1>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Earn $5 for every client you bring who purchases a plan
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-3"
          style={{ color: "var(--muted-foreground)" }}>
          <Loader2 size={20} className="animate-spin" style={{ color: "#D4A843" }} />
          <span className="text-sm">Loading credits…</span>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Failed to load credits.</p>
        </div>
      ) : (
        <div className="flex-1 p-8 space-y-8 max-w-4xl">

          {/* ── Balance hero ──────────────────────────────────────────────── */}
          <div className="rounded-2xl border p-6 flex items-center gap-6"
            style={{
              borderColor: "rgba(212,168,67,0.4)",
              background:  "linear-gradient(135deg, rgba(212,168,67,0.08) 0%, transparent 60%)",
            }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(212,168,67,0.15)" }}>
              <DollarSign size={28} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: "var(--muted-foreground)" }}>Available Balance</p>
              <p className="text-4xl font-bold" style={{ color: "#D4A843" }}>
                ${data.balance.toFixed(2)}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                Will automatically apply to your next IndieThis invoice
              </p>
            </div>
          </div>

          {/* ── Stat cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Total Earned"
              value={`$${data.stats.totalEarned.toFixed(2)}`}
              icon={TrendingUp}
              color="#10B981"
              sub="all time"
            />
            <StatCard
              label="Total Applied"
              value={`$${data.stats.totalApplied.toFixed(2)}`}
              icon={CheckCircle2}
              color="#D4A843"
              sub="invoice discounts"
            />
            <StatCard
              label="Artists Credited"
              value={String(data.stats.referredArtists)}
              icon={Users}
              color="#6366F1"
              sub="unique purchases"
            />
            <StatCard
              label="Pending Referrals"
              value={String(data.stats.pendingReferrals)}
              icon={Clock}
              color="#F59E0B"
              sub="clients not yet on IndieThis"
            />
          </div>

          {/* ── How it works ─────────────────────────────────────────────── */}
          <HowItWorks expanded={howOpen} onToggle={() => setHowOpen(v => !v)} />

          {/* ── Credit history ────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Credit History
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
                ({data.history.length} event{data.history.length !== 1 ? "s" : ""})
              </span>
            </h2>

            {data.history.length === 0 ? (
              <div className="rounded-2xl border border-dashed flex flex-col items-center justify-center py-12"
                style={{ borderColor: "var(--border)" }}>
                <Gift size={32} style={{ color: "var(--border)" }} />
                <p className="mt-3 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  No credits yet
                </p>
                <p className="mt-1 text-xs text-center max-w-xs"
                  style={{ color: "var(--muted-foreground)" }}>
                  Credits appear here when clients you&apos;ve booked or added manually
                  sign up for IndieThis and make their first purchase.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border overflow-hidden"
                style={{ borderColor: "var(--border)" }}>
                {/* Table header */}
                <div className="flex items-center gap-4 px-5 py-2.5 border-b"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <div className="w-8 shrink-0" />
                  <p className="flex-1 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}>Event</p>
                  <p className="text-xs font-semibold uppercase tracking-wider shrink-0"
                    style={{ color: "var(--muted-foreground)" }}>Amount</p>
                </div>
                {data.history.map((event, i) => (
                  <HistoryRow key={event.id} event={event} isEven={i % 2 === 0} />
                ))}
              </div>
            )}
          </div>

          {/* ── Info footer ───────────────────────────────────────────────── */}
          <div className="rounded-xl border p-4 flex items-start gap-3"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <Info size={15} className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Credits are earned once per artist — if the same artist makes multiple purchases,
              you are only credited $5 total. Credits are applied automatically when your
              IndieThis subscription invoice is generated. Only contacts with a source of
              <strong style={{ color: "var(--foreground)" }}> Booking</strong> or
              <strong style={{ color: "var(--foreground)" }}> Manual</strong> are eligible,
              as these represent artists you personally brought to the platform.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
