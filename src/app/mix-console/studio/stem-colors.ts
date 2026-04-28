/**
 * Stem role → color mapping per the Pro Studio spec.
 * Matches the existing frequency visualizer + stem breakdown palette.
 *
 * Roles can come from inputFiles[].label which uses underscored names
 * (e.g. "vocal_main", "vocal_doubles"). We accept either the snake_case
 * label or a friendly name. Unknown roles fall back to gold.
 */

const COLOR_MAP: Record<string, string> = {
  // Main vocal family
  vocal_main:      "#E8735A",
  main_vocal:      "#E8735A",
  lead:            "#E8735A",

  // Ad-libs
  vocal_adlibs:    "#D4AF37",
  adlibs:          "#D4AF37",
  adlib:           "#D4AF37",

  // Doubles
  vocal_doubles:   "#7F77DD",
  doubles:         "#7F77DD",
  double:          "#7F77DD",

  // Harmonies
  vocal_harmonies: "#1D9E75",
  harmonies:       "#1D9E75",
  harmony:         "#1D9E75",
  backing:         "#1D9E75",

  // Ins & outs
  vocal_insouts:   "#D4537E",
  insouts:         "#D4537E",

  // Beat + sub-stems
  beat:            "#378ADD",
  kick:            "#378ADD",
  bass:            "#37ADAD",
  drums_other:     "#8A9AAD",
  drums:           "#8A9AAD",
  other:           "#8A9AAD",
  melodics:        "#AD8A37",
};

const FRIENDLY_LABEL: Record<string, string> = {
  vocal_main:      "Main Vocal",
  main_vocal:      "Main Vocal",
  lead:            "Main Vocal",
  vocal_adlibs:    "Ad-libs",
  adlibs:          "Ad-libs",
  vocal_doubles:   "Doubles",
  doubles:         "Doubles",
  vocal_harmonies: "Harmonies",
  harmonies:       "Harmonies",
  vocal_insouts:   "Vocal Ins/Out",
  insouts:         "Vocal Ins/Out",
  beat:            "Beat",
  kick:            "Kick",
  bass:            "Bass",
  drums_other:     "Drums",
  drums:           "Drums",
  other:           "Other",
  melodics:        "Melodics",
};

export function colorForRole(role: string): string {
  return COLOR_MAP[role.toLowerCase()] ?? "#D4A843";
}

export function labelForRole(role: string): string {
  const key = role.toLowerCase();
  if (FRIENDLY_LABEL[key]) return FRIENDLY_LABEL[key];

  // Indexed multi-stem roles like `vocal_insouts_0`, `vocal_insouts_1` —
  // strip the numeric suffix, look up the friendly base, and re-attach the
  // index (1-based for the user's eye).
  const indexed = key.match(/^(.+)_(\d+)$/);
  if (indexed) {
    const base = FRIENDLY_LABEL[indexed[1]];
    if (base) return `${base} ${Number(indexed[2]) + 1}`;
  }

  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
