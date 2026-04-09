"use client";

/**
 * FilmLookPicker — 6 tappable film look preset cards in a 2-column grid.
 *
 * Used in the WorkflowBoard scene edit panel. Selection is controlled
 * externally via value/onChange. Each look adds a cinematic grade prompt
 * snippet to the final scene generation prompt.
 */

import { FILM_LOOKS, FILM_LOOK_KEYS, type FilmLookKey } from "./CameraDirectionPicker";

// ─── Visual accent colours per look ──────────────────────────────────────────

const LOOK_ACCENT: Record<FilmLookKey, string> = {
  clean_digital:  "#4D96FF",
  "35mm_film":    "#D4A843",
  "16mm_grain":   "#A0A0A0",
  anamorphic:     "#6BCB77",
  vhs_retro:      "#FF6BCB",
  noir:           "#E8E8E8",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  value:          FilmLookKey;
  onChange:       (v: FilmLookKey) => void;
  onApplyToAll?:  (v: FilmLookKey) => void;
}

export function FilmLookPicker({ value, onChange, onApplyToAll }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {FILM_LOOK_KEYS.map(key => {
          const info     = FILM_LOOKS[key];
          const accent   = LOOK_ACCENT[key];
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className="flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all"
              style={{
                borderColor:     selected ? accent : "#2A2A2A",
                backgroundColor: selected ? `${accent}10` : "#0A0A0A",
              }}
            >
              {/* Colour swatch */}
              <div
                className="w-7 h-7 rounded-lg shrink-0 mt-0.5"
                style={{
                  background:  selected
                    ? `radial-gradient(circle, ${accent}60 0%, ${accent}20 100%)`
                    : "#1A1A1A",
                  border:      `1px solid ${selected ? accent : "#333"}`,
                }}
              />
              <div>
                <p className="text-xs font-semibold leading-none" style={{ color: selected ? accent : "#CCC" }}>
                  {info.label}
                </p>
                <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "#666" }}>
                  {info.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Apply to all scenes button */}
      {onApplyToAll && (
        <button
          type="button"
          onClick={() => onApplyToAll(value)}
          className="w-full py-2 rounded-xl text-xs font-semibold border transition-all"
          style={{ borderColor: "#2A2A2A", color: "#888", backgroundColor: "#0A0A0A" }}
        >
          Apply to All Scenes
        </button>
      )}
    </div>
  );
}

export default FilmLookPicker;

// Re-export types from CameraDirectionPicker so WorkflowBoard can import from one place
export type { FilmLookKey };
export { FILM_LOOKS, FILM_LOOK_KEYS };
