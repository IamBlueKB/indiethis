"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Music2, DollarSign, Users, ShoppingBag, Heart, TrendingUp,
  Download, Share2, ChevronDown, Play, Loader2, Star,
  Sparkles, Radio, ArrowLeft, ArrowRight,
} from "lucide-react";
import type { YearInReview } from "@/app/api/year-in-review/[year]/route";

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data, color = "#D4A843" }: { data: { month: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map(({ month, value }) => (
        <div key={month} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height:          `${Math.max((value / max) * 100, value > 0 ? 8 : 2)}%`,
              backgroundColor: value > 0 ? color : "rgba(255,255,255,0.06)",
              opacity:         value > 0 ? 1 : 0.5,
            }}
          />
          <span className="text-[8px] text-muted-foreground/50 hidden sm:block">{month.slice(0, 1)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

const DONUT_COLORS = ["#D4A843", "#34C759", "#AF52DE", "#5AC8FA", "#E85D4A"];

function DonutChart({ data }: { data: { source: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0) return null;

  const radius   = 56;
  const stroke   = 14;
  const cx       = 70;
  const cy       = 70;
  const circum   = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((d, i) => {
    const pct  = d.amount / total;
    const dash = pct * circum;
    const seg  = { ...d, pct, dash, offset, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={140} height={140} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.dash} ${circum - seg.dash}`}
            strokeDashoffset={-seg.offset}
            opacity={0.9}
          />
        ))}
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.source} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <div>
              <p className="text-xs font-semibold text-foreground">{seg.source}</p>
              <p className="text-[11px] text-muted-foreground">${seg.amount.toFixed(2)} · {(seg.pct * 100).toFixed(0)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sound DNA radar ──────────────────────────────────────────────────────────

function SoundRadar({ dna }: { dna: Record<string, number> }) {
  const entries  = Object.entries(dna);
  const n        = entries.length;
  const cx       = 80;
  const cy       = 80;
  const maxR     = 65;

  const angles   = entries.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2);
  const points   = entries.map(([, val], i) => {
    const r = (val / 100) * maxR;
    return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) =>
    entries.map((_, i) => {
      const r = frac * maxR;
      return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) };
    })
  );

  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160} className="shrink-0">
        {/* Grid */}
        {gridLines.map((pts, gi) => (
          <polygon
            key={gi}
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {/* Axes */}
        {entries.map((_, i) => (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(angles[i])}
            y2={cy + maxR * Math.sin(angles[i])}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}
        {/* Data area */}
        <polygon
          points={polyline}
          fill="rgba(212,168,67,0.18)"
          stroke="#D4A843"
          strokeWidth={1.5}
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#D4A843" />
        ))}
        {/* Labels */}
        {entries.map(([key], i) => {
          const labelR = maxR + 14;
          const lx     = cx + labelR * Math.cos(angles[i]);
          const ly     = cy + labelR * Math.sin(angles[i]);
          return (
            <text
              key={key}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill="rgba(255,255,255,0.5)"
            >
              {key}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] text-muted-foreground">{key}</span>
              <span className="text-[11px] font-bold text-foreground">{val}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${val}%`, backgroundColor: "#D4A843" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Count-up number ─────────────────────────────────────────────────────────

function CountUp({ to, prefix = "", suffix = "", duration = 1200 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [current, setCurrent] = useState(0);
  const startRef              = useRef<number | null>(null);

  useEffect(() => {
    if (to === 0) return;
    let raf: number;
    function step(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * to));
      if (progress < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  const display = to >= 1000
    ? `${prefix}${current.toLocaleString()}${suffix}`
    : `${prefix}${current}${suffix}`;

  return <span>{display}</span>;
}

// ─── Card shell ───────────────────────────────────────────────────────────────

function Card({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-3xl border p-8 ${className}`}
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", ...style }}
    >
      {children}
    </div>
  );
}

// ─── Year selector ────────────────────────────────────────────────────────────

function YearNav({ year }: { year: number }) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      {year > 2020 && (
        <Link
          href={`/dashboard/year-in-review/${year - 1}`}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border hover:bg-white/5 transition-colors no-underline"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <ArrowLeft size={14} /> {year - 1}
        </Link>
      )}
      <span
        className="px-3 py-1.5 rounded-xl text-sm font-bold"
        style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
      >
        {year}
      </span>
      {year < currentYear && (
        <Link
          href={`/dashboard/year-in-review/${year + 1}`}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border hover:bg-white/5 transition-colors no-underline"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {year + 1} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

// ─── Share button ─────────────────────────────────────────────────────────────

function ShareBtn({ year, data }: { year: number; data: YearInReview }) {
  const [copying, setCopying] = useState(false);
  const text = `🎶 My ${year} Year in Review on IndieThis:\n${data.totalPlays.toLocaleString()} plays · ${data.totalFansGained} new fans · $${data.totalEarnings.toFixed(0)} earned\n${data.highlightMoment}`;

  async function copy() {
    setCopying(true);
    try { await navigator.clipboard.writeText(text); }
    finally { setTimeout(() => setCopying(false), 2000); }
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border hover:bg-white/5 transition-colors"
      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
    >
      {copying ? <><Download size={12} /> Copied!</> : <><Share2 size={12} /> Share stats</>}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function YearInReviewPage({ year }: { year: number }) {
  const [data,    setData]    = useState<YearInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const scrollRef             = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    fetch(`/api/year-in-review/${year}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d.data ?? null);
      })
      .catch(() => setError("Failed to load year in review."))
      .finally(() => setLoading(false));
  }, [year]);

  // Track scroll position for the scroll-down hint
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      const idx = Math.round((el?.scrollTop ?? 0) / (el?.clientHeight ?? 1));
      setActiveCard(idx);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 size={32} className="mx-auto animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading your {year} in review…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/05 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── No data state ──────────────────────────────────────────────────────────
  if (!data.hasData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{year} Year in Review</h1>
          <YearNav year={year} />
        </div>
        <Card className="text-center py-16 space-y-4">
          <Star size={40} className="mx-auto" style={{ color: "rgba(255,255,255,0.12)" }} />
          <p className="text-lg font-bold text-foreground">No data for {year}</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Get your music out there — plays, fans, and earnings will show up here at the end of the year.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/dashboard/music"
              className="px-4 py-2 rounded-xl text-sm font-semibold no-underline"
              style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
            >
              Upload music
            </Link>
            <Link
              href="/dashboard/site"
              className="px-4 py-2 rounded-xl text-sm font-semibold border no-underline"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Build your artist page
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ── Build card deck ────────────────────────────────────────────────────────
  const cards: React.ReactNode[] = [];

  // Card 0: Hero
  cards.push(
    <Card key="hero" style={{ background: "linear-gradient(135deg, rgba(212,168,67,0.12) 0%, rgba(10,10,10,0) 60%)", borderColor: "rgba(212,168,67,0.25)" }}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} style={{ color: "#D4A843" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4A843" }}>Year in Review</span>
            </div>
            <h2 className="text-4xl font-black text-foreground">{year}</h2>
            <p className="text-base text-muted-foreground mt-1">Your year in music</p>
          </div>
          <ShareBtn year={year} data={data} />
        </div>

        {/* Big stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total plays",    value: data.totalPlays,      icon: Play,        color: "#D4A843", prefix: "",  suffix: "" },
            { label: "New fans",       value: data.totalFansGained, icon: Users,       color: "#34C759", prefix: "",  suffix: "" },
            { label: "Earned",         value: data.totalEarnings,   icon: DollarSign,  color: "#5AC8FA", prefix: "$", suffix: "" },
            { label: "Merch sold",     value: data.totalMerchSold,  icon: ShoppingBag, color: "#AF52DE", prefix: "",  suffix: "" },
          ].map(({ label, value, icon: Icon, color, prefix, suffix }) => (
            <div
              key={label}
              className="rounded-2xl border p-4 space-y-1"
              style={{ backgroundColor: `${color}0d`, borderColor: `${color}22` }}
            >
              <Icon size={14} style={{ color }} />
              <p className="text-2xl font-black" style={{ color }}>
                <CountUp to={value} prefix={prefix} suffix={suffix} />
              </p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Highlight */}
        <div
          className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.18)" }}
        >
          <Star size={16} style={{ color: "#D4A843" }} className="shrink-0" />
          <p className="text-sm font-semibold text-foreground">{data.highlightMoment}</p>
        </div>

        <div className="flex items-center justify-center gap-2 opacity-50">
          <ChevronDown size={16} className="animate-bounce" />
          <span className="text-xs text-muted-foreground">Scroll for more</span>
        </div>
      </div>
    </Card>
  );

  // Card 1: Plays over time
  if (data.totalPlays > 0) {
    const peakMonth = data.monthlyPlayChart.reduce((a, b) => b.value > a.value ? b : a);
    cards.push(
      <Card key="plays">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.10)" }}>
              <Play size={18} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                <CountUp to={data.totalPlays} /> plays
              </h3>
              <p className="text-xs text-muted-foreground">People hit play on your music</p>
            </div>
          </div>
          <MiniBarChart data={data.monthlyPlayChart} color="#D4A843" />
          <p className="text-xs text-muted-foreground">
            Your biggest month: <span className="font-semibold text-foreground">{peakMonth.month}</span> with{" "}
            <span style={{ color: "#D4A843" }}>{peakMonth.value.toLocaleString()} plays</span>
          </p>

          {/* Top tracks */}
          {data.topTracks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Top tracks this year</p>
              {data.topTracks.map((track, i) => (
                <div key={track.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-4 text-center" style={{ color: i === 0 ? "#D4A843" : "var(--muted-foreground)" }}>
                    {i + 1}
                  </span>
                  {track.coverArtUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.coverArtUrl} alt={track.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                      <Music2 size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                    <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:           `${(track.plays / (data.topTracks[0]?.plays || 1)) * 100}%`,
                          backgroundColor: i === 0 ? "#D4A843" : "rgba(212,168,67,0.4)",
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                    {track.plays.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Card 2: Earnings
  if (data.totalEarnings > 0) {
    const peakEarn = data.monthlyEarnChart.reduce((a, b) => b.value > a.value ? b : a);
    cards.push(
      <Card key="earnings">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(90,200,250,0.10)" }}>
              <TrendingUp size={18} style={{ color: "#5AC8FA" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                $<CountUp to={Math.round(data.totalEarnings)} /> earned
              </h3>
              <p className="text-xs text-muted-foreground">Real money from your music and fans</p>
            </div>
          </div>
          <MiniBarChart data={data.monthlyEarnChart} color="#5AC8FA" />
          {peakEarn.value > 0 && (
            <p className="text-xs text-muted-foreground">
              Best month: <span className="font-semibold text-foreground">{peakEarn.month}</span>{" "}
              — <span style={{ color: "#5AC8FA" }}>${peakEarn.value.toFixed(0)}</span>
            </p>
          )}
          {data.earningsBySource.length > 1 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Revenue breakdown</p>
              <DonutChart data={data.earningsBySource} />
            </div>
          )}
          {data.earningsBySource.length === 1 && (
            <div
              className="rounded-2xl border p-4 flex items-center gap-3"
              style={{ backgroundColor: "rgba(90,200,250,0.06)", borderColor: "rgba(90,200,250,0.18)" }}
            >
              <DollarSign size={16} style={{ color: "#5AC8FA" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">${data.totalEarnings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{data.earningsBySource[0].source}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Card 3: Fans + Tips
  if (data.totalFansGained > 0 || data.totalTips > 0) {
    cards.push(
      <Card key="fans">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(52,199,89,0.10)" }}>
              <Users size={18} style={{ color: "#34C759" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Your fans showed up</h3>
              <p className="text-xs text-muted-foreground">People who connected with your music</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div
              className="rounded-2xl border p-4 space-y-1"
              style={{ backgroundColor: "rgba(52,199,89,0.06)", borderColor: "rgba(52,199,89,0.18)" }}
            >
              <Users size={14} style={{ color: "#34C759" }} />
              <p className="text-3xl font-black" style={{ color: "#34C759" }}>
                <CountUp to={data.totalFansGained} />
              </p>
              <p className="text-xs text-muted-foreground">fans gained</p>
            </div>
            <div
              className="rounded-2xl border p-4 space-y-1"
              style={{ backgroundColor: "rgba(175,82,222,0.06)", borderColor: "rgba(175,82,222,0.18)" }}
            >
              <Heart size={14} style={{ color: "#AF52DE" }} />
              <p className="text-3xl font-black" style={{ color: "#AF52DE" }}>
                <CountUp to={data.totalTips} />
              </p>
              <p className="text-xs text-muted-foreground">
                tip{data.totalTips !== 1 ? "s" : ""}
                {data.totalTipAmount > 0 && <> · ${data.totalTipAmount.toFixed(0)}</>}
              </p>
            </div>
          </div>

          {data.totalMerchSold > 0 && (
            <div
              className="rounded-2xl border p-4 flex items-center gap-4"
              style={{ backgroundColor: "rgba(212,168,67,0.06)", borderColor: "rgba(212,168,67,0.18)" }}
            >
              <ShoppingBag size={18} style={{ color: "#D4A843" }} />
              <div>
                <p className="text-2xl font-black" style={{ color: "#D4A843" }}>
                  <CountUp to={data.totalMerchSold} /> items sold
                </p>
                <p className="text-xs text-muted-foreground">merch flying off the shelf</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Card 4: Sound DNA
  if (data.soundDNA && Object.keys(data.soundDNA).length > 0) {
    cards.push(
      <Card key="dna">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.10)" }}>
              <Radio size={18} style={{ color: "#D4A843" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Your Sound DNA</h3>
              <p className="text-xs text-muted-foreground">The audio fingerprint of your music</p>
            </div>
          </div>
          <SoundRadar dna={data.soundDNA} />
          <p className="text-xs text-muted-foreground">
            Based on audio analysis of your tracks. Higher scores mean more of that quality in your sound.
          </p>
        </div>
      </Card>
    );
  }

  // Card 5: Highlight / wrap-up
  cards.push(
    <Card key="outro" style={{ background: "linear-gradient(135deg, rgba(52,199,89,0.08) 0%, rgba(10,10,10,0) 60%)", borderColor: "rgba(52,199,89,0.20)" }}>
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: "rgba(52,199,89,0.12)" }}>
          <Sparkles size={28} style={{ color: "#34C759" }} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-foreground">
            {data.monthsWithData >= 10 ? "Consistent all year." : data.monthsWithData >= 6 ? "A solid year." : "You showed up."}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {data.highlightMoment}
          </p>
        </div>
        <div
          className="rounded-2xl border p-4 text-left"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-black text-foreground">{data.monthsWithData}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">active months</p>
            </div>
            <div>
              <p className="text-xl font-black" style={{ color: "#D4A843" }}>{data.totalPlays.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">plays</p>
            </div>
            <div>
              <p className="text-xl font-black" style={{ color: "#34C759" }}>{data.totalFansGained}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">fans</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <ShareBtn year={year} data={data} />
          <Link
            href="/dashboard/music"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold no-underline"
            style={{ backgroundColor: "var(--accent)", color: "#0A0A0A" }}
          >
            <Music2 size={12} /> Upload new music
          </Link>
        </div>
      </div>
    </Card>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-12 space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{year} Year in Review</h1>
        <YearNav year={year} />
      </div>

      {/* Scroll-snap card deck */}
      <div
        ref={scrollRef}
        className="space-y-5"
      >
        {cards}
      </div>

      {/* Dot indicators */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {cards.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width:           i === activeCard ? 16 : 6,
                height:          6,
                backgroundColor: i === activeCard ? "#D4A843" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
