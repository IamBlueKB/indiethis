"use client";

/**
 * VideoAdminClient — admin panel for Music Video Studio.
 * Tabs: Metrics | Videos | Styles
 */

import { useState } from "react";
import {
  Film, BarChart3, List, Palette,
  TrendingUp, DollarSign, Zap, Clock,
  RefreshCw, Loader2, Check, X, Plus,
  Eye, ToggleLeft, ToggleRight, ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Metrics {
  totalVideos:        number;
  videosThisMonth:    number;
  totalRevenue:       number;
  revenueThisMonth:   number;
  avgCostPerVideo:    number;
  marginPct:          number;
  conversionRate:     number;
  avgGenerationSecs:  number;
  popularStyles:      { name: string; count: number }[];
  popularModels:      { model: string; count: number }[];
}

interface VideoRow {
  id:          string;
  trackTitle:  string;
  email:       string | null;
  mode:        string;
  status:      string;
  amount:      number;
  createdAt:   string;
  isSubscriber: boolean;
}

interface VideoStyle {
  id:         string;
  name:       string;
  category:   string;
  previewUrl: string;
  promptBase: string;
  sortOrder:  number;
  active:     boolean;
}

interface Props {
  metrics:    Metrics;
  videos:     VideoRow[];
  styles:     VideoStyle[];
  videoTotal: number;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function Stat({ label, value, sub, icon: Icon, accent = "#D4A843" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#555" }}>{label}</p>
        <Icon size={13} style={{ color: accent }} />
      </div>
      <p className="text-2xl font-black" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#555" }}>{sub}</p>}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    COMPLETE:    { bg: "rgba(52,199,89,0.1)",  color: "#34C759" },
    GENERATING:  { bg: "rgba(212,168,67,0.1)", color: "#D4A843" },
    STITCHING:   { bg: "rgba(90,200,250,0.1)", color: "#5AC8FA" },
    FAILED:      { bg: "rgba(232,93,74,0.1)",  color: "#E85D4A" },
    PENDING:     { bg: "rgba(255,255,255,0.06)", color: "#888" },
    ANALYZING:   { bg: "rgba(212,168,67,0.1)", color: "#D4A843" },
    PLANNING:    { bg: "rgba(212,168,67,0.1)", color: "#D4A843" },
  };
  const { bg, color } = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "#888" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: bg, color }}>
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoAdminClient({ metrics, videos: initialVideos, styles: initialStyles, videoTotal }: Props) {
  const [tab,         setTab]         = useState<"metrics" | "videos" | "styles">("metrics");
  const [videos,      setVideos]      = useState(initialVideos);
  const [styles,      setStyles]      = useState(initialStyles);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter,   setModeFilter]   = useState("ALL");
  const [subFilter,    setSubFilter]    = useState("ALL");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Style editing state
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<Partial<VideoStyle>>({});
  const [saving,       setSaving]       = useState(false);
  const [showNewStyle, setShowNewStyle] = useState(false);
  const [newStyle,     setNewStyle]     = useState<Partial<VideoStyle>>({
    name: "", category: "CINEMATIC", previewUrl: "", promptBase: "", sortOrder: 0, active: true,
  });
  const [creating,     setCreating]     = useState(false);

  // ── Style CRUD ──────────────────────────────────────────────────────────────

  async function saveStyle(id: string) {
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/video-studio/styles/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(editDraft),
      });
      if (res.ok) {
        const { style } = await res.json();
        setStyles(prev => prev.map(s => s.id === id ? style : s));
        setEditingId(null);
        setEditDraft({});
      }
    } finally { setSaving(false); }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/admin/video-studio/styles/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ active: !current }),
    });
    if (res.ok) {
      setStyles(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s));
    }
  }

  async function deleteStyle(id: string) {
    if (!confirm("Delete this style? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/video-studio/styles/${id}`, { method: "DELETE" });
    if (res.ok) setStyles(prev => prev.filter(s => s.id !== id));
  }

  async function createStyle() {
    if (!newStyle.name || !newStyle.promptBase) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/video-studio/styles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(newStyle),
      });
      if (res.ok) {
        const { style } = await res.json();
        setStyles(prev => [...prev, style]);
        setShowNewStyle(false);
        setNewStyle({ name: "", category: "CINEMATIC", previewUrl: "", promptBase: "", sortOrder: 0, active: true });
      }
    } finally { setCreating(false); }
  }

  // ── Filtered videos ──────────────────────────────────────────────────────────

  const filtered = videos.filter(v => {
    if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
    if (modeFilter   !== "ALL" && v.mode   !== modeFilter)   return false;
    if (subFilter    === "SUBSCRIBER"     && !v.isSubscriber) return false;
    if (subFilter    === "NON_SUBSCRIBER" && v.isSubscriber)  return false;
    return true;
  });

  return (
    <div style={{ color: "#F0F0F0" }}>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "#1E1E1E" }}>
        {([
          { key: "metrics", label: "Metrics",   icon: BarChart3 },
          { key: "videos",  label: "Videos",    icon: List      },
          { key: "styles",  label: "Styles",    icon: Palette   },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px"
            style={{
              borderColor:  tab === key ? "#D4A843" : "transparent",
              color:        tab === key ? "#D4A843" : "#555",
            }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ════════ METRICS TAB ════════ */}
      {tab === "metrics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total Videos"       value={metrics.totalVideos}          icon={Film}       sub={`${metrics.videosThisMonth} this month`} />
            <Stat label="Total Revenue"       value={`$${(metrics.totalRevenue / 100).toFixed(0)}`}   icon={DollarSign} sub={`$${(metrics.revenueThisMonth / 100).toFixed(0)} this month`} />
            <Stat label="Avg Cost / Video"    value={`$${metrics.avgCostPerVideo.toFixed(2)}`}         icon={Zap}        sub={`${metrics.marginPct.toFixed(0)}% margin`} accent="#34C759" />
            <Stat label="Conversion Rate"     value={`${metrics.conversionRate.toFixed(1)}%`}          icon={TrendingUp} sub="guest → subscriber" accent="#5AC8FA" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Stat label="Avg Generation Time" value={`${(metrics.avgGenerationSecs / 60).toFixed(0)}m`} icon={Clock} sub="from submit to complete" accent="#888" />
            <Stat label="Videos All Time"      value={metrics.totalVideos}                               icon={Film}  sub="across all modes + statuses" accent="#888" />
          </div>

          {/* Popular styles */}
          <div className="rounded-xl border p-4" style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Popular Styles</p>
            <div className="space-y-2">
              {metrics.popularStyles.map(({ name, count }) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-sm text-white">{name}</span>
                  <span className="text-xs font-bold" style={{ color: "#D4A843" }}>{count}</span>
                </div>
              ))}
              {metrics.popularStyles.length === 0 && (
                <p className="text-xs" style={{ color: "#555" }}>No data yet</p>
              )}
            </div>
          </div>

          {/* Popular models */}
          <div className="rounded-xl border p-4" style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Model Usage</p>
            <div className="space-y-2">
              {metrics.popularModels.map(({ model, count }) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-xs text-white font-mono">{model.replace("fal-ai/", "")}</span>
                  <span className="text-xs font-bold" style={{ color: "#D4A843" }}>{count}</span>
                </div>
              ))}
              {metrics.popularModels.length === 0 && (
                <p className="text-xs" style={{ color: "#555" }}>No data yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════ VIDEOS TAB ════════ */}
      {tab === "videos" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {(["ALL","COMPLETE","GENERATING","STITCHING","FAILED","PENDING"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                style={{
                  borderColor:     statusFilter === s ? "#D4A843" : "#2A2A2A",
                  backgroundColor: statusFilter === s ? "rgba(212,168,67,0.1)" : "transparent",
                  color:           statusFilter === s ? "#D4A843" : "#666",
                }}>
                {s}
              </button>
            ))}
            <div className="w-px" style={{ backgroundColor: "#2A2A2A" }} />
            {(["ALL","QUICK","DIRECTOR"] as const).map(m => (
              <button key={m} onClick={() => setModeFilter(m)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                style={{
                  borderColor:     modeFilter === m ? "#5AC8FA" : "#2A2A2A",
                  backgroundColor: modeFilter === m ? "rgba(90,200,250,0.1)" : "transparent",
                  color:           modeFilter === m ? "#5AC8FA" : "#666",
                }}>
                {m}
              </button>
            ))}
            <div className="w-px" style={{ backgroundColor: "#2A2A2A" }} />
            {(["ALL","SUBSCRIBER","NON_SUBSCRIBER"] as const).map(t => (
              <button key={t} onClick={() => setSubFilter(t)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                style={{
                  borderColor:     subFilter === t ? "#34C759" : "#2A2A2A",
                  backgroundColor: subFilter === t ? "rgba(52,199,89,0.1)" : "transparent",
                  color:           subFilter === t ? "#34C759" : "#666",
                }}>
                {t.replace("_", " ")}
              </button>
            ))}
          </div>

          <p className="text-xs" style={{ color: "#555" }}>Showing {filtered.length} of {videoTotal} videos</p>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1E1E1E" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#0F0F0F", borderBottom: "1px solid #1E1E1E" }}>
                  {["Track", "Email", "Mode", "Status", "Paid", "Date", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "#555" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <>
                    <tr key={v.id} style={{ borderBottom: "1px solid #151515", backgroundColor: expandedId === v.id ? "#111" : "transparent" }}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-white text-xs truncate max-w-[140px]">{v.trackTitle}</p>
                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: "#444" }}>{v.id.slice(-8)}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs truncate max-w-[140px]" style={{ color: v.isSubscriber ? "#34C759" : "#888" }}>
                          {v.email ?? "—"}
                        </p>
                        {v.isSubscriber && (
                          <p className="text-[10px]" style={{ color: "#34C759" }}>subscriber</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold" style={{ color: v.mode === "DIRECTOR" ? "#E85D4A" : "#D4A843" }}>
                          {v.mode}
                        </span>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: v.amount === 0 ? "#555" : "#fff" }}>
                          {v.amount === 0 ? "free" : `$${(v.amount / 100).toFixed(2)}`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: "#555" }}>
                          {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                          className="text-xs" style={{ color: "#555" }}>
                          <ChevronDown size={12} className={expandedId === v.id ? "rotate-180 transition-transform" : "transition-transform"} />
                        </button>
                      </td>
                    </tr>
                    {expandedId === v.id && (
                      <tr key={`${v.id}-expanded`} style={{ backgroundColor: "#0A0A0A", borderBottom: "1px solid #1A1A1A" }}>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex gap-3">
                            <a href={`/video-studio/${v.id}/preview`} target="_blank"
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                              style={{ borderColor: "#2A2A2A", color: "#D4A843" }}>
                              <Eye size={11} /> Preview
                            </a>
                            <span className="text-xs self-center font-mono" style={{ color: "#333" }}>
                              ID: {v.id}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <p className="text-sm" style={{ color: "#444" }}>No videos match the current filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ STYLES TAB ════════ */}
      {tab === "styles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{styles.length} styles</p>
            <button onClick={() => setShowNewStyle(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl"
              style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
              <Plus size={12} /> New Style
            </button>
          </div>

          {/* New style form */}
          {showNewStyle && (
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "rgba(212,168,67,0.2)", backgroundColor: "#0F0F0F" }}>
              <p className="text-sm font-bold text-white">Create New Style</p>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Name" value={newStyle.name ?? ""}
                  onChange={e => setNewStyle(p => ({ ...p, name: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm text-white border bg-transparent"
                  style={{ borderColor: "#2A2A2A" }} />
                <select value={newStyle.category ?? "CINEMATIC"}
                  onChange={e => setNewStyle(p => ({ ...p, category: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm text-white border bg-transparent"
                  style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
                  {["CINEMATIC","ANIMATED","ABSTRACT","RETRO","DARK","BRIGHT"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <input placeholder="Preview video URL" value={newStyle.previewUrl ?? ""}
                onChange={e => setNewStyle(p => ({ ...p, previewUrl: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white border bg-transparent"
                style={{ borderColor: "#2A2A2A" }} />
              <textarea placeholder="Prompt base (prepended to every scene prompt)"
                value={newStyle.promptBase ?? ""}
                onChange={e => setNewStyle(p => ({ ...p, promptBase: e.target.value }))}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm text-white border bg-transparent resize-none"
                style={{ borderColor: "#2A2A2A" }} />
              <div className="flex gap-2">
                <button onClick={createStyle} disabled={creating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                  {creating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Create
                </button>
                <button onClick={() => setShowNewStyle(false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "#2A2A2A", color: "#888" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Style list */}
          <div className="space-y-2">
            {styles.map(style => (
              <div key={style.id} className="rounded-xl border p-4"
                style={{ borderColor: "#1E1E1E", backgroundColor: "#0F0F0F", opacity: style.active ? 1 : 0.5 }}>
                {editingId === style.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input defaultValue={style.name}
                        onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))}
                        className="rounded-lg px-3 py-2 text-sm text-white border bg-transparent"
                        style={{ borderColor: "#2A2A2A" }} />
                      <select defaultValue={style.category}
                        onChange={e => setEditDraft(p => ({ ...p, category: e.target.value }))}
                        className="rounded-lg px-3 py-2 text-sm text-white border"
                        style={{ borderColor: "#2A2A2A", backgroundColor: "#111" }}>
                        {["CINEMATIC","ANIMATED","ABSTRACT","RETRO","DARK","BRIGHT"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <input defaultValue={style.previewUrl}
                      placeholder="Preview video URL"
                      onChange={e => setEditDraft(p => ({ ...p, previewUrl: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white border bg-transparent"
                      style={{ borderColor: "#2A2A2A" }} />
                    <textarea defaultValue={style.promptBase}
                      onChange={e => setEditDraft(p => ({ ...p, promptBase: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white border bg-transparent resize-none"
                      style={{ borderColor: "#2A2A2A" }} />
                    <div className="flex gap-2">
                      <button onClick={() => saveStyle(style.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}>
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
                      </button>
                      <button onClick={() => { setEditingId(null); setEditDraft({}); }}
                        className="px-3 py-2 rounded-lg text-xs font-semibold border"
                        style={{ borderColor: "#2A2A2A", color: "#888" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Preview thumbnail */}
                      {style.previewUrl && (
                        <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-black">
                          <video src={style.previewUrl} muted loop autoPlay
                            className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm">{style.name}</p>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                            {style.category}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#666" }}>
                          {style.promptBase}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleActive(style.id, style.active)}
                        className="text-xs" style={{ color: style.active ? "#34C759" : "#555" }}>
                        {style.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => { setEditingId(style.id); setEditDraft({}); }}
                        className="text-xs px-2 py-1 rounded-lg border"
                        style={{ borderColor: "#2A2A2A", color: "#888" }}>
                        Edit
                      </button>
                      <button onClick={() => deleteStyle(style.id)}
                        className="text-xs px-2 py-1 rounded-lg border"
                        style={{ borderColor: "#2A2A2A", color: "#E85D4A" }}>
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
