"use client";

/**
 * VersionSelector — Standard-tier version picker.
 *
 * Three cards (Clean / Polished / Aggressive) in a horizontal row that stack
 * single-column below 480px. Selecting a card flips MixResultsClient's
 * `selectedVersion` state, which re-runs `loadAudioSrc` and points the
 * <audio> element at a fresh signed URL — the visualizer lines morph to
 * the new content automatically via the same lerp that powers A/B.
 *
 * Premium/Pro tier renders inline copy in MixResultsClient instead of this
 * component (one AI-recommended mix; no picker).
 *
 * Accessibility:
 *   role="radiogroup"  on the wrapper
 *   role="radio"       on each card with aria-checked
 *   ←/→ arrow keys cycle selection (skipping the "AI pick" badge focus trap)
 */

import { useRef } from "react";

const GOLD = "#D4AF37";

export type StandardVersionKey = "clean" | "polished" | "aggressive";

interface VersionDef {
  key:   StandardVersionKey;
  label: string;
  desc:  string;
}

const VERSIONS: VersionDef[] = [
  { key: "clean",      label: "Clean",      desc: "Transparent reference" },
  { key: "polished",   label: "Polished",   desc: "Radio-ready"           },
  { key: "aggressive", label: "Aggressive", desc: "Forward, punchy"       },
];

export interface VersionSelectorProps {
  selected:    StandardVersionKey;
  onChange:    (v: StandardVersionKey) => void;
  /** Optional Claude-recommended key — shows the "AI pick" badge on that card. */
  recommended: string | null;
}

export function VersionSelector({ selected, onChange, recommended }: VersionSelectorProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);

  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const idx = VERSIONS.findIndex(v => v.key === selected);
    if (idx === -1) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % VERSIONS.length;
    if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   next = (idx - 1 + VERSIONS.length) % VERSIONS.length;
    if (next !== idx) {
      e.preventDefault();
      onChange(VERSIONS[next].key);
      // Move focus to the newly active card so screen readers announce it
      const btn = groupRef.current?.querySelector<HTMLButtonElement>(
        `[data-version="${VERSIONS[next].key}"]`,
      );
      btn?.focus();
    }
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Mix variation"
      className="grid gap-2 grid-cols-1 sm:grid-cols-3"
    >
      {VERSIONS.map(v => {
        const active   = v.key === selected;
        const isAiPick = recommended != null && recommended.toLowerCase() === v.key;
        return (
          <button
            key={v.key}
            type="button"
            data-version={v.key}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(v.key)}
            onKeyDown={handleKey}
            className="relative rounded-xl px-4 py-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: "#1a1816",
              border: active ? `1px solid ${GOLD}` : "0.5px solid #2A2824",
              boxShadow: active ? "0 0 0 1px rgba(212,175,55,0.25)" : "none",
            }}
          >
            <div className="flex items-center gap-2">
              {/* Selected indicator dot */}
              <span
                aria-hidden="true"
                className="inline-block rounded-full"
                style={{
                  width:           6,
                  height:          6,
                  backgroundColor: active ? GOLD : "transparent",
                  border:          active ? "none" : "1px solid #3A3833",
                  flexShrink:      0,
                }}
              />
              <p
                className="truncate"
                style={{ fontSize: 13, fontWeight: 500, color: active ? GOLD : "#eee" }}
              >
                {v.label}
              </p>
            </div>
            <p
              className="mt-1"
              style={{ fontSize: 11, color: "#777", marginLeft: 14 }}
            >
              {v.desc}
            </p>

            {isAiPick && (
              <span
                aria-label="AI recommendation"
                className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full"
                style={{
                  fontSize:        9,
                  fontWeight:      700,
                  letterSpacing:   "0.5px",
                  color:           GOLD,
                  border:          `1px solid ${GOLD}`,
                  backgroundColor: "rgba(212,175,55,0.06)",
                }}
              >
                AI PICK
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
