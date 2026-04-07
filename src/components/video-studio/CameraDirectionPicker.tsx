"use client";

/**
 * CameraDirectionPicker — 8 tappable camera movement cards.
 *
 * Used in the WorkflowBoard scene edit panel and any other scene editor.
 * Selection is controlled externally via value/onChange.
 *
 * Each option maps to a camera prompt snippet appended to the scene description.
 */

import { Frame, MoveHorizontal, ZoomIn, ZoomOut, Footprints, Radio, Circle, Aperture } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CameraDirectionKey =
  | "static_wide"
  | "slow_pan"
  | "push_in"
  | "pull_back"
  | "tracking"
  | "aerial"
  | "close_up"
  | "orbit";

export interface CameraDirectionInfo {
  label:       string;
  description: string;
  icon:        React.ElementType;
  prompt:      string; // appended to scene prompt during generation
}

// ─── Camera direction definitions ─────────────────────────────────────────────

export const CAMERA_DIRECTION_MAP: Record<CameraDirectionKey, CameraDirectionInfo> = {
  static_wide: {
    label:       "Static Wide",
    description: "Locked camera, full scene visible",
    icon:        Frame,
    prompt:      "static wide shot, locked camera, full scene visible, cinematic composition",
  },
  slow_pan: {
    label:       "Slow Pan",
    description: "Camera sweeps across the scene",
    icon:        MoveHorizontal,
    prompt:      "slow cinematic pan, horizontal camera sweep left to right",
  },
  push_in: {
    label:       "Push In",
    description: "Camera moves toward the subject",
    icon:        ZoomIn,
    prompt:      "slow dolly push in toward subject, increasing intimacy and tension",
  },
  pull_back: {
    label:       "Pull Back",
    description: "Pulls away to reveal the scene",
    icon:        ZoomOut,
    prompt:      "camera pulls back to reveal the full scene, wide establishing shot",
  },
  tracking: {
    label:       "Tracking Shot",
    description: "Follows the subject's movement",
    icon:        Footprints,
    prompt:      "tracking shot following the subject's movement, smooth steadicam",
  },
  aerial: {
    label:       "Aerial",
    description: "Bird's eye view, sweeping overhead",
    icon:        Radio,
    prompt:      "aerial drone shot, bird's eye view, descending or sweeping overhead",
  },
  close_up: {
    label:       "Close-Up",
    description: "Tight on face or details",
    icon:        Aperture,
    prompt:      "extreme close-up, tight on face or details, shallow depth of field",
  },
  orbit: {
    label:       "Orbit",
    description: "Camera circles the subject",
    icon:        Circle,
    prompt:      "orbiting camera, circling around the subject, smooth 360 arc movement",
  },
};

export const CAMERA_DIRECTION_KEYS = Object.keys(CAMERA_DIRECTION_MAP) as CameraDirectionKey[];

// ─── Auto-detect camera direction from a description string ──────────────────

export function detectCameraDirection(description: string): CameraDirectionKey {
  const d = description.toLowerCase();
  if (/aerial|drone|bird.?s.?eye|overhead|from above|sweeping overhead/.test(d)) return "aerial";
  if (/orbit|circle|360|revolve|rotate around|circling/.test(d)) return "orbit";
  if (/close.?up|extreme close|tight on|macro|shallow depth/.test(d)) return "close_up";
  if (/tracking|follow|steadicam|moving with|follows the subject/.test(d)) return "tracking";
  if (/pull.?back|pull away|reveal|wide.?reveal|zoom out/.test(d)) return "pull_back";
  if (/push.?in|dolly.?in|zoom in|move toward|approach/.test(d)) return "push_in";
  if (/pan|sweep|horizontal|left.?to.?right|right.?to.?left/.test(d)) return "slow_pan";
  return "static_wide";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  value:    CameraDirectionKey;
  onChange: (v: CameraDirectionKey) => void;
}

export function CameraDirectionPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CAMERA_DIRECTION_KEYS.map(key => {
        const info     = CAMERA_DIRECTION_MAP[key];
        const Icon     = info.icon;
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all"
            style={{
              borderColor:     selected ? "#D4A843" : "#2A2A2A",
              backgroundColor: selected ? "rgba(212,168,67,0.06)" : "#0A0A0A",
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: selected ? "rgba(212,168,67,0.15)" : "#1A1A1A" }}
            >
              <Icon size={13} style={{ color: selected ? "#D4A843" : "#666" }} />
            </div>
            <div>
              <p className="text-xs font-semibold leading-none" style={{ color: selected ? "#D4A843" : "#CCC" }}>
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
  );
}

export default CameraDirectionPicker;
