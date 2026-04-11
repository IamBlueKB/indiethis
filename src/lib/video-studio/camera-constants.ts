/**
 * Camera direction and film look constants shared between server routes and client components.
 * No React imports — safe to use in API routes.
 */

// ─── Camera directions ────────────────────────────────────────────────────────

export type CameraDirectionKey =
  | "static_wide"
  | "slow_pan"
  | "push_in"
  | "pull_back"
  | "tracking"
  | "aerial"
  | "close_up"
  | "orbit";

export interface CameraDirectionData {
  label:       string;
  description: string;
  prompt:      string;
}

export const CAMERA_DIRECTION_DATA: Record<CameraDirectionKey, CameraDirectionData> = {
  static_wide: {
    label:       "Static Wide",
    description: "Locked camera, full scene visible",
    prompt:      "static wide shot, locked camera, full scene visible, cinematic composition",
  },
  slow_pan: {
    label:       "Slow Pan",
    description: "Camera sweeps across the scene",
    prompt:      "slow cinematic pan, horizontal camera sweep left to right",
  },
  push_in: {
    label:       "Push In",
    description: "Camera moves toward the subject",
    prompt:      "slow dolly push in toward subject, increasing intimacy and tension",
  },
  pull_back: {
    label:       "Pull Back",
    description: "Pulls away to reveal the scene",
    prompt:      "camera pulls back to reveal the full scene, wide establishing shot",
  },
  tracking: {
    label:       "Tracking Shot",
    description: "Follows the subject's movement",
    prompt:      "tracking shot following the subject's movement, smooth steadicam",
  },
  aerial: {
    label:       "Aerial",
    description: "Bird's eye view, sweeping overhead",
    prompt:      "aerial drone shot, bird's eye view, descending or sweeping overhead",
  },
  close_up: {
    label:       "Close-Up",
    description: "Tight on face or details",
    prompt:      "extreme close-up, tight on face or details, shallow depth of field",
  },
  orbit: {
    label:       "Orbit",
    description: "Camera circles the subject",
    prompt:      "orbiting camera, circling around the subject, smooth 360 arc movement",
  },
};

export const CAMERA_DIRECTION_KEYS = Object.keys(CAMERA_DIRECTION_DATA) as CameraDirectionKey[];

// ─── Film looks ───────────────────────────────────────────────────────────────

export type FilmLookKey =
  | "clean_digital"
  | "35mm_film"
  | "16mm_grain"
  | "anamorphic"
  | "vhs_retro"
  | "noir";

export interface FilmLookData {
  label:       string;
  description: string;
  prompt:      string;
}

export const FILM_LOOK_DATA: Record<FilmLookKey, FilmLookData> = {
  clean_digital: {
    label:       "Clean Digital",
    description: "Crisp, neutral, modern",
    prompt:      "clean digital cinematography, sharp and crisp, neutral color grading, professional broadcast quality",
  },
  "35mm_film": {
    label:       "35mm Film",
    description: "Warm grain, Kodak tones",
    prompt:      "35mm film aesthetic, warm Kodak color tones, fine grain, natural halation around highlights, organic film texture",
  },
  "16mm_grain": {
    label:       "16mm Grain",
    description: "Heavy grain, raw indie",
    prompt:      "16mm film look, heavy grain, slightly desaturated, raw independent film aesthetic, lifted shadows, gritty texture",
  },
  anamorphic: {
    label:       "Anamorphic",
    description: "Lens flares, oval bokeh",
    prompt:      "anamorphic lens cinematography, horizontal lens flares, oval bokeh, wide cinematic aspect ratio feel, cinematic scope",
  },
  vhs_retro: {
    label:       "VHS Retro",
    description: "Scan lines, color bleed",
    prompt:      "VHS retro aesthetic, scan lines, color bleed, chromatic aberration, 80s 90s video texture, analog warmth",
  },
  noir: {
    label:       "Noir",
    description: "High contrast B&W",
    prompt:      "noir cinematography, high contrast black and white, deep crushing blacks, harsh dramatic shadows, expressionist lighting",
  },
};

export const FILM_LOOK_KEYS = Object.keys(FILM_LOOK_DATA) as FilmLookKey[];

// ─── Detect camera direction from description ─────────────────────────────────

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
