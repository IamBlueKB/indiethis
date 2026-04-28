/**
 * ChannelStrip — vertical column of controls for a single stem.
 *
 * Spec layout (top → bottom):
 *   - Mini frequency visualizer  (slot — wired in step 14)
 *   - 2x2 effect knobs            (slot — wired in steps 7–11)
 *   - Dry/wet slider              (slot — wired in step 19)
 *   - Volume fader + level meter
 *   - Pan knob
 *   - Mute / Solo buttons
 *   - AI Assist sparkle           (step 20 wires the action)
 *   - Stem label + AI indicator
 *
 * Step 4 scope: render the strip with the controls that exist today
 * (fader, pan, mute/solo, label, AI Assist placeholder). Slots for
 * future controls are passed in via `topSlot` and `effectsSlot` so
 * later steps don't have to restructure the layout.
 *
 * Width: 80px (desktop). Color-coded border + label per stem role.
 */

"use client";

import { Sparkles, Download } from "lucide-react";
import { VolumeFader }   from "./VolumeFader";
import { PanKnob }       from "./PanKnob";
import { colorForRole, labelForRole } from "./stem-colors";
import type { StemRole } from "./types";

interface ChannelStripProps {
  role:           StemRole;

  // Volume
  gainDb:         number;
  onGainDbChange: (db: number) => void;
  analyser?:      AnalyserNode | null;

  // Pan
  pan:            number;
  onPanChange:    (pan: number) => void;
  panAiOriginal?: number;

  // Mute / solo
  muted:          boolean;
  soloed:         boolean;
  onMuteToggle:   () => void;
  onSoloToggle:   () => void;

  // AI Assist (step 20 wires the click handler)
  onAiAssist?:    () => void;
  aiAssistBusy?:  boolean;

  // Stem export (step 24)
  onExport?:      () => void;
  exportBusy?:    boolean;

  // True if any control on this stem differs from the AI's original.
  modified?:      boolean;

  // Slots for advanced-view controls (filled in later steps).
  topSlot?:       React.ReactNode;   // mini visualizer (step 14)
  effectsSlot?:   React.ReactNode;   // 2x2 knobs (steps 7–11)
  dryWetSlot?:    React.ReactNode;   // dry/wet slider (step 19)
  linkBadge?:     React.ReactNode;   // chain icon + group name (step 23)

  /** Show the advanced slots (effects, dry/wet, visualizer). Simple view hides them. */
  advanced?:      boolean;
}

export function ChannelStrip({
  role,
  gainDb,
  onGainDbChange,
  analyser,
  pan,
  onPanChange,
  panAiOriginal = 0,
  muted,
  soloed,
  onMuteToggle,
  onSoloToggle,
  onAiAssist,
  aiAssistBusy = false,
  onExport,
  exportBusy = false,
  modified = false,
  topSlot,
  effectsSlot,
  dryWetSlot,
  linkBadge,
  advanced = false,
}: ChannelStripProps) {
  const color = colorForRole(role);
  const label = labelForRole(role);

  return (
    <div
      className="flex flex-col items-center py-2 px-1 gap-2 shrink-0"
      style={{
        width:           96,
        backgroundColor: "#1A1816",
        border:          "1px solid rgba(212,168,67,0.08)",
        borderTopWidth:  3,
        borderTopColor:  color,
        borderRadius:    8,
        boxShadow:       "inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      {/* Link badge (step 23) — chain icon when this stem is in a linked group */}
      {linkBadge && (
        <div className="w-full flex justify-center">
          {linkBadge}
        </div>
      )}

      {/* Top — per-stem waveform with playhead (was mini spectrum). */}
      {advanced && (
        <div
          className="w-full"
          style={{
            height: 44,
            backgroundColor: "rgba(0,0,0,0.35)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {topSlot}
        </div>
      )}

      {/* Effect knobs 2x2 (steps 7–11) */}
      {advanced && effectsSlot && (
        <div className="w-full">
          {effectsSlot}
        </div>
      )}

      {/* Dry/wet slider (step 19) */}
      {advanced && dryWetSlot && (
        <div className="w-full">
          {dryWetSlot}
        </div>
      )}

      {/* Volume fader (with level meter if analyser available) */}
      <VolumeFader
        valueDb={gainDb}
        onChangeDb={onGainDbChange}
        analyser={analyser}
        color={color}
        label={`${label} volume`}
      />

      {/* Pan knob */}
      <PanKnob
        value={pan}
        onChange={onPanChange}
        aiOriginal={panAiOriginal}
        color={color}
        label={`${label} pan`}
      />

      {/* Mute / Solo */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMuteToggle}
          aria-pressed={muted}
          aria-label={`${label} mute`}
          className="w-6 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            backgroundColor: muted ? "#E8554A" : "#1A1A1A",
            color:           muted ? "#0A0A0A" : "#666",
            border:          `1px solid ${muted ? "#E8554A" : "#2A2A2A"}`,
          }}
        >
          M
        </button>
        <button
          type="button"
          onClick={onSoloToggle}
          aria-pressed={soloed}
          aria-label={`${label} solo`}
          className="w-6 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            backgroundColor: soloed ? "#D4A843" : "#1A1A1A",
            color:           soloed ? "#0A0A0A" : "#666",
            border:          `1px solid ${soloed ? "#D4A843" : "#2A2A2A"}`,
          }}
        >
          S
        </button>
      </div>

      {/* AI Assist sparkle + Export download — side by side */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onAiAssist}
          disabled={!onAiAssist || aiAssistBusy}
          aria-label={`AI assist ${label}`}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{
            backgroundColor: aiAssistBusy ? "#E8735A" : "transparent",
            border:          `1px solid ${aiAssistBusy ? "#E8735A" : "#2A2824"}`,
            opacity:         onAiAssist ? 1 : 0.3,
            cursor:          onAiAssist ? "pointer" : "default",
          }}
        >
          <Sparkles
            size={12}
            style={{
              color: aiAssistBusy ? "#0A0A0A" : color,
              animation: aiAssistBusy ? "pulse 1s ease-in-out infinite" : undefined,
            }}
          />
        </button>

        {/* Export — download this stem as a 16-bit WAV with current settings */}
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport || exportBusy}
          aria-label={`Export ${label} as WAV`}
          title={exportBusy ? "Rendering…" : `Download ${label} as WAV`}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{
            backgroundColor: exportBusy ? "#D4A843" : "transparent",
            border:          `1px solid ${exportBusy ? "#D4A843" : "#2A2824"}`,
            opacity:         onExport ? 1 : 0.3,
            cursor:          onExport ? "pointer" : "default",
          }}
        >
          <Download
            size={11}
            style={{
              color: exportBusy ? "#0A0A0A" : "#888",
              animation: exportBusy ? "pulse 0.9s ease-in-out infinite" : undefined,
            }}
          />
        </button>
      </div>

      {/* Stem label + Claude's-mix indicator.
          When all controls match Claude's original mix the gold dot glows;
          once the artist changes anything it dims to a subtle gray so the
          state of the strip is readable at a glance. */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[11px] font-semibold leading-none text-center"
          style={{ color, maxWidth: 84 }}
        >
          {label}
        </span>
        <div
          className="flex items-center gap-1"
          title={modified
            ? "You've adjusted Claude's mix on this stem"
            : "Showing Claude's original mix"}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width:           6,
              height:          6,
              backgroundColor: modified ? "#3A3733" : "#D4A843",
              boxShadow:       modified
                ? "none"
                : "0 0 6px rgba(212,168,67,0.65)",
              transition:      "background-color 200ms, box-shadow 200ms",
            }}
          />
          <span
            className="text-[8px] font-mono uppercase tracking-wider leading-none"
            style={{
              color:      modified ? "#5A5650" : "#D4A843",
              transition: "color 200ms",
            }}
          >
            {modified ? "Edited" : "Claude"}
          </span>
        </div>
      </div>
    </div>
  );
}
