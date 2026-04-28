/**
 * MasterStrip — master bus column on the right of the mixer.
 *
 * Widened to 160px and reorganized so the EQ row's bottom labels no longer
 * collide with the AI Intensity knob below. New layout (top → bottom):
 *
 *   - Header label "MASTER"
 *   - Master frequency visualizer slot
 *   - 5-band EQ knob row  (its own padded section + divider)
 *   - AI Intensity knob   (clearly separated)
 *   - Stereo Width slider
 *   - Master volume fader + level meter
 *   - Footer label
 *
 * Setters take patch-style updates to MasterState so StudioClient owns the
 * state shape; the strip just renders + dispatches.
 */

"use client";

import { VolumeFader } from "./VolumeFader";
import { EffectKnob } from "./EffectKnob";
import type { MasterState } from "./types";

interface MasterStripProps {
  master:        MasterState;
  onChange:      (patch: Partial<MasterState>) => void;
  /** Live master analyser — drives the level meter on the volume fader. */
  analyser?:     AnalyserNode | null;
  /** Top slot — master frequency visualizer. */
  topSlot?:      React.ReactNode;
  /** EQ slot — 5-band knob row. */
  eqSlot?:       React.ReactNode;
}

const GOLD = "#D4A843";

export function MasterStrip({
  master,
  onChange,
  analyser,
  topSlot,
  eqSlot,
}: MasterStripProps) {
  function onWidthChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ stereoWidth: Number(e.target.value) });
  }
  function onWidthDoubleClick() {
    onChange({ stereoWidth: 100 });
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center py-3 px-3 ml-2 mr-3 my-4 gap-3"
      style={{
        width:           160,
        backgroundColor: "#1A1816",
        border:          "1px solid rgba(212,168,67,0.18)",
        borderTopWidth:  3,
        borderTopColor:  GOLD,
        borderRadius:    8,
        boxShadow:       "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 14px rgba(0,0,0,0.45)",
      }}
    >
      {/* Header */}
      <span
        className="text-[10px] uppercase font-bold tracking-[0.18em]"
        style={{ color: GOLD }}
      >
        Master
      </span>

      {/* Master frequency visualizer */}
      <div
        className="w-full"
        style={{
          height: 36,
          backgroundColor: "rgba(0,0,0,0.35)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {topSlot}
      </div>

      {/* 5-band EQ — sectioned + padded so labels don't crowd the AI knob */}
      <div
        className="w-full pt-2 pb-3"
        style={{
          borderTop:    "1px solid rgba(212,168,67,0.10)",
          borderBottom: "1px solid rgba(212,168,67,0.10)",
        }}
      >
        {eqSlot}
      </div>

      {/* AI Intensity — global multiplier on Claude's effect values. */}
      <div className="flex flex-col items-center gap-1 mt-1">
        <EffectKnob
          value={master.aiIntensity}
          onChange={(v) => onChange({ aiIntensity: v })}
          aiOriginal={100}
          color={GOLD}
          label="AI intensity"
          shortLabel="AI"
        />
      </div>

      {/* Stereo Width */}
      <div className="flex flex-col items-center gap-1 w-full">
        <input
          type="range"
          min={0}
          max={150}
          step={1}
          value={master.stereoWidth}
          onChange={onWidthChange}
          onDoubleClick={onWidthDoubleClick}
          aria-label="Stereo width"
          className="w-full appearance-none cursor-pointer"
          style={{
            height:       4,
            background:   `linear-gradient(to right, #2A2824 0%, ${GOLD} ${(master.stereoWidth / 150) * 100}%, #2A2824 ${(master.stereoWidth / 150) * 100}%, #2A2824 100%)`,
            borderRadius: 2,
          }}
        />
        <span className="text-[8px] uppercase tracking-wider" style={{ color: "#999" }}>
          Width {Math.round(master.stereoWidth)}%
        </span>
      </div>

      {/* Master volume fader */}
      <div className="flex flex-col items-center gap-1 mt-1">
        <VolumeFader
          valueDb={master.volumeDb}
          onChangeDb={(db) => onChange({ volumeDb: db })}
          analyser={analyser}
          color={GOLD}
          label="Master volume"
        />
        <span className="text-[8px] uppercase tracking-wider" style={{ color: "#999" }}>
          {master.volumeDb >= 0 ? "+" : ""}{master.volumeDb.toFixed(1)} dB
        </span>
      </div>

      {/* Footer */}
      <span
        className="text-[8px] font-mono uppercase tracking-wider mt-auto"
        style={{ color: "#666" }}
      >
        OUT
      </span>
    </div>
  );
}
