"use client";

import { useEffect, useState } from "react";
import { Clock, TrendingUp } from "lucide-react";
import type { ReleaseTimingRecommendation } from "@/lib/release-timing";
import { TIME_BLOCK_LABELS, DAY_LABELS_SHORT } from "@/lib/release-timing";

// ─── Confidence pill ──────────────────────────────────────────────────────────

function ConfidencePill({ level, count }: { level: "high" | "medium" | "low"; count: number }) {
  const colors = {
    high:   { bg: "rgba(52,199,89,0.12)",  text: "#34C759" },
    medium: { bg: "rgba(212,168,67,0.12)", text: "#D4A843" },
    low:    { bg: "rgba(255,255,255,0.07)", text: "#888"   },
  };
  const { bg, text } = colors[level];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color: text }}
    >
      {level === "high" ? "High" : level === "medium" ? "Medium" : "Low"} confidence
      {" · "}
      {count.toLocaleString()} interactions
    </span>
  );
}

// ─── Heatmap grid ─────────────────────────────────────────────────────────────

function Heatmap({
  heatmap,
  bestDayLabel,
  bestTimeLabel,
}: {
  heatmap:       number[][];
  bestDayLabel:  string;
  bestTimeLabel: string;
}) {
  // Find peak cell
  let peakDay = 0, peakBlock = 0, peakVal = 0;
  for (let d = 0; d < 7; d++) {
    for (let b = 0; b < 6; b++) {
      if ((heatmap[d]?.[b] ?? 0) > peakVal) {
        peakVal = heatmap[d][b];
        peakDay = d; peakBlock = b;
      }
    }
  }

  // Find which day index matches bestDayLabel
  const fullDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const bestDayIdx = fullDays.findIndex(d => bestDayLabel.startsWith(d.slice(0, 3)));

  // Find which block matches best time (rough mapping)
  const bestHour = parseInt(bestTimeLabel);
  const bestBlockIdx = Math.floor(
    bestTimeLabel.includes("PM") && bestHour !== 12
      ? (bestHour + 12) / 4
      : bestHour / 4
  );

  return (
    <div>
      {/* Row labels + grid */}
      <div className="flex gap-1.5">
        {/* Time block labels */}
        <div className="flex flex-col justify-around" style={{ width: 60, flexShrink: 0 }}>
          {TIME_BLOCK_LABELS.map(label => (
            <p key={label} className="text-[10px] text-right leading-none py-1" style={{ color: "#555" }}>
              {label}
            </p>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1">
          {/* Day column headers */}
          <div className="grid mb-1" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {DAY_LABELS_SHORT.map((day, d) => (
              <p
                key={day}
                className="text-[10px] text-center font-semibold"
                style={{ color: d === (bestDayIdx >= 0 ? bestDayIdx : peakDay) ? "#D4A843" : "#555" }}
              >
                {day}
              </p>
            ))}
          </div>

          {/* Cells: row = time block, col = day */}
          {TIME_BLOCK_LABELS.map((_, b) => (
            <div
              key={b}
              className="grid mb-0.5"
              style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}
            >
              {DAY_LABELS_SHORT.map((_, d) => {
                const score   = heatmap[d]?.[b] ?? 0;
                const isPeak  = d === peakDay && b === peakBlock;
                const opacity = 0.05 + score * 0.85;
                return (
                  <div
                    key={d}
                    className="rounded"
                    style={{
                      height:      16,
                      background:  `rgba(212,168,67,${opacity.toFixed(2)})`,
                      border:      isPeak ? "1px solid rgba(212,168,67,0.9)" : "1px solid transparent",
                      boxShadow:   isPeak ? "0 0 6px rgba(212,168,67,0.4)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReleaseTimingCard() {
  const [data,    setData]    = useState<ReleaseTimingRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/release-timing")
      .then(r => r.json())
      .then(d => setData(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Hide entirely if loading or no data
  if (loading || !data) return null;

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(212,168,67,0.12)" }}
          >
            <Clock size={15} style={{ color: "#D4A843" }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Best Time to Drop
            </p>
          </div>
        </div>
        <ConfidencePill level={data.confidence} count={data.totalInteractions} />
      </div>

      {/* Recommendation */}
      <div className="flex items-end gap-3">
        <div>
          <p
            className="font-display font-bold leading-none"
            style={{ fontSize: 28, color: "#D4A843" }}
          >
            {data.bestDay}
          </p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "#FFFFFF" }}>
            {data.bestTime}
          </p>
        </div>
        <div
          className="flex items-center gap-1 mb-0.5 px-2 py-1 rounded-lg"
          style={{ background: "rgba(52,199,89,0.1)" }}
        >
          <TrendingUp size={11} style={{ color: "#34C759" }} />
          <span className="text-[10px] font-semibold" style={{ color: "#34C759" }}>
            Peak window
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-xs leading-relaxed" style={{ color: "#888" }}>
        {data.reasoning}
      </p>

      {/* Heatmap */}
      <Heatmap
        heatmap={data.heatmap}
        bestDayLabel={data.bestDay}
        bestTimeLabel={data.bestTime}
      />
    </div>
  );
}
