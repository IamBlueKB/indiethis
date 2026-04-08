"use client";

/**
 * MasteringAdminClient — interactive portion of /admin/mastering
 *
 * Tabs: Metrics | Jobs | Presets
 */

import { useState } from "react";
import {
  BarChart3, Music, Layers, Check, X, Clock, Loader2,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenrePoint { genre: string; count: number; }

interface Metrics {
  totalJobs:            number;
  completed:            number;
  failed:               number;
  processing:           number;
  completionRate:       string;
  totalRevCents:        number;
  monthlyRevCents:      number;
  monthlyCount:         number;
  byMode:               Record<string, number>;
  byTier:               Record<string, number>;
  avgProcessingMinutes: number;
  conversionRate:       string;
  genreDistribution:    GenrePoint[];
}

interface StatusRow { status: string; count: number; revCents: number; }

interface Job {
  id:             string;
  status:         string;
  mode:           string;
  tier:           string | null;
  genre:          string | null;
  amount:         number | null;
  guestEmail:     string | null;
  userId:         string | null;
  albumGroupId:   string | null;
  revisionUsed:   boolean;
  trackTitle:     string | null;
  processingMins: number | null;
  versions:       unknown[] | null;
  exports:        unknown[] | null;
  createdAt:      string;
}

interface Preset {
  id:            string;
  name:          string;
  genre:         string;
  description:   string;
  mixProfile:    unknown;
  masterProfile: unknown;
  active:        boolean;
  sortOrder:     number;
  createdAt:     string;
}

interface Props {
  metrics:    Metrics;
  byStatus:   StatusRow[];
  recentJobs: Job[];
  presets:    Preset[];
}

type Tab = "metrics" | "jobs" | "presets";

const GENRES = ["HIP_HOP","POP","RNB","ELECTRONIC","ROCK","INDIE","LATIN","ACOUSTIC","JAZZ"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function statusColor(status: string) {
  switch (status) {
    case "COMPLETE": return "#4ecdc4";
    case "FAILED":   return "#ff6b6b";
    case "PENDING":  return "#555";
    default:         return "#D4A843";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${statusColor(status)}22`, color: statusColor(status) }}>
      {status === "COMPLETE"  && <Check  size={10} />}
      {status === "FAILED"    && <X      size={10} />}
      {["ANALYZING","SEPARATING","MIXING","MASTERING"].includes(status) && <Loader2 size={10} className="animate-spin" />}
      {status === "PENDING"   && <Clock  size={10} />}
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="p-4 rounded-2xl border space-y-1" style={{ backgroundColor: "#111", borderColor: accent ? "#D4A843" : "#1A1A1A" }}>
      <p className="text-xs font-medium" style={{ color: "#777" }}>{label}</p>
      <p className="text-2xl font-black" style={{ color: accent ? "#D4A843" : "#fff" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "#555" }}>{sub}</p>}
    </div>
  );
}

// ─── Genre bar chart ──────────────────────────────────────────────────────────

function GenreBar({ data }: { data: GenrePoint[] }) {
  if (!data.length) return <p className="text-xs" style={{ color: "#555" }}>No data yet</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.genre} className="flex items-center gap-3">
          <span className="text-xs w-24 shrink-0 text-right" style={{ color: "#888" }}>
            {d.genre.replace("_", " ")}
          </span>
          <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.count / max) * 100}%`, backgroundColor: "#D4A843" }}
            />
          </div>
          <span className="text-xs w-8 font-bold text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MasteringAdminClient({ metrics, byStatus, recentJobs, presets: initialPresets }: Props) {
  const [tab,        setTab]        = useState<Tab>("metrics");

  // Jobs filter state
  const [fStatus, setFStatus] = useState("ALL");
  const [fMode,   setFMode]   = useState("ALL");
  const [fTier,   setFTier]   = useState("ALL");
  const [fType,   setFType]   = useState("ALL"); // ALL | SUBSCRIBER | GUEST
  const [expanded, setExpanded] = useState<string | null>(null);

  // Presets CRUD state
  const [presets,     setPresets]     = useState<Preset[]>(initialPresets);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [createForm,  setCreateForm]  = useState({ name: "", genre: GENRES[0], description: "", mixProfile: "{}", masterProfile: "{}" });
  const [editForm,    setEditForm]    = useState<Partial<{ name: string; genre: string; description: string; mixProfile: string; masterProfile: string }>>({});

  // ── Filtered jobs ────────────────────────────────────────────────────────────

  const filteredJobs = recentJobs.filter((j) => {
    if (fStatus !== "ALL" && j.status !== fStatus) return false;
    if (fMode   !== "ALL" && j.mode   !== fMode)   return false;
    if (fTier   !== "ALL" && j.tier   !== fTier)   return false;
    if (fType === "SUBSCRIBER" && !j.userId)         return false;
    if (fType === "GUEST"      && j.userId)          return false;
    return true;
  });

  // ── Preset CRUD helpers ──────────────────────────────────────────────────────

  async function createPreset() {
    if (!createForm.name.trim() || !createForm.description.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/mastering/presets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:          createForm.name,
          genre:         createForm.genre,
          description:   createForm.description,
          mixProfile:    JSON.parse(createForm.mixProfile   || "{}"),
          masterProfile: JSON.parse(createForm.masterProfile || "{}"),
        }),
      });
      const { preset } = await res.json();
      setPresets((p) => [...p, { ...preset, createdAt: new Date(preset.createdAt).toISOString() }]);
      setShowCreate(false);
      setCreateForm({ name: "", genre: GENRES[0], description: "", mixProfile: "{}", masterProfile: "{}" });
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/mastering/presets/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...editForm,
          ...(editForm.mixProfile    && { mixProfile:    JSON.parse(editForm.mixProfile) }),
          ...(editForm.masterProfile && { masterProfile: JSON.parse(editForm.masterProfile) }),
        }),
      });
      const { preset } = await res.json();
      setPresets((p) => p.map((x) => x.id === id ? { ...x, ...preset } : x));
      setEditId(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function toggleActive(id: string, current: boolean) {
    setPresets((p) => p.map((x) => x.id === id ? { ...x, active: !current } : x));
    await fetch(`/api/admin/mastering/presets/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active: !current }),
    }).catch(() => {
      setPresets((p) => p.map((x) => x.id === id ? { ...x, active: current } : x)); // revert on err
    });
  }

  async function deletePreset(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/admin/mastering/presets/${id}`, { method: "DELETE" });
      setPresets((p) => p.filter((x) => x.id !== id));
      setDeleteId(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  const card = "p-4 rounded-2xl border space-y-1";
  const cardStyle = { backgroundColor: "#111", borderColor: "#1A1A1A" };
  const inputStyle: React.CSSProperties = {
    backgroundColor: "#0A0A0A", border: "1px solid #2A2A2A", borderRadius: 8,
    color: "#fff", padding: "8px 12px", fontSize: 13, width: "100%",
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl space-y-6" style={{ color: "#fff" }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Sliders size={22} style={{ color: "#D4A843" }} />
          Mix &amp; Master
        </h1>
        <p className="text-sm mt-1" style={{ color: "#777" }}>Jobs, revenue, presets, and performance metrics</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "#111", border: "1px solid #1A1A1A" }}>
        {([
          { id: "metrics", label: "Metrics",  icon: <BarChart3 size={14} /> },
          { id: "jobs",    label: "Jobs",     icon: <Music     size={14} /> },
          { id: "presets", label: "Presets",  icon: <Layers    size={14} /> },
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

      {/* ══ METRICS ══════════════════════════════════════════════════════════════ */}
      {tab === "metrics" && (
        <div className="space-y-6">

          {/* 6 stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Total Jobs (all-time)"    value={metrics.totalJobs.toLocaleString()}    sub={`${metrics.completionRate}% completion rate`} />
            <StatCard label="Jobs This Month"          value={metrics.monthlyCount.toLocaleString()}  sub={`${metrics.failed} failed all-time`} />
            <StatCard label="All-Time Revenue"         value={fmtUSD(metrics.totalRevCents)}          sub="gross" accent />
            <StatCard label="Revenue This Month"       value={fmtUSD(metrics.monthlyRevCents)}        sub="gross this month" />
            <StatCard label="Avg Processing Time"      value={`${metrics.avgProcessingMinutes}m`}     sub="for COMPLETE jobs (last 200)" />
            <StatCard label="Guest → Subscriber Rate"  value={`${metrics.conversionRate}%`}           sub="guest jobs linked after signup" />
          </div>

          {/* Genre bar chart */}
          <div className="rounded-2xl border p-5" style={cardStyle}>
            <h2 className="text-sm font-semibold mb-5">Popular Genres</h2>
            <GenreBar data={metrics.genreDistribution} />
          </div>

          {/* Tier + Mode breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-5" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4">Tier Distribution (this month)</h2>
              {(["STANDARD","PREMIUM","PRO"] as const).map((tier) => {
                const count = metrics.byTier[tier] ?? 0;
                const total = Object.values(metrics.byTier).reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={tier} className="flex items-center gap-3 mb-2">
                    <span className="text-xs w-20 shrink-0" style={{ color: "#888" }}>{tier.charAt(0) + tier.slice(1).toLowerCase()}</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#1A1A1A" }}>
                      <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, backgroundColor: tier === "PRO" ? "#D4A843" : tier === "PREMIUM" ? "#a07830" : "#555" }} />
                    </div>
                    <span className="text-xs w-8 font-bold text-right">{count}</span>
                  </div>
                );
              })}
              {Object.keys(metrics.byTier).length === 0 && <p className="text-xs" style={{ color: "#555" }}>No data this month</p>}
            </div>

            <div className="rounded-2xl border p-5" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4">Mode Distribution (this month)</h2>
              {Object.entries(metrics.byMode).map(([mode, count]) => (
                <div key={mode} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: "#1A1A1A" }}>
                  <span style={{ color: "#ccc" }}>{mode === "MIX_AND_MASTER" ? "Mix + Master" : "Master Only"}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(metrics.byMode).length === 0 && <p className="text-xs" style={{ color: "#555" }}>No data this month</p>}
            </div>
          </div>

          {/* By status table */}
          <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "#1A1A1A" }}>
              <h2 className="text-sm font-semibold">By Status (all-time)</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1A1A1A" }}>
                  {["Status","Count","Revenue"].map((h) => (
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
        </div>
      )}

      {/* ══ JOBS ═════════════════════════════════════════════════════════════════ */}
      {tab === "jobs" && (
        <div className="space-y-4">

          {/* Multi-filter bar */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Status filter */}
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
              <option value="ALL">All Statuses</option>
              {["COMPLETE","FAILED","PENDING","MASTERING","ANALYZING","SEPARATING","MIXING"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Mode filter */}
            <select value={fMode} onChange={(e) => setFMode(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
              <option value="ALL">All Modes</option>
              <option value="MASTER_ONLY">Master Only</option>
              <option value="MIX_AND_MASTER">Mix + Master</option>
            </select>

            {/* Tier filter */}
            <select value={fTier} onChange={(e) => setFTier(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
              <option value="ALL">All Tiers</option>
              {["STANDARD","PREMIUM","PRO"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Type filter */}
            <select value={fType} onChange={(e) => setFType(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px" }}>
              <option value="ALL">All Types</option>
              <option value="SUBSCRIBER">Subscriber</option>
              <option value="GUEST">Guest</option>
            </select>

            <span className="text-xs ml-auto" style={{ color: "#555" }}>{filteredJobs.length} jobs</span>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1A1A1A" }}>
                    {["","Job ID","Track","Genre","Mode","Tier","Status","Type","Created","Time"].map((h) => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold" style={{ color: "#777" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.slice(0, 100).map((j) => (
                    <>
                      <tr
                        key={j.id}
                        onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                        style={{ borderBottom: "1px solid #111" }}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {expanded === j.id ? <ChevronUp size={14} style={{ color: "#555" }} /> : <ChevronDown size={14} style={{ color: "#333" }} />}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "#555" }}>{j.id.slice(-8)}</td>
                        <td className="px-3 py-2.5 text-xs max-w-[140px] truncate" style={{ color: "#ccc" }}>
                          {j.trackTitle ?? <span style={{ color: "#333" }}>—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "#888" }}>{j.genre ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "#ccc" }}>{j.mode === "MIX_AND_MASTER" ? "Mix+Master" : "Master"}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "#ccc" }}>{j.tier ?? "—"}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={j.status} /></td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: j.userId ? "#D4A843" : "#555" }}>
                          {j.userId ? "Sub" : "Guest"}
                          {j.albumGroupId ? " · Album" : ""}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "#555" }}>{fmtDate(j.createdAt)}</td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "#555" }}>
                          {j.processingMins != null ? `${j.processingMins}m` : "—"}
                        </td>
                      </tr>

                      {/* Expandable detail row */}
                      {expanded === j.id && (
                        <tr key={`${j.id}-detail`} style={{ borderBottom: "1px solid #1A1A1A", backgroundColor: "#0D0D0D" }}>
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                              {/* Versions */}
                              <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: "#D4A843" }}>Versions</p>
                                {Array.isArray(j.versions) && j.versions.length > 0 ? (
                                  <div className="space-y-1">
                                    {(j.versions as Array<{ name?: string; lufs?: number; url?: string }>).map((v, i) => (
                                      <div key={i} className="flex justify-between text-xs" style={{ color: "#888" }}>
                                        <span>{v.name ?? `Version ${i + 1}`}</span>
                                        <span className="font-mono">{v.lufs != null ? `${v.lufs} LUFS` : "—"}</span>
                                        <span>{v.url ? <span style={{ color: "#4ecdc4" }}>✓ ready</span> : <span style={{ color: "#555" }}>pending</span>}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs" style={{ color: "#333" }}>No version data</p>
                                )}
                              </div>

                              {/* Exports */}
                              <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: "#D4A843" }}>Exports</p>
                                {Array.isArray(j.exports) && j.exports.length > 0 ? (
                                  <div className="space-y-1">
                                    {(j.exports as Array<{ platform?: string; format?: string; lufs?: number; url?: string }>).map((e, i) => (
                                      <div key={i} className="flex justify-between text-xs" style={{ color: "#888" }}>
                                        <span>{e.platform ?? `Export ${i + 1}`}</span>
                                        <span className="font-mono">{e.lufs != null ? `${e.lufs} LUFS` : "—"}</span>
                                        <span>{e.url ? <span style={{ color: "#4ecdc4" }}>✓ ready</span> : <span style={{ color: "#555" }}>pending</span>}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs" style={{ color: "#333" }}>No export data</p>
                                )}
                              </div>

                            </div>
                            {/* Amount + revision */}
                            <div className="mt-3 flex gap-6 text-xs" style={{ color: "#555" }}>
                              <span>Amount: <strong style={{ color: "#fff" }}>{j.amount != null ? fmtUSD(j.amount) : "—"}</strong></span>
                              <span>Revision used: <strong style={{ color: "#fff" }}>{j.revisionUsed ? "Yes" : "No"}</strong></span>
                              {j.guestEmail && <span>Guest: <strong style={{ color: "#fff" }}>{j.guestEmail}</strong></span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: "#555" }}>No jobs match filters</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredJobs.length > 100 && (
            <p className="text-xs text-center" style={{ color: "#555" }}>Showing 100 of {filteredJobs.length} matching jobs</p>
          )}
        </div>
      )}

      {/* ══ PRESETS ══════════════════════════════════════════════════════════════ */}
      {tab === "presets" && (
        <div className="space-y-4">

          {/* Header + create button */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "#777" }}>{presets.length} genre presets</p>
            <button
              onClick={() => { setShowCreate(true); setEditId(null); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
            >
              <Plus size={14} /> New Preset
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "#111", borderColor: "#D4A843" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#D4A843" }}>New Preset</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Name</label>
                  <input style={inputStyle} value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Dark Trap" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Genre</label>
                  <select style={inputStyle} value={createForm.genre} onChange={(e) => setCreateForm((f) => ({ ...f, genre: e.target.value }))}>
                    {GENRES.map((g) => <option key={g} value={g}>{g.replace("_", " ")}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Description</label>
                <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Heavy low-end, aggressive dynamics…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Mix Profile JSON</label>
                  <textarea style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }} rows={4} value={createForm.mixProfile} onChange={(e) => setCreateForm((f) => ({ ...f, mixProfile: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Master Profile JSON</label>
                  <textarea style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }} rows={4} value={createForm.masterProfile} onChange={(e) => setCreateForm((f) => ({ ...f, masterProfile: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={createPreset} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: "#D4A843", color: "#0A0A0A", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : "Create"}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: "#1A1A1A", color: "#777" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Preset list */}
          {presets.map((p) => (
            <div key={p.id} className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "#111", borderColor: p.active ? "#1A1A1A" : "#2A1A1A" }}>
              {editId === p.id ? (
                /* Inline edit form */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Name</label>
                      <input style={inputStyle} defaultValue={p.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Genre</label>
                      <select style={inputStyle} defaultValue={p.genre} onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))}>
                        {GENRES.map((g) => <option key={g} value={g}>{g.replace("_", " ")}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Description</label>
                    <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} defaultValue={p.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Mix Profile JSON</label>
                      <textarea style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }} rows={5} defaultValue={JSON.stringify(p.mixProfile, null, 2)} onChange={(e) => setEditForm((f) => ({ ...f, mixProfile: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#777" }}>Master Profile JSON</label>
                      <textarea style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }} rows={5} defaultValue={JSON.stringify(p.masterProfile, null, 2)} onChange={(e) => setEditForm((f) => ({ ...f, masterProfile: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => saveEdit(p.id)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: "#D4A843", color: "#0A0A0A", opacity: saving ? 0.6 : 1 }}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setEditId(null); setEditForm({}); }} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: "#1A1A1A", color: "#777" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Read view */
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{p.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#D4A84322", color: "#D4A843" }}>{p.genre.replace("_"," ")}</span>
                        {!p.active && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ff6b6b22", color: "#ff6b6b" }}>Inactive</span>}
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "#777" }}>{p.description}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(p.id, p.active)}
                        title={p.active ? "Deactivate" : "Activate"}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                      >
                        {p.active
                          ? <ToggleRight size={18} style={{ color: "#4ecdc4" }} />
                          : <ToggleLeft  size={18} style={{ color: "#555" }} />}
                      </button>
                      <button
                        onClick={() => { setEditId(p.id); setShowCreate(false); setEditForm({ name: p.name, genre: p.genre, description: p.description }); }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                      >
                        <Pencil size={15} style={{ color: "#777" }} />
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                      >
                        <Trash2 size={15} style={{ color: "#E85D4A" }} />
                      </button>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {deleteId === p.id && (
                    <div className="flex items-center gap-3 mt-2 pt-3 border-t" style={{ borderColor: "#1A1A1A" }}>
                      <p className="text-xs flex-1" style={{ color: "#ff6b6b" }}>Delete <strong>{p.name}</strong>? This cannot be undone.</p>
                      <button onClick={() => deletePreset(p.id)} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#E85D4A", color: "#fff" }}>
                        {saving ? "Deleting…" : "Delete"}
                      </button>
                      <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#1A1A1A", color: "#777" }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {presets.length === 0 && !showCreate && (
            <div className="text-center py-12 text-sm" style={{ color: "#555" }}>
              No presets yet. Click "New Preset" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
