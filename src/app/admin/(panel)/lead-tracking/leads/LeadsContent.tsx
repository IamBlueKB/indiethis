"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";

type LeadRow = {
  id:       string;
  studio:   string;
  name:     string;
  email:    string;
  date:     string; // ISO string
  source:   "Contact Form" | "Intake Form";
  status:   "Inquiry" | "Requested" | "Converted";
};

type SortKey = "studio" | "date" | "source" | "status";
type SortDir = "asc" | "desc";

const STATUS_COLOR: Record<LeadRow["status"], string> = {
  Inquiry:   "#5AC8FA",
  Requested: "#D4A843",
  Converted: "#34C759",
};

export default function LeadsContent({
  leads,
  total,
  month,
}: {
  leads:  LeadRow[];
  total:  number;
  month:  string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [leads, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} style={{ color: "#D4A843" }} />
      : <ChevronDown size={12} style={{ color: "#D4A843" }} />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lead Submissions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All contact form and intake form submissions — {month}
        </p>
      </div>

      {/* Total */}
      <div
        className="rounded-2xl border p-5 flex items-center gap-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Submissions</p>
          <p className="text-3xl font-bold text-foreground font-display mt-1">{total}</p>
        </div>
        <div className="h-10 w-px mx-2" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex gap-6 text-sm">
          <div>
            <span className="font-semibold text-foreground">{leads.filter((l) => l.source === "Contact Form").length}</span>
            <span className="text-muted-foreground ml-1.5">Contact Forms</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">{leads.filter((l) => l.source === "Intake Form").length}</span>
            <span className="text-muted-foreground ml-1.5">Intake Forms</span>
          </div>
          <div>
            <span className="font-semibold" style={{ color: "#34C759" }}>{leads.filter((l) => l.status === "Converted").length}</span>
            <span className="text-muted-foreground ml-1.5">Converted</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        {/* Column headers */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", gridTemplateColumns: "1.5fr 1.2fr 1.5fr 100px 110px 110px" }}
        >
          <button
            onClick={() => handleSort("studio")}
            className="flex items-center gap-1.5 text-left hover:text-foreground transition-colors"
          >
            Studio <SortIcon col="studio" />
          </button>
          <span>Submitter</span>
          <span>Email</span>
          <button
            onClick={() => handleSort("source")}
            className="flex items-center gap-1.5 text-left hover:text-foreground transition-colors"
          >
            Source <SortIcon col="source" />
          </button>
          <button
            onClick={() => handleSort("date")}
            className="flex items-center gap-1.5 text-left hover:text-foreground transition-colors"
          >
            Date <SortIcon col="date" />
          </button>
          <button
            onClick={() => handleSort("status")}
            className="flex items-center gap-1.5 text-left hover:text-foreground transition-colors"
          >
            Status <SortIcon col="status" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No submissions this month</p>
            <p className="text-xs text-muted-foreground mt-1">Lead submissions will appear here as studios receive them.</p>
          </div>
        ) : (
          sorted.map((row) => (
            <div
              key={row.id}
              className="grid items-center px-5 py-3.5 border-b last:border-b-0 text-sm"
              style={{ borderColor: "var(--border)", gridTemplateColumns: "1.5fr 1.2fr 1.5fr 100px 110px 110px" }}
            >
              <p className="font-medium text-foreground truncate pr-3">{row.studio}</p>
              <p className="text-foreground truncate pr-3">{row.name}</p>
              <p className="text-muted-foreground truncate pr-3 text-xs">{row.email}</p>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                style={{
                  backgroundColor: row.source === "Contact Form" ? "rgba(90,200,250,0.12)" : "rgba(212,168,67,0.12)",
                  color: row.source === "Contact Form" ? "#5AC8FA" : "#D4A843",
                }}
              >
                {row.source === "Contact Form" ? "Contact" : "Intake"}
              </span>
              <p className="text-muted-foreground text-xs">
                {new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                style={{
                  backgroundColor: `${STATUS_COLOR[row.status]}18`,
                  color: STATUS_COLOR[row.status],
                }}
              >
                {row.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
