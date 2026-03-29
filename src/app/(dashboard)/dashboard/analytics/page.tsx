"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart2,
  Eye,
  Play,
  UserPlus,
  TrendingUp,
  TrendingDown,
  MousePointerClick,
  MapPin,
  ShoppingBag,
  Users,
  RefreshCw,
} from "lucide-react";
import AudioFeaturesRadar from "@/components/audio/AudioFeaturesRadar";
import SimilarArtists from "@/components/audio/SimilarArtists";
import CollabMatches from "@/components/audio/CollabMatches";
import type { AudioFeatureScores } from "@/lib/audio-features";
import AdminLineChart, { type LineConfig } from "@/components/admin/charts/AdminLineChart";
import AdminBarChart from "@/components/admin/charts/AdminBarChart";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatBlock  = { this: number; last: number; total?: number };
type DayEntry   = { date: string; [key: string]: string | number };
type ClickEntry = { platform: string; clicks: number };
type SourceEntry= { name: string; count: number };
type CityEntry  = { zip: string; count: number };
type MerchEntry = { title: string; sales: number; revenue: number };

type AnalyticsData = {
  stats: {
    views:   StatBlock;
    plays:   StatBlock;
    signups: StatBlock;
    revenue: StatBlock;
  };
  viewChart:       DayEntry[];
  trackPlaysChart: DayEntry[];
  trackLines:      LineConfig[];
  signupChart:     DayEntry[];
  linkClicks:      ClickEntry[];
  signupsBySource: SourceEntry[];
  topCities:       CityEntry[];
  topMerch:        MerchEntry[];
  conversion:      { views30d: number; signups30d: number };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  spotify:    "Spotify",
  apple:      "Apple Music",
  youtube:    "YouTube",
  soundcloud: "SoundCloud",
  tidal:      "Tidal",
  amazon:     "Amazon Music",
  deezer:     "Deezer",
  tiktok:     "TikTok",
  instagram:  "Instagram",
};

const PLATFORM_COLORS: Record<string, string> = {
  spotify:    "#1DB954",
  apple:      "#FA243C",
  youtube:    "#FF0000",
  soundcloud: "#FF5500",
  tidal:      "#00FFFF",
  amazon:     "#FF9900",
  deezer:     "#A238FF",
  tiktok:     "#69C9D0",
  instagram:  "#E1306C",
};

// ─── Reusable sub-components ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
  delta,
}: {
  label:     string;
  value:     string | number;
  sub?:      string;
  icon:      React.ReactNode;
  iconBg:    string;
  iconColor: string;
  delta?:    { this: number; last: number };
}) {
  let deltaEl: React.ReactNode = null;
  if (delta && delta.last > 0) {
    const pct = ((delta.this - delta.last) / delta.last) * 100;
    const up  = pct >= 0;
    deltaEl = (
      <span
        className="text-[11px] font-semibold flex items-center gap-0.5"
        style={{ color: up ? "#34C759" : "#E85D4A" }}
      >
        {up ? <TrendingUp size={10} strokeWidth={2.5} /> : <TrendingDown size={10} strokeWidth={2.5} />}
        {Math.abs(pct).toFixed(0)}%
      </span>
    );
  } else if (delta && delta.last === 0 && delta.this > 0) {
    deltaEl = <span className="text-[11px] font-semibold" style={{ color: "#34C759" }}>New</span>;
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        {deltaEl}
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Horizontal bar row — used for streaming platforms */
function HBarRow({
  label,
  value,
  max,
  color,
  suffix = "",
}: {
  label:   string;
  value:   number;
  max:     number;
  color:   string;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground truncate">{label}</span>
          <span className="text-xs text-muted-foreground ml-2 shrink-0">
            {value.toLocaleString()}{suffix}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

/** Section card wrapper */
function Card({ title, sub, children, className = "" }: {
  title:     string;
  sub?:      string;
  children:  React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 ${className}`}
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [data,      setData]      = useState<AnalyticsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [refreshing,setRefreshing]= useState(false);
  const [soundDNA,  setSoundDNA]  = useState<{ features: AudioFeatureScores | null; count: number } | null>(null);

  useEffect(() => {
    fetch("/api/audio-features/my-average")
      .then(r => r.json())
      .then(d => setSoundDNA(d))
      .catch(() => {});
  }, []);

  function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    fetch("/api/dashboard/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl" style={{ backgroundColor: "rgba(212,168,67,0.10)" }} />
          <div className="h-5 w-32 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border p-5 h-28 animate-pulse"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} />
          ))}
        </div>
        <div className="rounded-2xl border h-64 animate-pulse"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="rounded-xl border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, viewChart, trackPlaysChart, trackLines, signupChart,
          linkClicks, signupsBySource, topCities, topMerch, conversion } = data;

  const maxClicks  = Math.max(...linkClicks.map((c) => c.clicks), 1);
  const convRate   = conversion.views30d > 0
    ? ((conversion.signups30d / conversion.views30d) * 100).toFixed(1)
    : "0.0";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(212,168,67,0.10)" }}
          >
            <BarChart2 size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Analytics</h1>
            <p className="text-xs text-muted-foreground">Artist page performance</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Page views"
          value={stats.views.total ?? stats.views.this}
          sub="all-time"
          icon={<Eye size={17} />}
          iconBg="rgba(212,168,67,0.12)"
          iconColor="#D4A843"
          delta={stats.views}
        />
        <StatCard
          label="Track plays"
          value={stats.plays.this}
          sub="this month"
          icon={<Play size={17} />}
          iconBg="rgba(232,93,74,0.12)"
          iconColor="#E85D4A"
          delta={stats.plays}
        />
        <StatCard
          label="Fan sign-ups"
          value={stats.signups.this}
          sub="this month"
          icon={<UserPlus size={17} />}
          iconBg="rgba(90,200,250,0.12)"
          iconColor="#5AC8FA"
          delta={stats.signups}
        />
        <StatCard
          label="Revenue"
          value={`$${stats.revenue.this.toFixed(2)}`}
          sub="this month"
          icon={<TrendingUp size={17} />}
          iconBg="rgba(52,199,89,0.12)"
          iconColor="#34C759"
          delta={stats.revenue}
        />
      </div>

      {/* ── Page views line chart (full width) ── */}
      <AdminLineChart
        title="Page views"
        data={viewChart}
        lines={[{ key: "views", color: "#D4A843", label: "Views" }]}
        defaultRange="30d"
        showRangeSelector
      />

      {/* ── Track plays + Streaming clicks ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trackLines.length > 0 ? (
          <AdminLineChart
            title="Track plays — top 5 tracks"
            data={trackPlaysChart}
            lines={trackLines}
            defaultRange="30d"
            showRangeSelector
          />
        ) : (
          <Card title="Track plays" sub="Top 5 tracks over time">
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Play size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
              <p className="text-xs text-muted-foreground">No plays yet</p>
            </div>
          </Card>
        )}

        {/* Streaming link clicks */}
        <Card title="Streaming link clicks" sub="Clicks from your artist page">
          {linkClicks.length > 0 ? (
            <div className="space-y-3">
              {linkClicks.map((c) => (
                <HBarRow
                  key={c.platform}
                  label={PLATFORM_LABELS[c.platform] ?? c.platform}
                  value={c.clicks}
                  max={maxClicks}
                  color={PLATFORM_COLORS[c.platform] ?? "#D4A843"}
                  suffix=" clicks"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <MousePointerClick size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
              <p className="text-xs text-muted-foreground">No link clicks yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Fan sign-ups trend + by source ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminLineChart
          title="Fan sign-ups over time"
          data={signupChart}
          lines={[{ key: "signups", color: "#5AC8FA", label: "Sign-ups" }]}
          defaultRange="30d"
          showRangeSelector
        />

        <div className="space-y-4">
          {/* By source bar */}
          {signupsBySource.length > 0 ? (
            <AdminBarChart
              title="Sign-ups by source"
              data={signupsBySource}
              bars={[{ key: "count", color: "#5AC8FA", label: "Sign-ups" }]}
              multiColor
            />
          ) : (
            <Card title="Sign-ups by source" sub="Release notify vs show waitlist">
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Users size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
                <p className="text-xs text-muted-foreground">No sign-ups yet</p>
              </div>
            </Card>
          )}

          {/* Conversion rate */}
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm font-semibold text-foreground mb-3">Conversion rate</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-bold text-foreground font-display leading-none">
                {convRate}%
              </span>
              <span className="text-xs text-muted-foreground mb-1">last 30d</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {conversion.signups30d.toLocaleString()} sign-ups from{" "}
              {conversion.views30d.toLocaleString()} visits
            </p>
            {/* Rate bar */}
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(parseFloat(convRate), 100)}%`,
                  backgroundColor: parseFloat(convRate) >= 5 ? "#34C759" : parseFloat(convRate) >= 1 ? "#D4A843" : "#E85D4A",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground/50">0%</span>
              <span className="text-[10px] text-muted-foreground/50">Target: 5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top cities + Merch performance ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top cities by zip */}
        <Card title="Top locations" sub="Fan sign-ups by zip code">
          {topCities.length > 0 ? (
            <div className="space-y-2">
              {topCities.map((c, i) => {
                const max = topCities[0].count;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={c.zip} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} style={{ color: "#5AC8FA" }} className="shrink-0" />
                          <span className="text-xs font-medium text-foreground">{c.zip}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {c.count} fan{c.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: "rgba(90,200,250,0.5)" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <MapPin size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
              <p className="text-xs text-muted-foreground">No zip code data yet</p>
              <p className="text-[11px] text-muted-foreground/60">Zip codes are captured from your fan sign-up forms</p>
            </div>
          )}
        </Card>

        {/* Merch performance */}
        <Card title="Merch performance" sub="Top products by sales">
          {topMerch.length > 0 ? (
            <div className="space-y-0 divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
              {topMerch.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ backgroundColor: "rgba(232,93,74,0.12)", color: "#E85D4A" }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-[11px] text-muted-foreground">
                      {m.sales} sold
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "#34C759" }}>
                      ${m.revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <ShoppingBag size={28} style={{ color: "rgba(255,255,255,0.12)" }} />
              <p className="text-xs text-muted-foreground">No merch sales yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Sound DNA ── */}
      {soundDNA?.features && soundDNA.count >= 1 && (
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p style={{ fontFamily: "Playfair Display, serif", fontSize: "18px", color: "#FFFFFF", fontWeight: 700 }}>
                Your Sound DNA
              </p>
              <p className="text-xs mt-1" style={{ color: "#666666", fontFamily: "DM Sans, sans-serif" }}>
                Average across {soundDNA.count} analyzed {soundDNA.count === 1 ? "track" : "tracks"}
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <AudioFeaturesRadar
              features={soundDNA.features}
              size="lg"
              animated
            />
          </div>
        </div>
      )}

      {/* ── Artists Like You ── */}
      {session?.user?.id && (
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <SimilarArtists artistId={session.user.id} limit={8} />
        </div>
      )}

      {/* ── Collab Matches ── */}
      {session?.user?.id && (
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <CollabMatches limit={8} />
        </div>
      )}

      {/* ── Empty state (all zeros) ── */}
      {stats.views.total === 0 &&
        stats.plays.this === 0 &&
        stats.signups.this === 0 && (
          <div className="text-center py-10 space-y-2">
            <BarChart2 size={32} className="mx-auto" style={{ color: "rgba(255,255,255,0.10)" }} />
            <p className="text-sm text-muted-foreground">No data yet</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.20)" }}>
              Analytics will appear once fans visit your artist page.
            </p>
          </div>
        )}
    </div>
  );
}
