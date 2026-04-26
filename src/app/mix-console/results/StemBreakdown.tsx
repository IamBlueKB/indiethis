"use client";

/**
 * StemBreakdown — "WHAT WE DID" per-stem transparency card.
 *
 * Renders one row per processed stem layer that the engine actually touched.
 * Empty roles are filtered upstream in load-mix-data.ts; we never render a
 * row that didn't get processed.
 *
 * Each row:
 *   • 6px role-colored dot (matches the visualizer line palette where
 *     applicable; ad-libs/harmonies/ins-outs/beat get distinct colors so
 *     the artist can map each row to a frequency line at a glance)
 *   • Stem label (12px primary)
 *   • Plain-English processing summary (11px muted, right-aligned)
 *
 * Source-of-truth for the summary text is `load-mix-data.ts → describeStem()`.
 * That function turns Claude's stemParams into human-readable phrases like
 * "2-stage comp, presence +3dB, de-essed" instead of raw ratio/attack/release
 * tuples. This component never inspects the parameters itself.
 */

import type { StemProcessingItem } from "./types";

// Role → display label
const ROLE_LABEL: Record<string, string> = {
  main_vocal: "Main vocal",
  vocal_lead: "Main vocal",
  vocals:     "Main vocal",
  ad_libs:    "Ad-libs",
  doubles:    "Doubles",
  harmonies:  "Harmonies",
  ins_outs:   "Ins & Outs",
  beat:       "Beat",
};

// Role → dot color (per spec)
const ROLE_COLOR: Record<string, string> = {
  main_vocal: "#E8735A", // coral — same as Vocals visualizer line
  vocal_lead: "#E8735A",
  vocals:     "#E8735A",
  ad_libs:    "#D4AF37", // gold
  doubles:    "#7F77DD", // purple
  harmonies:  "#1D9E75", // green
  ins_outs:   "#D4537E", // pink
  beat:       "#378ADD", // blue (only when Beat Polish was used)
};

const FALLBACK_COLOR = "#888";

export interface StemBreakdownProps {
  items: StemProcessingItem[];
}

export function StemBreakdown({ items }: StemBreakdownProps) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Per-stem processing summary"
      className="rounded-xl p-4"
      style={{ backgroundColor: "#1a1816", border: "1px solid #2A2824" }}
    >
      <p
        className="mb-3"
        style={{
          fontSize:      10,
          color:         "#D4AF37",
          letterSpacing: "0.5px",
          fontWeight:    600,
        }}
      >
        WHAT WE DID
      </p>

      <ul className="space-y-2.5">
        {items.map((item, idx) => {
          const label = ROLE_LABEL[item.role] ?? prettifyRoleKey(item.role);
          const color = ROLE_COLOR[item.role] ?? FALLBACK_COLOR;
          return (
            <li
              key={`${item.role}-${idx}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3"
            >
              <span className="flex items-center gap-2 shrink-0">
                <span
                  aria-hidden="true"
                  className="inline-block rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: color, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: "#eee" }}>{label}</span>
              </span>
              <span
                className="text-left sm:text-right"
                style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}
              >
                {item.description}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Last-resort label for unknown role keys: "some_role" → "Some role"
 */
function prettifyRoleKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/^./, c => c.toUpperCase());
}
