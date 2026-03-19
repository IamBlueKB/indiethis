"use client";

import { useEffect, useState } from "react";
import {
  Bell, MapPin, Users, Loader2, Download,
  Phone, Trophy, RefreshCw, ShoppingBag, Heart,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FanContact = {
  id:        string;
  email:     string;
  phone:     string | null;
  zip:       string | null;
  source:    "RELEASE_NOTIFY" | "SHOW_NOTIFY";
  createdAt: string;
};

type FanScore = {
  id:          string;
  email:       string;
  totalSpend:  number;
  merchSpend:  number;
  tipSpend:    number;
  orderCount:  number;
  tipCount:    number;
  lastSpentAt: string | null;
};

type Tab = "ALL" | "RELEASE_NOTIFY" | "SHOW_NOTIFY";

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span title="#1 Super Fan" style={{ fontSize: 16 }}>🥇</span>;
  if (rank === 2) return <span title="#2" style={{ fontSize: 16 }}>🥈</span>;
  if (rank === 3) return <span title="#3" style={{ fontSize: 16 }}>🥉</span>;
  return (
    <span className="text-xs text-muted-foreground tabular-nums w-5 text-center">{rank}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FansPage() {
  // ── Fan contacts state ────────────────────────────────────────────────────
  const [contacts,     setContacts]     = useState<FanContact[]>([]);
  const [total,        setTotal]        = useState(0);
  const [releaseCount, setReleaseCount] = useState(0);
  const [showCount,    setShowCount]    = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<Tab>("ALL");

  // ── Super fans state ──────────────────────────────────────────────────────
  const [superFans,    setSuperFans]    = useState<FanScore[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [fansLoading,  setFansLoading]  = useState(true);
  const [rebuilding,   setRebuilding]   = useState(false);

  // ── Load fan contacts ─────────────────────────────────────────────────────
  useEffect(() => {
    const qs = activeTab === "ALL" ? "" : `?source=${activeTab}`;
    setLoading(true);
    fetch(`/api/dashboard/fans${qs}`)
      .then((r) => r.json())
      .then(({ contacts: c = [], total: t = 0, releaseCount: rc = 0, showCount: sc = 0 }) => {
        setContacts(c);
        setTotal(t);
        setReleaseCount(rc);
        setShowCount(sc);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  // ── Load super fans ───────────────────────────────────────────────────────
  function loadFanScores() {
    setFansLoading(true);
    fetch("/api/dashboard/fan-scores")
      .then((r) => r.json())
      .then(({ fans = [], totalRevenue: rev = 0 }) => {
        setSuperFans(fans);
        setTotalRevenue(rev);
      })
      .finally(() => setFansLoading(false));
  }
  useEffect(() => { loadFanScores(); }, []);

  function handleRebuild() {
    setRebuilding(true);
    fetch("/api/dashboard/fan-scores", { method: "POST" })
      .then(() => loadFanScores())
      .finally(() => setRebuilding(false));
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ["Email", "Phone", "ZIP", "List", "Joined"],
      ...contacts.map((c) => [
        c.email,
        c.phone ?? "",
        c.zip   ?? "",
        c.source === "RELEASE_NOTIFY" ? "Release Alerts" : "Show Alerts",
        new Date(c.createdAt).toLocaleDateString("en-US"),
      ]),
    ];
    const csv  = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fans-${activeTab.toLowerCase()}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: Tab; label: string; count: number; icon: React.ElementType; color: string }[] = [
    { id: "ALL",            label: "All Fans",       count: total,        icon: Users,  color: "#D4A843" },
    { id: "RELEASE_NOTIFY", label: "Release Alerts", count: releaseCount, icon: Bell,   color: "#D4A843" },
    { id: "SHOW_NOTIFY",    label: "Show Alerts",    count: showCount,    icon: MapPin, color: "#E85D4A" },
  ];

  const maxSpend = superFans[0]?.totalSpend ?? 1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

      {/* ── Super Fans ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
            >
              <Trophy size={16} className="text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Super Fans</h1>
              <p className="text-xs text-muted-foreground">
                Ranked by total spend · merch + tips
                {totalRevenue > 0 && (
                  <> ·{" "}
                    <span className="font-semibold" style={{ color: "#D4A843" }}>
                      ${totalRevenue.toFixed(2)} total
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            title="Recompute from all purchase history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            <RefreshCw size={12} className={rebuilding ? "animate-spin" : ""} />
            {rebuilding ? "Rebuilding…" : "Rebuild"}
          </button>
        </div>

        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {fansLoading ? (
            <div className="py-14 flex justify-center">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : superFans.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Trophy size={30} className="mx-auto mb-2" style={{ color: "rgba(255,255,255,0.10)" }} />
              <p className="text-sm text-muted-foreground">No fan spend data yet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                Super fans appear once they buy merch or send a tip.
              </p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div
                className="grid gap-3 px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ gridTemplateColumns: "28px 1fr 64px 64px 72px", borderColor: "var(--border)" }}
              >
                <span>#</span>
                <span>Fan</span>
                <span className="text-right">Merch</span>
                <span className="text-right">Tips</span>
                <span className="text-right">Total</span>
              </div>

              {superFans.map((fan, i) => {
                const pct = Math.round((fan.totalSpend / maxSpend) * 100);
                return (
                  <div
                    key={fan.id}
                    className="border-b last:border-b-0 transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="grid gap-3 items-center px-4 py-3"
                      style={{ gridTemplateColumns: "28px 1fr 64px 64px 72px" }}
                    >
                      {/* Rank */}
                      <div className="flex items-center justify-center">
                        <RankBadge rank={i + 1} />
                      </div>

                      {/* Email + bar + chips */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground truncate">{fan.email}</p>
                          {i === 0 && (
                            <span
                              className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}
                            >
                              #1 Fan
                            </span>
                          )}
                        </div>
                        {/* Spend bar */}
                        <div
                          className="h-[3px] rounded-full overflow-hidden mb-1.5"
                          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: i === 0 ? "#D4A843" : "rgba(212,168,67,0.35)",
                            }}
                          />
                        </div>
                        {/* Purchase breakdown chips */}
                        <div className="flex items-center gap-3">
                          {fan.orderCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                              <ShoppingBag size={9} />
                              {fan.orderCount} order{fan.orderCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          {fan.tipCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(232,93,74,0.55)" }}>
                              <Heart size={9} />
                              {fan.tipCount} tip{fan.tipCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          {fan.lastSpentAt && (
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.20)" }}>
                              {new Date(fan.lastSpentAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Merch */}
                      <p className="text-xs tabular-nums text-right" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {fan.merchSpend > 0 ? `$${fan.merchSpend.toFixed(2)}` : <span className="opacity-30">—</span>}
                      </p>

                      {/* Tips */}
                      <p className="text-xs tabular-nums text-right" style={{ color: "rgba(232,93,74,0.70)" }}>
                        {fan.tipSpend > 0 ? `$${fan.tipSpend.toFixed(2)}` : <span className="opacity-30">—</span>}
                      </p>

                      {/* Total */}
                      <p className="text-sm font-bold tabular-nums text-right" style={{ color: "#D4A843" }}>
                        ${fan.totalSpend.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* ── Fan Contact List ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Fan List</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Email and SMS contacts captured from your artist page
            </p>
          </div>
          {contacts.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <Download size={13} />
              Export CSV
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {tabs.map(({ id, label, count, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="rounded-2xl border p-4 text-left transition-all hover:brightness-110"
              style={{
                backgroundColor: activeTab === id
                  ? `rgba(${color === "#D4A843" ? "212,168,67" : "232,93,74"},0.08)`
                  : "var(--card)",
                borderColor: activeTab === id ? color : "var(--border)",
              }}
            >
              <Icon size={15} style={{ color }} className="mb-1.5" />
              <p className="text-xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Contact table */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Tab bar */}
          <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px"
                style={{
                  borderBottomColor: activeTab === id ? "#D4A843" : "transparent",
                  color:             activeTab === id ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-14 flex justify-center">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={32} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm text-muted-foreground">No contacts yet</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                {activeTab === "ALL"
                  ? "Fans who sign up via your artist page will appear here"
                  : activeTab === "RELEASE_NOTIFY"
                    ? "Fans who sign up for release alerts will appear here"
                    : "Fans who request show notifications will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                <span>Email</span>
                <span><Phone size={9} className="inline" /> Phone</span>
                <span>ZIP</span>
                <span>List</span>
                <span className="text-right">Joined</span>
              </div>

              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 border-b last:border-b-0 hover:bg-white/[0.03] transition-colors"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="text-sm text-foreground truncate">{contact.email}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {contact.phone ?? <span className="opacity-30">—</span>}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums w-12 text-center">
                    {contact.zip ?? <span className="opacity-30">—</span>}
                  </p>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                    style={
                      contact.source === "RELEASE_NOTIFY"
                        ? { backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }
                        : { backgroundColor: "rgba(232,93,74,0.12)",  color: "#E85D4A" }
                    }
                  >
                    {contact.source === "RELEASE_NOTIFY" ? "Release" : "Shows"}
                  </span>
                  <p className="text-xs text-muted-foreground text-right whitespace-nowrap">
                    {new Date(contact.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

    </div>
  );
}
