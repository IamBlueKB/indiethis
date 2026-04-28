/**
 * MixNotesPanel — collapsible AI decision summary that lives in the master
 * strip's previously-empty space below the volume fader.
 *
 * The summary is built client-side from the data we already have:
 *   - aiOriginals[role]: { gainDb, pan, reverb, delay, comp, brightness }
 *   - reverbTypes[role]: "plate" | "room" | "hall" | "cathedral" | "dry"
 *
 * Each stem gets one short plain-English line (~6–10 words) describing the
 * notable choices Claude made. Boring/neutral defaults are skipped so the
 * artist sees only the decisions that actually shaped the mix.
 *
 * Default state: collapsed. Two lines visible when expanded; the rest
 * scrolls. The header row stays sticky so the toggle is always reachable.
 */

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { colorForRole, labelForRole } from "./stem-colors";
import type { AiOriginal, ReverbType, StemRole } from "./types";

const GOLD = "#D4A843";

interface MixNotesPanelProps {
  roles:        StemRole[];
  aiOriginals?: Record<StemRole, AiOriginal>;
  reverbTypes?: Record<StemRole, ReverbType>;
  /** When true, opening the panel removes the maxHeight cap and inner scroll —
   *  the box expands to show every note and the master strip grows with it.
   *  Still defaults to closed; user clicks the arrow to open. */
  fillHeight?:  boolean;
}

// ─── Plain-English description per stem ─────────────────────────────────────
function formatStemNote(
  role:        StemRole,
  ai?:         AiOriginal,
  reverbType?: ReverbType,
): string | null {
  if (!ai) return null;

  const parts: string[] = [];

  // Gain — only mention if non-trivial deviation from baseline (assume baseline 0).
  if (typeof ai.gainDb === "number") {
    if (ai.gainDb >= 1.5)        parts.push(`pushed +${ai.gainDb.toFixed(1)} dB`);
    else if (ai.gainDb <= -1.5)  parts.push(`tucked ${ai.gainDb.toFixed(1)} dB`);
  }

  // Pan — only if off-center.
  if (typeof ai.pan === "number") {
    const p = Math.round(ai.pan * 100);
    if      (p <= -15) parts.push(`panned L${Math.abs(p)}`);
    else if (p >=  15) parts.push(`panned R${p}`);
  }

  // Reverb — type + amount.
  if (reverbType && reverbType !== "dry" && typeof ai.reverb === "number" && ai.reverb >= 10) {
    const amount = ai.reverb >= 60 ? "wet" : ai.reverb >= 30 ? "medium" : "light";
    parts.push(`${amount} ${reverbType}`);
  } else if (reverbType === "dry") {
    parts.push("kept dry");
  }

  // Delay throws.
  if (typeof ai.delay === "number" && ai.delay >= 20) {
    parts.push(ai.delay >= 50 ? "delay throws" : "subtle delay");
  }

  // Compression character.
  if (typeof ai.comp === "number") {
    if      (ai.comp >= 70) parts.push("heavy comp");
    else if (ai.comp >= 45) parts.push("glue comp");
  }

  // Brightness / EQ tilt.
  if (typeof ai.brightness === "number") {
    if      (ai.brightness >= 65) parts.push("brightened");
    else if (ai.brightness <= 35) parts.push("warmed");
  }

  if (parts.length === 0) return "left close to neutral";
  return parts.join(" · ");
}

export function MixNotesPanel({ roles, aiOriginals, reverbTypes, fillHeight = false }: MixNotesPanelProps) {
  const [open, setOpen] = useState(false);

  // Build note rows. Skip stems with no AI data at all.
  const rows = roles
    .map((role) => {
      const note = formatStemNote(role, aiOriginals?.[role], reverbTypes?.[role]);
      if (!note) return null;
      return { role, note };
    })
    .filter((r): r is { role: StemRole; note: string } => r !== null);

  if (rows.length === 0) return null;

  return (
    <div
      className="w-full"
      style={{
        borderTop:    "1px solid rgba(212,168,67,0.10)",
        borderRadius: 4,
      }}
    >
      {/* Header — toggles open/close */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-1.5 transition-colors"
        style={{
          color: open ? GOLD : "#8A857C",
        }}
        aria-expanded={open}
        title={open ? "Hide AI mix notes" : "Show AI mix notes"}
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
          Mix Notes
        </span>
        <ChevronDown
          size={11}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      {/* Body — collapsible. In fillHeight mode, opening removes the height
          cap and inner scroll so every note is visible at once. */}
      <div
        style={{
          maxHeight:  open ? (fillHeight ? 9999 : 84) : 0,
          opacity:    open ? 1 : 0,
          overflow:   "hidden",
          transition: "max-height 220ms ease, opacity 220ms ease",
        }}
      >
        <div
          className={fillHeight ? "" : "overflow-y-auto"}
          style={{
            maxHeight:  fillHeight ? undefined : 84,
            paddingRight: 2,
            scrollbarWidth: "thin",
          }}
        >
          {rows.map(({ role, note }) => (
            <div
              key={role}
              className="flex items-start gap-1 py-1"
              style={{ borderTop: "0.5px dashed rgba(212,168,67,0.06)" }}
            >
              <span
                aria-hidden
                className="shrink-0"
                style={{
                  width: 3,
                  height: 12,
                  marginTop: 1,
                  backgroundColor: colorForRole(role),
                  borderRadius: 1,
                  opacity: 0.85,
                }}
              />
              <div className="min-w-0 flex flex-col leading-tight">
                <span
                  className="text-[8px] font-semibold uppercase tracking-wider truncate"
                  style={{ color: colorForRole(role) }}
                >
                  {labelForRole(role)}
                </span>
                <span
                  className="text-[9px] leading-snug"
                  style={{ color: "#B8B2A8" }}
                >
                  {note}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
