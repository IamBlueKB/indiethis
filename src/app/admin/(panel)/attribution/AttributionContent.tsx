"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  FileDown,
  Share2,
  Link2,
  TrendingUp,
  Globe,
  Loader2,
  BarChart3,
} from "lucide-react";
import AdminBarChart from "@/components/admin/charts/AdminBarChart";
import AdminLineChart from "@/components/admin/charts/AdminLineChart";
import DateRangeSelector, { type DateRange } from "@/components/admin/charts/DateRangeSelector";

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

type BySource    = { source: string; count: number };
type ByAffiliate = { affiliateId: string; affiliateName: string; affiliateEmail: string; signups: number; totalEarned: number };
type TopReferrer = { userId: string; name: string; email: string; activeReferrals: number; totalReferrals: number };
type TopAffiliate= { id: string; name: string; email: string; totalReferrals: number; activeReferrals: number; totalEarned: number; pendingPayout: number };
type UtmRow      = { utmSource?: string; utmCampaign?: string; count: number };
type SignupDay   = { date: string; direct: number; referral: number; affiliate: number; file_delivery: number; other: number };

type AttributionData = {
  totalAttributed:    number;
  bySource:           BySource[];
  fileDeliveryCount:  number;
  referralLinkCount:  number;
  affiliateLinkCount: number;
  directCount:        number;
  byAffiliate:        ByAffiliate[];
  topReferrers:       TopReferrer[];
  topAffiliates:      TopAffiliate[];
  utmSources:         UtmRow[];
  utmCampaigns:       UtmRow[];
  signupsByDay:       SignupDay[];
};

/* ------------------------------------------------------------------ */
/* Source labels + colors                                               */
/* ------------------------------------------------------------------ */

const SOURCE_LABEL: Record<string, string> = {
  file_delivery: "File Delivery",
  studio_page:   "Studio Page",
  artist_page:   "Artist Page",
  social:        "Social Media",
  direct:        "Direct",
  ad:            "Paid Ad",
  referral:      "Referral Link",
  affiliate:     "Affiliate",
};

const SOURCE_COLOR: Record<string, string> = {
  file_delivery: "#E85D4A",
  studio_page:   "#D4A843",
  artist_page:   "#5AC8FA",
  social:        "#AF52DE",
  direct:        "#888888",
  ad:            "#34C759",
  referral:      "#FF9F0A",
  affiliate:     "#FF6B9D",
};

const DAY_LINE_COLORS = {
  file_delivery: "#E85D4A",
  affiliate:     "#D4A843",
  referral:      "#5AC8FA",
  direct:        "#888888",
  other:         "#AF52DE",
};

/* ------------------------------------------------------------------ */
/* Stat card                                                            */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--foreground)" }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */

export default function AttributionPage() {
  const [range, setRange] = useState<DateRange>("30d");
  const [data, setData]   = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: DateRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attribution?range=${r}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(range); }, [range, fetchData]);

  // ── Derived chart data ────────────────────────────────────────────

  const sourceBarData = data?.bySource.map((s) => ({
    name:  SOURCE_LABEL[s.source] ?? s.source,
    count: s.count,
    color: SOURCE_COLOR[s.source] ?? "#888",
  })) ?? [];

  const dayLineData = (data?.signupsByDay ?? []).map((d) => ({
    date:         d.date,
    "File Delivery": d.file_delivery,
    "Affiliate":     d.affiliate,
    "Referral":      d.referral,
    "Direct":        d.direct,
    "Other":         d.other,
  }));

  const utmSourceBarData = (data?.utmSources ?? []).slice(0, 8).map((u) => ({
    name:  u.utmSource ?? "(none)",
    count: u.count,
  }));

  const utmCampaignBarData = (data?.utmCampaigns ?? []).slice(0, 8).map((u) => ({
    name:  u.utmCampaign ?? "(none)",
    count: u.count,
  }));

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Attribution Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Understand which channels drive signups
          </p>
        </div>
        <DateRangeSelector value={range} onChange={(r) => setRange(r)} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Stat cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Attributed Signups"
              value={data.totalAttributed}
              color="#E85D4A"
              sub="with any tracking data"
            />
            <StatCard
              icon={FileDown}
              label="From File Delivery"
              value={data.fileDeliveryCount}
              color="#D4A843"
              sub="download page CTA"
            />
            <StatCard
              icon={Share2}
              label="From Referral Links"
              value={data.referralLinkCount}
              color="#5AC8FA"
              sub="platform ref program"
            />
            <StatCard
              icon={Link2}
              label="From Affiliates"
              value={data.affiliateLinkCount}
              color="#AF52DE"
              sub="affiliate landing pages"
            />
          </div>

          {/* ── Signups trend by channel ─────────────────────────────────── */}
          <AdminLineChart
            title="Signups by Channel Over Time"
            data={dayLineData}
            lines={[
              { key: "File Delivery", color: DAY_LINE_COLORS.file_delivery, label: "File Delivery" },
              { key: "Affiliate",     color: DAY_LINE_COLORS.affiliate,     label: "Affiliate"     },
              { key: "Referral",      color: DAY_LINE_COLORS.referral,      label: "Referral"      },
              { key: "Direct",        color: DAY_LINE_COLORS.direct,        label: "Direct"        },
              { key: "Other",         color: DAY_LINE_COLORS.other,         label: "Other"         },
            ]}
            defaultRange={range}
          />

          {/* ── Signups by source bar ────────────────────────────────────── */}
          {sourceBarData.length > 0 ? (
            <AdminBarChart
              title="Signups by Source"
              data={sourceBarData}
              bars={[{ key: "count", color: "#E85D4A", label: "Signups" }]}
              multiColor
            />
          ) : (
            <EmptyCard title="Signups by Source" message="No attribution data in this period." />
          )}

          {/* ── Affiliates + Referrers side-by-side ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Signups by Affiliate */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <Link2 size={14} style={{ color: "#AF52DE" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Signups by Affiliate
                </h2>
              </div>
              <div style={{ backgroundColor: "var(--card)" }}>
                {data.byAffiliate.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                    No affiliate signups in this period.
                  </p>
                ) : (
                  <>
                    <div
                      className="px-5 py-2 grid text-[11px] font-semibold uppercase tracking-wide border-b"
                      style={{
                        gridTemplateColumns: "1fr 60px 80px",
                        color: "var(--muted-foreground)",
                        borderColor: "var(--border)",
                        backgroundColor: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <span>Affiliate</span>
                      <span className="text-right">Signups</span>
                      <span className="text-right">Earned</span>
                    </div>
                    {data.byAffiliate.map((a, i) => (
                      <div
                        key={a.affiliateId}
                        className={`px-5 py-3 grid items-center ${i < data.byAffiliate.length - 1 ? "border-b" : ""}`}
                        style={{ gridTemplateColumns: "1fr 60px 80px", borderColor: "var(--border)" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{a.affiliateName}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>{a.affiliateEmail}</p>
                        </div>
                        <p className="text-sm font-semibold text-right" style={{ color: "#AF52DE" }}>{a.signups}</p>
                        <p className="text-sm text-right" style={{ color: "var(--muted-foreground)" }}>${a.totalEarned.toFixed(0)}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Top Referrers */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <Share2 size={14} style={{ color: "#5AC8FA" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Top Referrers
                </h2>
              </div>
              <div style={{ backgroundColor: "var(--card)" }}>
                {data.topReferrers.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                    No referrals recorded.
                  </p>
                ) : (
                  <>
                    <div
                      className="px-5 py-2 grid text-[11px] font-semibold uppercase tracking-wide border-b"
                      style={{
                        gridTemplateColumns: "1fr 60px 60px",
                        color: "var(--muted-foreground)",
                        borderColor: "var(--border)",
                        backgroundColor: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <span>User</span>
                      <span className="text-right">Active</span>
                      <span className="text-right">Total</span>
                    </div>
                    {data.topReferrers.map((r, i) => (
                      <div
                        key={r.userId}
                        className={`px-5 py-3 grid items-center ${i < data.topReferrers.length - 1 ? "border-b" : ""}`}
                        style={{ gridTemplateColumns: "1fr 60px 60px", borderColor: "var(--border)" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{r.name}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>{r.email}</p>
                        </div>
                        <p className="text-sm font-semibold text-right" style={{ color: "#5AC8FA" }}>{r.activeReferrals}</p>
                        <p className="text-sm text-right" style={{ color: "var(--muted-foreground)" }}>{r.totalReferrals}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Top Affiliates full table ────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center gap-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <TrendingUp size={14} style={{ color: "#D4A843" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Top Affiliates (All Time)
              </h2>
            </div>
            <div style={{ backgroundColor: "var(--card)" }}>
              {data.topAffiliates.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                  No approved affiliates yet.
                </p>
              ) : (
                <>
                  <div
                    className="hidden sm:grid px-5 py-2 text-[11px] font-semibold uppercase tracking-wide border-b"
                    style={{
                      gridTemplateColumns: "1fr 80px 80px 70px 90px",
                      color: "var(--muted-foreground)",
                      borderColor: "var(--border)",
                      backgroundColor: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <span>Affiliate</span>
                    <span className="text-right">Referrals</span>
                    <span className="text-right">Active</span>
                    <span className="text-right">Earned</span>
                    <span className="text-right">Pending</span>
                  </div>
                  {data.topAffiliates.map((a, i) => (
                    <div
                      key={a.id}
                      className={`px-5 py-3 ${i < data.topAffiliates.length - 1 ? "border-b" : ""}`}
                      style={{ borderColor: "var(--border)" }}
                    >
                      {/* Mobile */}
                      <div className="sm:hidden">
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{a.name}</p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{a.email}</p>
                        <div className="flex gap-4 mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                          <span>{a.totalReferrals} referrals</span>
                          <span>{a.activeReferrals} active</span>
                          <span style={{ color: "#D4A843" }}>${a.totalEarned.toFixed(2)} earned</span>
                        </div>
                      </div>
                      {/* Desktop */}
                      <div
                        className="hidden sm:grid items-center"
                        style={{ gridTemplateColumns: "1fr 80px 80px 70px 90px" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{a.name}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>{a.email}</p>
                        </div>
                        <p className="text-sm text-right" style={{ color: "var(--foreground)" }}>{a.totalReferrals}</p>
                        <p className="text-sm font-semibold text-right" style={{ color: "#34C759" }}>{a.activeReferrals}</p>
                        <p className="text-sm font-semibold text-right" style={{ color: "#D4A843" }}>${a.totalEarned.toFixed(0)}</p>
                        <p className="text-sm text-right" style={{ color: "var(--muted-foreground)" }}>${a.pendingPayout.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ── UTM breakdown ────────────────────────────────────────────── */}
          {(utmSourceBarData.length > 0 || utmCampaignBarData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {utmSourceBarData.length > 0 && (
                <AdminBarChart
                  title="utm_source Breakdown"
                  data={utmSourceBarData}
                  bars={[{ key: "count", color: "#5AC8FA", label: "Signups" }]}
                  multiColor
                />
              )}
              {utmCampaignBarData.length > 0 && (
                <AdminBarChart
                  title="utm_campaign Breakdown"
                  data={utmCampaignBarData}
                  bars={[{ key: "count", color: "#FF9F0A", label: "Signups" }]}
                  multiColor
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state card                                                      */
/* ------------------------------------------------------------------ */

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="rounded-2xl border p-8 text-center"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <BarChart3 size={28} className="mx-auto mb-3 opacity-20" style={{ color: "var(--muted-foreground)" }} />
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>{title}</p>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{message}</p>
    </div>
  );
}
