"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, DollarSign, TrendingUp, BarChart2, Music, ExternalLink, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LicenseType = "EXCLUSIVE" | "NON_EXCLUSIVE" | "LEASE";
type FilterType  = "ALL" | LicenseType;

type LicenseRow = {
  id:          string;
  createdAt:   string;
  beat: { id: string; title: string; coverArtUrl: string | null };
  buyer: { id: string; name: string; artistSlug: string | null; photo: string | null };
  licenseType: LicenseType;
  price:       number;
  pdfUrl:      string | null;
  status:      string;
};

type Stats = {
  totalSales:       number;
  totalRevenue:     number;
  thisMonthRevenue: number;
  avgSalePrice:     number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const LICENSE_META: Record<LicenseType, { label: string; bg: string; text: string }> = {
  EXCLUSIVE:     { label: "Exclusive",     bg: "rgba(212,168,67,0.15)",  text: "#D4A843" },
  NON_EXCLUSIVE: { label: "Non-Exclusive", bg: "rgba(99,102,241,0.15)",  text: "#818CF8" },
  LEASE:         { label: "Lease",         bg: "rgba(34,197,94,0.15)",   text: "#4ADE80" },
};

const FILTER_LABELS: Record<FilterType, string> = {
  ALL:           "All",
  LEASE:         "Lease",
  NON_EXCLUSIVE: "Non-Exclusive",
  EXCLUSIVE:     "Exclusive",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProducerLicensingPage() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [stats,    setStats]    = useState<Stats>({
    totalSales: 0, totalRevenue: 0, thisMonthRevenue: 0, avgSalePrice: 0,
  });
  const [loading, setLoading]   = useState(true);
  const [filter,  setFilter]    = useState<FilterType>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/producer/licensing");
      if (res.ok) {
        const data = await res.json();
        setLicenses(data.licenses);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter === "ALL"
    ? licenses
    : licenses.filter((l) => l.licenseType === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">License Sales</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sales",         value: stats.totalSales,                       icon: FileText },
          { label: "Total Revenue",        value: `$${stats.totalRevenue.toFixed(2)}`,    icon: DollarSign },
          { label: "This Month",           value: `$${stats.thisMonthRevenue.toFixed(2)}`,icon: TrendingUp },
          { label: "Avg Sale Price",       value: `$${stats.avgSalePrice.toFixed(2)}`,    icon: BarChart2 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "LEASE", "NON_EXCLUSIVE", "EXCLUSIVE"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={
              filter === f
                ? { backgroundColor: "var(--accent)", color: "var(--background)" }
                : { backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
            }
          >
            {FILTER_LABELS[f]}
            {f !== "ALL" && (
              <span className="ml-1.5 opacity-70">
                {licenses.filter((l) => l.licenseType === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <FileText size={36} className="text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">
              {licenses.length === 0 ? "No license sales yet" : `No ${FILTER_LABELS[filter].toLowerCase()} licenses`}
            </p>
            <p className="text-sm text-muted-foreground">
              {licenses.length === 0
                ? "License sales from the Beat Marketplace will appear here."
                : "Try a different filter."
              }
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Date", "Beat", "Buyer", "License Type", "Amount", "Agreement"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const badge = LICENSE_META[row.licenseType];
                return (
                  <tr
                    key={row.id}
                    className="border-b last:border-b-0 hover:bg-white/3 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </td>

                    {/* Beat */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded overflow-hidden shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: "var(--background)" }}
                        >
                          {row.beat.coverArtUrl
                            ? <img src={row.beat.coverArtUrl} alt={row.beat.title} className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
                            : <Music size={12} className="text-muted-foreground" />
                          }
                        </div>
                        <span className="font-medium text-foreground truncate max-w-[140px]">
                          {row.beat.title}
                        </span>
                      </div>
                    </td>

                    {/* Buyer */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold"
                          style={{
                            backgroundColor: row.buyer.photo ? "transparent" : "var(--accent)",
                            color: "var(--background)",
                          }}
                        >
                          {row.buyer.photo
                            ? <img src={row.buyer.photo} alt={row.buyer.name} className="w-full h-full object-cover" />  // eslint-disable-line @next/next/no-img-element
                            : row.buyer.name[0]?.toUpperCase()
                          }
                        </div>
                        {row.buyer.artistSlug ? (
                          <a
                            href={`/${row.buyer.artistSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-accent transition-colors flex items-center gap-1"
                          >
                            {row.buyer.name}
                            <ExternalLink size={11} className="text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="text-foreground">{row.buyer.name}</span>
                        )}
                      </div>
                    </td>

                    {/* License type badge */}
                    <td className="px-4 py-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-semibold text-foreground">
                      ${row.price.toFixed(2)}
                    </td>

                    {/* Agreement PDF */}
                    <td className="px-4 py-3">
                      {row.pdfUrl ? (
                        <a
                          href={row.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-accent hover:underline text-xs font-medium"
                        >
                          <FileText size={13} />
                          View PDF
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
