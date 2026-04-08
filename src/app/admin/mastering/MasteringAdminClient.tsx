"use client";

/**
 * MasteringAdminClient — interactive portion of /admin/mastering
 *
 * Tabs: Overview | Jobs | Albums | Presets
 */

import { useState } from "react";
import {
  BarChart3, Music, Disc3, Layers, ChevronDown, ChevronUp,
  Check, X, Clock, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Metrics {
  totalJobs:        number;
  completed:        number;
  failed:           number;
  processing:       number;
  completionRate:   string;
  totalRevCents:    number;
  monthlyRevCents:  number;
  monthlyCount:     number;
  byMode:           Record<string, number>;
  byTier:           Record<string, number>;
}

interface StatusRow {
  status:   string;
  count:    number;
  revCents: number;
}

interface Job {
  id:           string;
  status:       string;
  mode:         string;
  tier:         string | null;
  genre:        string | null;
  amount:       number | null;
  guestEmail:   string | null;
  userId:       string | null;
  albumGroupId: string | null;
  revisionUsed: boolean;
  createdAt:    string;
}

interface Preset {
  id:          string;
  name:        string;
  genre:       string;
  description: string;
}

interface AlbumGroup {
  id:              string;
  title:           string;
  status:          string;
  completedTracks: number;
  totalTracks:     number;
  createdAt:       string;
}

interface Props {
  metrics:     Metrics;
  byStatus:    StatusRow[];
  recentJobs:  Job[];
  presets:     Preset[];
  albumGroups: AlbumGroup[];
}

type Tab = "overview" | "jobs" | "albums" | "presets";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusColor(status: string): string {
  switch (status) {
    case "COMPLETE":  return "#4ecdc4";
    case "FAILED":    return "#ff6b6b";
    case "PENDING":   return "#555";
    default:          return "#D4A843";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${statusColor(status)}22`, color: statusColor(status) }}
    >
      {status === "COMPLETE"  && <Check  size={10} />}
      {status === "FAILED"    && <X      size={10} />}
      {["ANALYZING","SEPARATING","MIXING","MASTERING"].includes(status) && <Loader2 size={10} className="animate-spin" />}
      {status === "PENDING"   && <Clock  size={10} />}
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MasteringAdminClient({ metrics, byStatus, recentJobs, presets, albumGroups }: Props) {
  const [tab,    setTab]    = useState<Tab>("overview");
  const [filter, setFilter] = useState<string>("ALL");

  const filteredJobs = filter === "ALL"
    ? recentJobs
    : recentJobs.filter((j) => j.status === filter);

  return (
    <div className="p-6 max-w-6xl space-y-6" style={{ color: "#fff" }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Music size={22} style={{ color: "#D4A843" }} />
          AI Mix &amp; Master
        </h1>
        <p className="text-sm mt-1" style={{ color: "#777" }}>
          Jobs, revenue, presets, and album groups
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}>
        {([
          { id: "overview", label: "Overview",   icon: <BarChart3 size={14} /> },
          { id: "jobs",     label: "Jobs",        icon: <Music     size={14} /> },
          { id: "albums",   label: "Albums",      icon: <Disc3     size={14} /> },
          { id: "presets",  label: "Presets",     icon: <Layers    size={14} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all")}
            style={tab === t.id ? { backgroundColor: "#D4A843", color: "#0A0A0A" } : { color: "#777" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ Overview ══════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">

          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total jobs",       value: metrics.totalJobs.toLocaleString(),   sub: `${metrics.completionRate}% completion` },
              { label: "All-time revenue", value: fmtUSD(metrics.totalRevCents),         sub: "gross" },
              { label: "This month",       value: fmtUSD(metrics.monthlyRevCents),       sub: `${metrics.monthlyCount} jobs` },
              { label: "Active",           value: metrics.processing.toLocaleString(),   sub: `${metrics.failed} failed` },
            ].map((kpi) => (
              <div key={kpi.label} className="p-4 rounded-2xl border space-y-1" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
                <p className="text-xs font-medium" style={{ color: "#777" }}>{kpi.label}</p>
                <p className="text-2xl font-black">{kpi.value}</p>
                <p className="text-xs" style={{ color: "#555" }}>{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* By status */}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "#1A1A1A" }}>
              <h2 className="text-sm font-semibold">By status</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1A1A1A" }}>
                  {["Status", "Count", "Revenue"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#777" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byStatus.map((row) => (
                  <tr key={row.status} style={{ borderBottom: "1px solid #111" }}>
                    <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-5 py-3 font-mono text-sm">{row.count.toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-sm">{fmtUSD(row.revCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mode + Tier breakdown (this month) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-5" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
              <h2 className="text-sm font-semibold mb-4">Mode (this month)</h2>
              {Object.entries(metrics.byMode).map(([mode, count]) => (
                <div key={mode} className="flex justify-between text-sm py-1">
                  <span style={{ color: "#ccc" }}>{mode.replace("_", " + ")}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(metrics.byMode).length === 0 && (
                <p className="text-xs" style={{ color: "#555" }}>No data this month</p>
              )}
            </div>
            <div className="rounded-2xl border p-5" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
              <h2 className="text-sm font-semibold mb-4">Tier (this month)</h2>
              {Object.entries(metrics.byTier).map(([tier, count]) => (
                <div key={tier} className="flex justify-between text-sm py-1">
                  <span style={{ color: "#ccc" }}>{tier.charAt(0) + tier.slice(1).toLowerCase()}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(metrics.byTier).length === 0 && (
                <p className="text-xs" style={{ color: "#555" }}>No data this month</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Jobs ═════════════════════════════════════════════════════════════ */}
      {tab === "jobs" && (
        <div className="space-y-4">

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {["ALL", "COMPLETE", "FAILED", "PENDING", "MASTERING", "ANALYZING"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={filter === s
                  ? { backgroundColor: "#D4A843", color: "#0A0A0A" }
                  : { backgroundColor: "#1A1A1A", color: "#777", border: "1px solid #2A2A2A" }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1A1A1A" }}>
                    {["ID", "Status", "Mode", "Tier", "Genre", "Amount", "Type", "Date"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#777" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.slice(0, 50).map((j) => (
                    <tr key={j.id} style={{ borderBottom: "1px solid #111" }}>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "#555" }}>{j.id.slice(-8)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={j.status} /></td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "#ccc" }}>{j.mode === "MIX_AND_MASTER" ? "Mix+Master" : "Master"}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "#ccc" }}>{j.tier}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "#ccc" }}>{j.genre ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{j.amount != null ? fmtUSD(j.amount) : "—"}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: j.userId ? "#D4A843" : "#555" }}>
                        {j.userId ? "Sub" : "Guest"}
                        {j.albumGroupId ? " · Album" : ""}
                        {j.revisionUsed ? " · Rev" : ""}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "#555" }}>{fmtDate(j.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: "#555" }}>
                        No jobs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredJobs.length > 50 && (
            <p className="text-xs text-center" style={{ color: "#555" }}>Showing 50 of {filteredJobs.length} jobs</p>
          )}
        </div>
      )}

      {/* ══ Albums ═══════════════════════════════════════════════════════════ */}
      {tab === "albums" && (
        <div className="space-y-4">
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1A1A1A" }}>
                  {["Album", "Status", "Progress", "Created"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#777" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {albumGroups.map((g) => (
                  <tr key={g.id} style={{ borderBottom: "1px solid #111" }}>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-sm">{g.title}</div>
                      <div className="text-xs font-mono" style={{ color: "#555" }}>{g.id.slice(-8)}</div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={g.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: "#D4A843",
                              width: g.totalTracks > 0 ? `${(g.completedTracks / g.totalTracks) * 100}%` : "0%",
                            }}
                          />
                        </div>
                        <span className="text-xs" style={{ color: "#777" }}>{g.completedTracks}/{g.totalTracks}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "#555" }}>{fmtDate(g.createdAt)}</td>
                  </tr>
                ))}
                {albumGroups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: "#555" }}>
                      No album groups yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Presets ══════════════════════════════════════════════════════════ */}
      {tab === "presets" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "#777" }}>
            {presets.length} genre presets — these define the default mix + mastering chain Claude uses per genre.
          </p>
          {presets.map((p) => (
            <div key={p.id} className="rounded-xl border p-4" style={{ backgroundColor: "#111", borderColor: "#1A1A1A" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#777" }}>{p.genre}</div>
                  <div className="text-xs mt-1.5" style={{ color: "#555" }}>{p.description}</div>
                </div>
                <div
                  className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                  style={{ backgroundColor: "#D4A84322", color: "#D4A843" }}
                >
                  {p.genre}
                </div>
              </div>
            </div>
          ))}
          {presets.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: "#555" }}>
              No presets found. Run the seed script to populate presets.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
