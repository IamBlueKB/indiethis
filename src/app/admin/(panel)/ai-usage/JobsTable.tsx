"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Loader2, ExternalLink,
  CheckCircle2, AlertCircle, Clock, Zap, X,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AIJobType    = "VIDEO"|"COVER_ART"|"MASTERING"|"LYRIC_VIDEO"|"AR_REPORT"|"PRESS_KIT";
type AIJobStatus  = "QUEUED"|"PROCESSING"|"COMPLETE"|"FAILED";
type AIJobTrigger = "ARTIST"|"STUDIO";

interface JobRow {
  id:                 string;
  type:               AIJobType;
  status:             AIJobStatus;
  triggeredBy:        AIJobTrigger;
  triggeredById:      string;
  artistId:           string | null;
  studioId:           string | null;
  priceCharged:       number | null;
  costToUs:           number | null;
  errorMessage:       string | null;
  createdAt:          string;
  completedAt:        string | null;
  durationMs:         number | null;
  triggeredByName:    string | null;
  triggeredByEmail:   string | null;
}

interface ApiResponse {
  jobs:  JobRow[];
  total: number;
  pages: number;
  page:  number;
}

interface Filters {
  type:        string;
  status:      string;
  triggeredBy: string;
  from:        string;
  to:          string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_LABEL: Record<string, string> = {
  VIDEO:       "Music Video",
  COVER_ART:   "Cover Art",
  MASTERING:   "Mastering",
  LYRIC_VIDEO: "Lyric Video",
  AR_REPORT:   "A&R Report",
  PRESS_KIT:   "Press Kit",
};

const TOOL_COLOR: Record<string, string> = {
  VIDEO:       "#E85D4A",
  COVER_ART:   "#D4A843",
  MASTERING:   "#34C759",
  LYRIC_VIDEO: "#5AC8FA",
  AR_REPORT:   "#AF52DE",
  PRESS_KIT:   "#FF9F0A",
};

const COST_ESTIMATE: Record<string, number> = {
  VIDEO: 0.85, COVER_ART: 0.04, MASTERING: 0.12,
  LYRIC_VIDEO: 0.65, AR_REPORT: 0.22, PRESS_KIT: 0.18,
};

// ─── Helper formatters ─────────────────────────────────────────────────────────

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AIJobStatus }) {
  const cfg: Record<AIJobStatus, { bg: string; fg: string; icon: React.ElementType; label: string }> = {
    COMPLETE:   { bg: "rgba(52,199,89,0.12)",  fg: "#34C759",  icon: CheckCircle2, label: "Complete"   },
    FAILED:     { bg: "rgba(232,93,74,0.12)",  fg: "#E85D4A",  icon: AlertCircle,  label: "Failed"     },
    PROCESSING: { bg: "rgba(90,200,250,0.12)", fg: "#5AC8FA",  icon: Zap,          label: "Processing" },
    QUEUED:     { bg: "rgba(255,159,10,0.12)", fg: "#FF9F0A",  icon: Clock,        label: "Queued"     },
  };
  const { bg, fg, icon: Icon, label } = cfg[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: bg, color: fg }}>
      <Icon size={10} strokeWidth={2.5} />
      {label}
    </span>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  filters, onChange, onClear,
}: {
  filters: Filters;
  onChange: (key: keyof Filters, val: string) => void;
  onClear: () => void;
}) {
  const selectClass =
    "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors";
  const selectStyle = {
    background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)",
  };
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex items-center gap-2 flex-wrap pb-4 border-b mb-4"
      style={{ borderColor: "var(--border)" }}>

      <select value={filters.type} onChange={e => onChange("type", e.target.value)}
        className={selectClass} style={selectStyle}>
        <option value="">All Tools</option>
        {Object.entries(TOOL_LABEL).map(([v, l]) =>
          <option key={v} value={v}>{l}</option>)}
      </select>

      <select value={filters.status} onChange={e => onChange("status", e.target.value)}
        className={selectClass} style={selectStyle}>
        <option value="">All Statuses</option>
        {(["COMPLETE","PROCESSING","QUEUED","FAILED"] as AIJobStatus[]).map(s =>
          <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
      </select>

      <select value={filters.triggeredBy} onChange={e => onChange("triggeredBy", e.target.value)}
        className={selectClass} style={selectStyle}>
        <option value="">All Triggers</option>
        <option value="ARTIST">Artist</option>
        <option value="STUDIO">Studio</option>
      </select>

      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>From</span>
        <input type="date" value={filters.from} onChange={e => onChange("from", e.target.value)}
          className={selectClass} style={selectStyle} />
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>To</span>
        <input type="date" value={filters.to} onChange={e => onChange("to", e.target.value)}
          className={selectClass} style={selectStyle} />
      </div>

      {hasFilters && (
        <button onClick={onClear}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <X size={11} /> Clear
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function JobsTable() {
  const [filters, setFilters] = useState<Filters>({
    type: "", status: "", triggeredBy: "", from: "", to: "",
  });
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const LIMIT = 50;

  const fetchJobs = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (f.type)        params.set("type",        f.type);
      if (f.status)      params.set("status",      f.status);
      if (f.triggeredBy) params.set("triggeredBy", f.triggeredBy);
      if (f.from)        params.set("from", new Date(f.from).toISOString());
      if (f.to)          params.set("to",   new Date(f.to + "T23:59:59").toISOString());

      const res = await fetch(`/api/admin/ai-usage?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Re-fetch when filters or page change
  useEffect(() => { fetchJobs(filters, page); }, [filters, page, fetchJobs]);

  function changeFilter(key: keyof Filters, val: string) {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ type: "", status: "", triggeredBy: "", from: "", to: "" });
    setPage(1);
  }

  const jobs  = data?.jobs  ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const COL = "1.5fr 90px 90px 100px 70px 70px 80px 130px 36px";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Job Log
          {!loading && total > 0 && (
            <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
              {total.toLocaleString()} total
            </span>
          )}
        </h2>
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: "#E85D4A" }} />}
      </div>

      <div className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>

        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <FilterBar filters={filters} onChange={changeFilter} onClear={clearFilters} />

          {/* Table header */}
          <div className="grid text-[11px] font-semibold uppercase tracking-wider px-1"
            style={{ color: "var(--muted-foreground)", gridTemplateColumns: COL, gap: "0 8px" }}>
            <span>User</span>
            <span>Tool</span>
            <span>Status</span>
            <span>Trigger</span>
            <span>Revenue</span>
            <span>Cost</span>
            <span>Duration</span>
            <span>Date</span>
            <span />
          </div>
        </div>

        {/* Rows */}
        {jobs.length === 0 && !loading ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              No jobs found for the selected filters.
            </p>
          </div>
        ) : (
          <div>
            {jobs.map((job, i) => {
              const color = TOOL_COLOR[job.type] ?? "#999";
              const cost  = job.costToUs ?? COST_ESTIMATE[job.type] ?? 0;
              const rev   = job.priceCharged ?? 0;
              return (
                <div key={job.id}
                  className="grid items-center px-5 py-3 border-b last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: "var(--border)", gridTemplateColumns: COL, gap: "0 8px",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>

                  {/* User */}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {job.triggeredByName ?? "—"}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
                      {job.triggeredByEmail ?? job.triggeredById.slice(0, 10) + "…"}
                    </p>
                  </div>

                  {/* Tool */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-xs truncate" style={{ color: "var(--foreground)" }}>
                      {TOOL_LABEL[job.type] ?? job.type}
                    </span>
                  </div>

                  {/* Status */}
                  <div><StatusBadge status={job.status} /></div>

                  {/* Trigger */}
                  <span className="text-[11px] font-medium"
                    style={{ color: job.triggeredBy === "STUDIO" ? "#5AC8FA" : "#D4A843" }}>
                    {job.triggeredBy === "STUDIO" ? "Studio" : "Artist"}
                    {job.studioId && (
                      <span className="ml-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                        (studio)
                      </span>
                    )}
                  </span>

                  {/* Revenue */}
                  <span className="text-xs font-semibold"
                    style={{ color: rev > 0 ? "#34C759" : "var(--muted-foreground)" }}>
                    {rev > 0 ? `$${rev.toFixed(2)}` : "Credit"}
                  </span>

                  {/* Cost */}
                  <span className="text-xs" style={{ color: "#E85D4A" }}>
                    ${cost.toFixed(2)}
                    {!job.costToUs && (
                      <span className="text-[9px] ml-0.5" style={{ color: "var(--muted-foreground)" }}>est</span>
                    )}
                  </span>

                  {/* Duration */}
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {fmtDuration(job.durationMs)}
                  </span>

                  {/* Date */}
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {fmtDate(job.createdAt)}
                  </span>

                  {/* Detail link */}
                  <Link href={`/admin/ai-usage/${job.id}`}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <ChevronLeft size={13} /> Previous
            </button>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
