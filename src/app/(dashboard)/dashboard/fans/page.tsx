"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users, Bell, MapPin, ShoppingBag, Heart, Loader2, Download,
  Phone, Trophy, RefreshCw, Search, X, ChevronUp, ChevronDown,
  Mail, Calendar, TrendingUp, Filter, ArrowUpDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FanSource = "EMAIL_SIGNUP" | "SHOW_NOTIFY" | "BOOKING_INQUIRY" | "SUPPORTER" | "MERCH_BUYER";

type FanRecord = {
  email:        string;
  name:         string | null;
  phone:        string | null;
  zip:          string | null;
  sources:      FanSource[];
  totalSpend:   number;
  merchSpend:   number;
  tipSpend:     number;
  orderCount:   number;
  tipCount:     number;
  firstSeen:    string;
  lastActivity: string;
};

type Stats = {
  total:            number;
  emailSignups:     number;
  showNotify:       number;
  bookingInquiries: number;
  supporters:       number;
  merchBuyers:      number;
  totalRevenue:     number;
};

type SortKey = "firstSeen" | "lastActivity" | "totalSpend" | "email";
type SortDir = "asc" | "desc";
type FilterSource = "ALL" | FanSource;

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_META: Record<FanSource, { label: string; short: string; color: string; bg: string }> = {
  EMAIL_SIGNUP:     { label: "Release Alert", short: "Release", color: "#D4A843", bg: "rgba(212,168,67,0.12)" },
  SHOW_NOTIFY:      { label: "Show Waitlist", short: "Shows",   color: "#E85D4A", bg: "rgba(232,93,74,0.12)"  },
  BOOKING_INQUIRY:  { label: "Booking",       short: "Booking", color: "#5AC8FA", bg: "rgba(90,200,250,0.12)" },
  SUPPORTER:        { label: "Supporter",     short: "Tip",     color: "#AF52DE", bg: "rgba(175,82,222,0.12)" },
  MERCH_BUYER:      { label: "Merch Buyer",   short: "Merch",   color: "#34C759", bg: "rgba(52,199,89,0.12)"  },
};

// ─── Source chip ─────────────────────────────────────────────────────────────

function SourceChip({ source }: { source: FanSource }) {
  const m = SOURCE_META[source];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ backgroundColor: m.bg, color: m.color }}
    >
      {m.short}
    </span>
  );
}

// ─── Sort button ─────────────────────────────────────────────────────────────

function SortBtn({
  label, field, current, dir, onSort,
}: {
  label:  string;
  field:  SortKey;
  current: SortKey;
  dir:    SortDir;
  onSort: (f: SortKey) => void;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors"
      style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}
    >
      {label}
      {active
        ? dir === "desc"
          ? <ChevronDown size={10} />
          : <ChevronUp size={10} />
        : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />
      }
    </button>
  );
}

// ─── Fan row ─────────────────────────────────────────────────────────────────

function FanRow({ fan }: { fan: FanRecord }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = fan.name ?? fan.email.split("@")[0];

  return (
    <>
      <div
        className="grid items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-white/[0.025] transition-colors cursor-pointer"
        style={{
          gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 80px 90px 110px 90px",
          borderColor:         "var(--border)",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Name + email */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate leading-snug">{displayName}</p>
          {fan.name && (
            <p className="text-[11px] text-muted-foreground truncate">{fan.email}</p>
          )}
        </div>

        {/* Sources */}
        <div className="flex flex-wrap gap-1 min-w-0">
          {fan.sources.map((s) => <SourceChip key={s} source={s} />)}
        </div>

        {/* Phone */}
        <p className="text-xs text-muted-foreground tabular-nums truncate">
          {fan.phone ?? <span className="opacity-30">—</span>}
        </p>

        {/* ZIP */}
        <p className="text-xs text-muted-foreground tabular-nums text-center">
          {fan.zip ?? <span className="opacity-30">—</span>}
        </p>

        {/* Spend */}
        <p
          className="text-sm font-semibold tabular-nums text-right"
          style={{ color: fan.totalSpend > 0 ? "#D4A843" : "rgba(255,255,255,0.25)" }}
        >
          {fan.totalSpend > 0 ? `$${fan.totalSpend.toFixed(2)}` : "—"}
        </p>

        {/* Date */}
        <p className="text-xs text-muted-foreground text-right whitespace-nowrap">
          {new Date(fan.firstSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
        </p>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 py-3 border-b text-xs space-y-2"
          style={{ backgroundColor: "rgba(255,255,255,0.02)", borderColor: "var(--border)" }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Email</p>
              <p className="text-foreground break-all">{fan.email}</p>
            </div>
            {fan.phone && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Phone</p>
                <p className="text-foreground">{fan.phone}</p>
              </div>
            )}
            {fan.zip && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">ZIP</p>
                <p className="text-foreground">{fan.zip}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Last active</p>
              <p className="text-foreground">
                {new Date(fan.lastActivity).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          {fan.totalSpend > 0 && (
            <div className="flex items-center gap-4 pt-1">
              {fan.orderCount > 0 && (
                <span className="flex items-center gap-1" style={{ color: "#34C759" }}>
                  <ShoppingBag size={11} />
                  {fan.orderCount} order{fan.orderCount !== 1 ? "s" : ""} · ${fan.merchSpend.toFixed(2)}
                </span>
              )}
              {fan.tipCount > 0 && (
                <span className="flex items-center gap-1" style={{ color: "#AF52DE" }}>
                  <Heart size={11} />
                  {fan.tipCount} tip{fan.tipCount !== 1 ? "s" : ""} · ${fan.tipSpend.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Super Fan mini section ───────────────────────────────────────────────────

function SuperFanRow({ fan, rank }: { fan: FanRecord; rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="w-6 text-center shrink-0">
        {medal ? (
          <span style={{ fontSize: 15 }}>{medal}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {fan.name ?? fan.email.split("@")[0]}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{fan.email}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-sm font-bold tabular-nums" style={{ color: "#D4A843" }}>
          ${fan.totalSpend.toFixed(2)}
        </p>
        <div className="flex items-center gap-2 justify-end">
          {fan.orderCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "rgba(52,199,89,0.7)" }}>
              <ShoppingBag size={9} />{fan.orderCount}
            </span>
          )}
          {fan.tipCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "rgba(175,82,222,0.7)" }}>
              <Heart size={9} />{fan.tipCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FansPage() {
  const [fans,       setFans]       = useState<FanRecord[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [rebuilding, setRebuilding] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<FilterSource>("ALL");
  const [sortKey,   setSortKey]   = useState<SortKey>("firstSeen");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  function load() {
    setLoading(true);
    fetch("/api/dashboard/fans")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setFans(d.fans ?? []); setStats(d.stats ?? null); }
      })
      .catch(() => setError("Failed to load fans"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleRebuild() {
    setRebuilding(true);
    fetch("/api/dashboard/fan-scores", { method: "POST" })
      .then(() => load())
      .finally(() => setRebuilding(false));
  }

  // ── Sort toggle ────────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  // ── Filtered + sorted fan list ─────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = fans;

    // Source filter
    if (filter !== "ALL") {
      list = list.filter((f) => f.sources.includes(filter));
    }

    // Search
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (f) =>
          f.email.includes(q) ||
          f.name?.toLowerCase().includes(q) ||
          f.phone?.includes(q) ||
          f.zip?.includes(q)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":       cmp = a.email.localeCompare(b.email);                                     break;
        case "totalSpend":  cmp = a.totalSpend - b.totalSpend;                                         break;
        case "firstSeen":   cmp = new Date(a.firstSeen).getTime()    - new Date(b.firstSeen).getTime(); break;
        case "lastActivity":cmp = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [fans, filter, search, sortKey, sortDir]);

  // ── Super fans (top 5 by spend) ────────────────────────────────────────────
  const superFans = useMemo(
    () => [...fans].sort((a, b) => b.totalSpend - a.totalSpend).filter((f) => f.totalSpend > 0).slice(0, 5),
    [fans]
  );

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ["Name", "Email", "Phone", "ZIP", "Sources", "Total Spend", "Merch", "Tips", "First Seen", "Last Active"],
      ...displayed.map((f) => [
        f.name ?? "",
        f.email,
        f.phone ?? "",
        f.zip ?? "",
        f.sources.map((s) => SOURCE_META[s].label).join("; "),
        f.totalSpend.toFixed(2),
        f.merchSpend.toFixed(2),
        f.tipSpend.toFixed(2),
        new Date(f.firstSeen).toLocaleDateString("en-US"),
        new Date(f.lastActivity).toLocaleDateString("en-US"),
      ]),
    ];
    const csv  = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fans-${filter.toLowerCase()}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filter tabs config ─────────────────────────────────────────────────────
  const filterTabs: { id: FilterSource; label: string; count: number; icon: React.ElementType; color: string }[] = [
    { id: "ALL",             label: "All Fans",   count: stats?.total            ?? 0, icon: Users,       color: "#D4A843" },
    { id: "EMAIL_SIGNUP",    label: "Release",    count: stats?.emailSignups     ?? 0, icon: Bell,        color: "#D4A843" },
    { id: "SHOW_NOTIFY",     label: "Shows",      count: stats?.showNotify       ?? 0, icon: MapPin,      color: "#E85D4A" },
    { id: "BOOKING_INQUIRY", label: "Booking",    count: stats?.bookingInquiries ?? 0, icon: Mail,        color: "#5AC8FA" },
    { id: "SUPPORTER",       label: "Supporters", count: stats?.supporters       ?? 0, icon: Heart,       color: "#AF52DE" },
    { id: "MERCH_BUYER",     label: "Merch",      count: stats?.merchBuyers      ?? 0, icon: ShoppingBag, color: "#34C759" },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 w-40 rounded-xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border h-20 animate-pulse" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} />
          ))}
        </div>
        <div className="rounded-2xl border h-64 animate-pulse" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
          >
            <Users size={17} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Fan Database</h1>
            <p className="text-xs text-muted-foreground">
              {stats?.total ?? 0} fans · your owned audience
              {(stats?.totalRevenue ?? 0) > 0 && (
                <> · <span className="font-semibold" style={{ color: "#D4A843" }}>${stats!.totalRevenue.toFixed(2)} generated</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5 disabled:opacity-50 transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            <RefreshCw size={12} className={rebuilding ? "animate-spin" : ""} />
            {rebuilding ? "Rebuilding…" : "Rebuild scores"}
          </button>
          {displayed.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <Download size={12} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/05 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ── Source stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {filterTabs.map(({ id, label, count, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className="rounded-2xl border p-3 text-left transition-all hover:brightness-110"
            style={{
              backgroundColor: filter === id ? `${color}14` : "var(--card)",
              borderColor:     filter === id ? color          : "var(--border)",
            }}
          >
            <Icon size={13} style={{ color }} className="mb-1.5" />
            <p className="text-lg font-bold text-foreground leading-none">{count}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Layout: table (left) + super fans (right) ──────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── Main fan table ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Search + filter bar */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 rounded-xl border px-3 py-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email, name, phone, ZIP…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>
            {filter !== "ALL" && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[11px] font-semibold"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                <Filter size={11} />
                {filterTabs.find(t => t.id === filter)?.label}
                <button onClick={() => setFilter("ALL")} className="hover:text-foreground ml-0.5">
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Column headers */}
            <div
              className="grid items-center gap-3 px-4 py-2.5 border-b"
              style={{
                gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 80px 90px 110px 90px",
                borderColor:         "var(--border)",
                backgroundColor:     "rgba(255,255,255,0.02)",
              }}
            >
              <SortBtn label="Fan"         field="email"        current={sortKey} dir={sortDir} onSort={handleSort} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">ZIP</span>
              <SortBtn label="Spend"       field="totalSpend"   current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortBtn label="Joined"      field="firstSeen"    current={sortKey} dir={sortDir} onSort={handleSort} />
            </div>

            {/* Rows */}
            {displayed.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                {fans.length === 0 ? (
                  <>
                    <Users size={32} className="mx-auto" style={{ color: "rgba(255,255,255,0.10)" }} />
                    <p className="text-sm text-muted-foreground">No fans yet</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.20)" }}>
                      Fans appear when they sign up, book, tip, or buy from your artist page.
                    </p>
                  </>
                ) : (
                  <>
                    <Search size={28} className="mx-auto" style={{ color: "rgba(255,255,255,0.10)" }} />
                    <p className="text-sm text-muted-foreground">No results</p>
                    <button
                      onClick={() => { setSearch(""); setFilter("ALL"); }}
                      className="text-xs underline text-muted-foreground hover:text-foreground"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {displayed.map((fan) => <FanRow key={fan.email} fan={fan} />)}
                {/* Footer row */}
                <div
                  className="px-4 py-2 text-[10px] text-muted-foreground/50 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  {displayed.length} fan{displayed.length !== 1 ? "s" : ""}
                  {search || filter !== "ALL" ? ` matching current filters (${fans.length} total)` : ""}
                  {" · "}
                  <span className="text-muted-foreground/30">click any row to expand details</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Super Fans sidebar ──────────────────────────────────────────── */}
        <div className="w-64 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: "#D4A843" }} />
              <p className="text-sm font-semibold text-foreground">Super Fans</p>
            </div>
          </div>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {superFans.length === 0 ? (
              <div className="py-10 text-center space-y-1.5 px-4">
                <Trophy size={24} className="mx-auto" style={{ color: "rgba(255,255,255,0.08)" }} />
                <p className="text-xs text-muted-foreground">No spend data yet</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.20)" }}>
                  Super fans appear once they buy merch or tip.
                </p>
              </div>
            ) : (
              superFans.map((fan, i) => (
                <SuperFanRow key={fan.email} fan={fan} rank={i + 1} />
              ))
            )}
          </div>

          {/* Revenue summary */}
          {(stats?.totalRevenue ?? 0) > 0 && (
            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={13} style={{ color: "#34C759" }} />
                <p className="text-xs font-semibold text-foreground">Revenue summary</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#34C759" }}>
                ${stats!.totalRevenue.toFixed(2)}
              </p>
              <div className="space-y-1">
                {(stats?.supporters ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-muted-foreground"><Heart size={10} /> Tips</span>
                    <span style={{ color: "#AF52DE" }}>{stats!.supporters} fan{stats!.supporters !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {(stats?.merchBuyers ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-muted-foreground"><ShoppingBag size={10} /> Merch</span>
                    <span style={{ color: "#34C759" }}>{stats!.merchBuyers} buyer{stats!.merchBuyers !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div
            className="rounded-2xl border p-4 space-y-2"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Filter size={12} className="text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">Source key</p>
            </div>
            {(Object.entries(SOURCE_META) as [FanSource, typeof SOURCE_META[FanSource]][]).map(([key, m]) => (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? "ALL" : key)}
                className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
                style={filter === key ? { backgroundColor: `${m.color}12` } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Source breakdown banner (empty state) ────────────────────────────── */}
      {fans.length === 0 && !loading && (
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm font-semibold text-foreground mb-3">Where fans come from</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.entries(SOURCE_META) as [FanSource, typeof SOURCE_META[FanSource]][]).map(([, m]) => (
              <div key={m.label} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: m.bg }}>
                  <span className="text-[10px] font-bold" style={{ color: m.color }}>{m.short.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">via artist page</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
