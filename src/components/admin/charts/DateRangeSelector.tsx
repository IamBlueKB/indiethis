"use client";

export type DateRange = "7d" | "30d" | "90d" | "12m";

const RANGES: { label: string; value: DateRange }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "12M", value: "12m" },
];

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
          style={
            value === r.value
              ? { backgroundColor: "#E85D4A", color: "#fff" }
              : { color: "rgba(255,255,255,0.45)" }
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
