"use client";

import { useEffect, useState } from "react";
import { BarChart2, Eye, Play, MousePointerClick, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayEntry   = { date: string; count: number };
type TrackEntry = { trackId: string; title: string; coverArtUrl: string | null; plays: number };
type ClickEntry = { platform: string; clicks: number };

type Analytics = {
  totalViews:      number;
  viewsLast30Days: number;
  viewChart:       DayEntry[];
  topTracks:       TrackEntry[];
  linkClicks:      ClickEntry[];
};

// ─── Platform labels ──────────────────────────────────────────────────────────

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

// ─── Mini bar chart ────────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: DayEntry[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-[2px]" style={{ height: 60 }}>
      {data.map((d) => {
        const height = Math.max((d.count / maxCount) * 60, d.count > 0 ? 3 : 1);
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} view${d.count !== 1 ? "s" : ""}`}
            className="flex-1 rounded-sm transition-all"
            style={{
              height,
              backgroundColor: d.count > 0
                ? "rgba(212,168,67,0.70)"
                : "rgba(255,255,255,0.06)",
              cursor: "default",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent = "rgba(212,168,67,0.10)",
  iconColor = "#D4A843",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
  iconColor?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex items-center gap-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/dashboard/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  const totalClicks = data?.linkClicks.reduce((s, c) => s + c.clicks, 0) ?? 0;
  const totalPlays  = data?.topTracks.reduce((s, t) => s + t.plays, 0) ?? 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
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

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/05 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total page views"
              value={data.totalViews}
              icon={<Eye size={18} />}
            />
            <StatCard
              label="Views (last 30d)"
              value={data.viewsLast30Days}
              icon={<TrendingUp size={18} />}
              accent="rgba(52,199,89,0.10)"
              iconColor="#34C759"
            />
            <StatCard
              label="Track plays"
              value={totalPlays}
              icon={<Play size={18} />}
              accent="rgba(232,93,74,0.10)"
              iconColor="#E85D4A"
            />
            <StatCard
              label="Link clicks"
              value={totalClicks}
              icon={<MousePointerClick size={18} />}
              accent="rgba(90,130,255,0.10)"
              iconColor="#5A82FF"
            />
          </div>

          {/* Daily chart */}
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Page views — last 30 days</h2>
              <span className="text-xs text-muted-foreground">{data.viewsLast30Days} total</span>
            </div>
            <MiniBarChart data={data.viewChart} />
            <div className="flex justify-between text-[10px] text-white/25">
              <span>{data.viewChart[0]?.date?.slice(5) ?? ""}</span>
              <span>Today</span>
            </div>
          </div>

          {/* Top tracks */}
          {data.topTracks.length > 0 && (
            <div
              className="rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <h2 className="text-sm font-semibold text-foreground">Top tracks by plays</h2>
              <div className="space-y-2">
                {data.topTracks.map((t, i) => {
                  const maxPlays = data.topTracks[0]?.plays ?? 1;
                  const pct      = Math.round((t.plays / maxPlays) * 100);
                  return (
                    <div key={t.trackId} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 text-right shrink-0">
                        {i + 1}
                      </span>
                      {t.coverArtUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.coverArtUrl}
                          alt={t.title}
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg shrink-0"
                          style={{ backgroundColor: "rgba(212,168,67,0.08)" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground truncate">{t.title}</span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {t.plays.toLocaleString()} play{t.plays !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: "#D4A843" }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Link clicks by platform */}
          {data.linkClicks.length > 0 && (
            <div
              className="rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <h2 className="text-sm font-semibold text-foreground">Streaming link clicks</h2>
              <div className="space-y-2">
                {data.linkClicks.map((c) => {
                  const maxClicks = data.linkClicks[0]?.clicks ?? 1;
                  const pct       = Math.round((c.clicks / maxClicks) * 100);
                  const color     = PLATFORM_COLORS[c.platform] ?? "#D4A843";
                  return (
                    <div key={c.platform} className="flex items-center gap-3">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {PLATFORM_LABELS[c.platform] ?? c.platform}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.clicks.toLocaleString()} click{c.clicks !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.totalViews === 0 && data.topTracks.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <BarChart2 size={32} className="mx-auto text-white/15" />
              <p className="text-sm text-muted-foreground">No data yet</p>
              <p className="text-xs text-white/25">Analytics will appear once fans visit your artist page.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
