/**
 * ChannelStrip — column OR horizontal lane of controls for a single stem.
 *
 * Two layouts share this component:
 *
 *   layout="vertical" (default, legacy):
 *     Top → bottom column. Width 96px. Used by anything still on the
 *     classic studio surface — kept untouched so we don't break existing
 *     screens.
 *
 *   layout="horizontal" (new — Pro Studio Mixer Visual Restructure spec):
 *     One full-width lane. Left to right:
 *       [color tab][label + meta][M/S][Pan][AI assist] | [horizontal fader] | [waveform]
 *     With Advanced view ON, a sub-row reveals below the lane carrying
 *     the four effect knobs + dry/wet slider.
 *
 * All audio props/handlers are identical between layouts. The choice is
 * pure presentation.
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
  /** AI's original gain in dB — renders as a gold tick on the fader track. */
  gainAiOriginal?: number;

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
  topSlot?:       React.ReactNode;   // mini visualizer (vertical layout) — unused in horizontal
  effectsSlot?:   React.ReactNode;   // 2x2 knobs row in vertical, horizontal row in horizontal lane
  dryWetSlot?:    React.ReactNode;   // dry/wet slider
  linkBadge?:     React.ReactNode;   // chain icon + group name
  /** Horizontal layout only — DAW-style waveform that fills the right side. */
  waveformSlot?:  React.ReactNode;

  /** Show the advanced slots (effects, dry/wet). Simple view hides them. */
  advanced?:      boolean;

  /** Layout. Defaults to vertical for backward compatibility. */
  layout?:        "vertical" | "horizontal";

  /** Horizontal layout — total lane height in px (default 72). */
  height?:        number;

  /** Horizontal layout — heavily faded (some other stem soloed). */
  faded?:         boolean;
}

export function ChannelStrip(props: ChannelStripProps) {
  const layout = props.layout ?? "vertical";
  if (layout === "horizontal") return <HorizontalLane {...props} />;
  return <VerticalStrip {...props} />;
}

/* ─────────────────────────────────────────────────────────────────────────
   HORIZONTAL LANE — Pro Studio Mixer Visual Restructure
   ───────────────────────────────────────────────────────────────────────── */

function HorizontalLane({
  role,
  gainDb,
  onGainDbChange,
  analyser,
  gainAiOriginal,
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
  effectsSlot,
  dryWetSlot,
  linkBadge,
  waveformSlot,
  advanced = false,
  height = 72,
  faded = false,
}: ChannelStripProps) {
  const color = colorForRole(role);
  const label = labelForRole(role);

  // Lane background dims when muted; sub-row gets its own slightly darker tint.
  const laneBg     = muted ? "#100E0C" : "#13110f";
  const laneOpacity = muted ? 0.55 : faded ? 0.55 : 1;

  return (
    <div
      className="w-full transition-all"
      style={{
        opacity: laneOpacity,
        transition: "opacity 200ms ease",
      }}
    >
      {/* ─── Main lane row ───────────────────────────────────────────── */}
      <div
        className="flex items-stretch"
        style={{
          height,
          backgroundColor: laneBg,
          borderTop:    "0.5px solid #2A2824",
          borderBottom: "0.5px solid #1f1d1a",
          // Soloed lanes get a 1px stem-color accent on the inner left edge
          // (inset boxShadow so layout doesn't shift on toggle).
          boxShadow: soloed
            ? `inset 1px 0 0 ${color}, inset 0 1px 0 rgba(255,255,255,0.015), inset 0 -1px 0 rgba(0,0,0,0.25)`
            : "inset 0 1px 0 rgba(255,255,255,0.015), inset 0 -1px 0 rgba(0,0,0,0.25)",
          transition: "box-shadow 180ms ease",
        }}
      >
        {/* Color tab — the only saturated stem-color element on the control side */}
        <div
          aria-hidden
          style={{ width: 3, backgroundColor: color, opacity: muted ? 0.25 : 0.85 }}
        />

        {/* CONTROL AREA (~230px) */}
        <div
          className="flex items-center gap-2 pl-3 pr-2 shrink-0"
          style={{ width: 230 }}
        >
          {/* Label + edited dot */}
          <div className="flex flex-col justify-center min-w-0" style={{ width: 96 }}>
            <span
              className="text-[11px] font-semibold leading-tight truncate"
              style={{ color: muted ? `${color}88` : color, letterSpacing: "0.01em" }}
              title={label}
            >
              {label}
            </span>
            <div className="flex items-center gap-1 mt-0.5" title={modified ? "You've adjusted Claude's mix" : "Showing Claude's original mix"}>
              <span
                className="inline-block rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  backgroundColor: modified ? "#3A3733" : "#D4A843",
                  boxShadow: modified ? "none" : "0 0 5px rgba(212,168,67,0.65)",
                  transition: "background-color 200ms, box-shadow 200ms",
                }}
              />
              <span
                className="text-[8px] font-mono uppercase tracking-wider leading-none"
                style={{ color: modified ? "#5A5650" : "#D4A843" }}
              >
                {modified ? "Edited" : "Claude"}
              </span>
              {linkBadge && <span className="ml-1">{linkBadge}</span>}
            </div>
          </div>

          {/* Mute / Solo — stacked vertically to keep width tight */}
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={onMuteToggle}
              aria-pressed={muted}
              aria-label={`${label} mute`}
              className="rounded text-[9px] font-bold transition-colors"
              style={{
                width: 22,
                height: 18,
                backgroundColor: muted ? "#E8554A" : "#1A1816",
                color:           muted ? "#0A0A0A" : "#666",
                border:          `1px solid ${muted ? "#E8554A" : "#2A2824"}`,
              }}
            >
              M
            </button>
            <button
              type="button"
              onClick={onSoloToggle}
              aria-pressed={soloed}
              aria-label={`${label} solo`}
              className="rounded text-[9px] font-bold transition-colors"
              style={{
                width: 22,
                height: 18,
                backgroundColor: soloed ? "#D4A843" : "#1A1816",
                color:           soloed ? "#0A0A0A" : "#666",
                border:          `1px solid ${soloed ? "#D4A843" : "#2A2824"}`,
              }}
            >
              S
            </button>
          </div>

          {/* Pan knob — compact */}
          <div className="shrink-0">
            <PanKnob
              value={pan}
              onChange={onPanChange}
              aiOriginal={panAiOriginal}
              color={color}
              label={`${label} pan`}
            />
          </div>

          {/* AI Assist + Export — stacked vertically next to the pan */}
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={onAiAssist}
              disabled={!onAiAssist || aiAssistBusy}
              aria-label={`AI assist ${label}`}
              className="rounded-full flex items-center justify-center transition-all"
              style={{
                width:  20,
                height: 20,
                backgroundColor: aiAssistBusy ? "#E8735A" : "transparent",
                border:          `1px solid ${aiAssistBusy ? "#E8735A" : "#2A2824"}`,
                opacity:         onAiAssist ? 1 : 0.3,
                cursor:          onAiAssist ? "pointer" : "default",
              }}
              title="AI Assist"
            >
              <Sparkles
                size={10}
                style={{
                  color: aiAssistBusy ? "#0A0A0A" : color,
                  animation: aiAssistBusy
                    ? "pulse 1s ease-in-out infinite"
                    : onAiAssist ? "pulse 3s ease-in-out infinite" : undefined,
                }}
              />
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={!onExport || exportBusy}
              aria-label={`Export ${label} as WAV`}
              title={exportBusy ? "Rendering…" : `Download ${label} as WAV`}
              className="rounded-full flex items-center justify-center transition-all"
              style={{
                width:  20,
                height: 20,
                backgroundColor: exportBusy ? "#D4A843" : "transparent",
                border:          `1px solid ${exportBusy ? "#D4A843" : "#2A2824"}`,
                opacity:         onExport ? 1 : 0.3,
                cursor:          onExport ? "pointer" : "default",
              }}
            >
              <Download
                size={9}
                style={{
                  color: exportBusy ? "#0A0A0A" : "#888",
                  animation: exportBusy ? "pulse 0.9s ease-in-out infinite" : undefined,
                }}
              />
            </button>
          </div>
        </div>

        {/* FADER AREA (180px) */}
        <div
          className="shrink-0 flex items-center px-3"
          style={{
            width: 180,
            borderLeft:  "1px solid #1a1816",
            borderRight: "1px solid #1a1816",
            backgroundColor: "rgba(0,0,0,0.18)",
          }}
        >
          <div className="w-full">
            <VolumeFader
              valueDb={gainDb}
              onChangeDb={onGainDbChange}
              analyser={analyser}
              aiOriginalDb={gainAiOriginal}
              color={color}
              label={`${label} volume`}
              orientation="horizontal"
              height={Math.max(28, Math.min(44, height - 30))}
            />
          </div>
        </div>

        {/* WAVEFORM AREA (fills the rest) */}
        <div
          className="flex-1 relative"
          style={{
            backgroundColor: "rgba(0,0,0,0.32)",
            overflow: "hidden",
          }}
        >
          {waveformSlot}
        </div>
      </div>

      {/* ─── Advanced sub-row (effects + dry/wet) ────────────────────── */}
      <div
        style={{
          maxHeight: advanced ? 50 : 0,
          opacity:   advanced ? 1 : 0,
          overflow:  "hidden",
          transition: "max-height 200ms ease, opacity 200ms ease",
          backgroundColor: "#0f0d0b",
          borderBottom: advanced ? "0.5px solid #1f1d1a" : "none",
        }}
      >
        <div className="flex items-stretch" style={{ minHeight: 50 }}>
          {/* Color tab continuation */}
          <div aria-hidden style={{ width: 3, backgroundColor: color, opacity: 0.45 }} />
          {/* Effects column — under the control area */}
          <div className="flex items-center gap-1 pl-3 pr-2 shrink-0" style={{ width: 210 }}>
            {effectsSlot}
          </div>
          {/* Dry/Wet — under the fader */}
          <div className="shrink-0 flex items-center px-3" style={{ width: 180 }}>
            <div className="w-full">{dryWetSlot}</div>
          </div>
          {/* Empty under the waveform — kept clean intentionally */}
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   VERTICAL STRIP — original behavior, untouched
   ───────────────────────────────────────────────────────────────────────── */

function VerticalStrip({
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
      {linkBadge && (
        <div className="w-full flex justify-center">
          {linkBadge}
        </div>
      )}

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

      {advanced && effectsSlot && (
        <div className="w-full">{effectsSlot}</div>
      )}

      {advanced && dryWetSlot && (
        <div className="w-full">{dryWetSlot}</div>
      )}

      <VolumeFader
        valueDb={gainDb}
        onChangeDb={onGainDbChange}
        analyser={analyser}
        color={color}
        label={`${label} volume`}
      />

      <PanKnob
        value={pan}
        onChange={onPanChange}
        aiOriginal={panAiOriginal}
        color={color}
        label={`${label} pan`}
      />

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
