/**
 * src/lib/cover-art/styles-seed.ts
 *
 * The 15 canonical CoverArtStyle records.
 * Used by the admin seed API (POST /api/admin/cover-art/styles?action=seed)
 * and referenced in UI constant maps.
 */

export interface CoverArtStyleSeed {
  name:      string;
  category:  string;
  previewUrl: string;
  promptBase: string;
  sortOrder: number;
}

export const COVER_ART_STYLES: CoverArtStyleSeed[] = [
  // ── Minimal ────────────────────────────────────────────────────────────────
  {
    name:      "Minimalist Typography",
    category:  "MINIMAL",
    sortOrder: 1,
    previewUrl: "",
    promptBase: "clean minimalist album cover, solid color background, elegant typography space in lower third, negative space, modern, high contrast",
  },
  {
    name:      "Monochrome Film",
    category:  "MINIMAL",
    sortOrder: 2,
    previewUrl: "",
    promptBase: "black and white album cover, high contrast monochrome, film grain texture, dramatic shadows, cinematic, moody",
  },
  {
    name:      "Clean Gradient",
    category:  "MINIMAL",
    sortOrder: 3,
    previewUrl: "",
    promptBase: "smooth gradient album cover, two-tone color blend, subtle texture, clean modern design, open space for text",
  },

  // ── Dark ───────────────────────────────────────────────────────────────────
  {
    name:      "Dark & Gritty",
    category:  "DARK",
    sortOrder: 4,
    previewUrl: "",
    promptBase: "dark gritty album cover, textured concrete, scratched metal, urban decay, moody shadows, desaturated tones",
  },
  {
    name:      "Smoke & Shadow",
    category:  "DARK",
    sortOrder: 5,
    previewUrl: "",
    promptBase: "atmospheric album cover, dense smoke, dramatic backlighting, silhouette, dark moody, volumetric lighting",
  },
  {
    name:      "Gothic Portrait",
    category:  "DARK",
    sortOrder: 6,
    previewUrl: "",
    promptBase: "gothic album cover, dark ornate frames, deep blacks and rich golds, dramatic portraiture, cathedral lighting",
  },

  // ── Vibrant ────────────────────────────────────────────────────────────────
  {
    name:      "Vibrant Illustrated",
    category:  "VIBRANT",
    sortOrder: 7,
    previewUrl: "",
    promptBase: "vibrant illustrated album cover, bold colors, digital illustration style, dynamic composition, saturated palette",
  },
  {
    name:      "Neon Futuristic",
    category:  "VIBRANT",
    sortOrder: 8,
    previewUrl: "",
    promptBase: "neon-lit album cover, cyberpunk aesthetic, glowing edges, electric blue and hot pink, futuristic cityscape reflections",
  },
  {
    name:      "Psychedelic",
    category:  "VIBRANT",
    sortOrder: 9,
    previewUrl: "",
    promptBase: "psychedelic album cover, swirling colors, kaleidoscopic patterns, trippy visuals, retro 60s influence, vivid saturation",
  },

  // ── Classic ────────────────────────────────────────────────────────────────
  {
    name:      "Vintage Vinyl",
    category:  "CLASSIC",
    sortOrder: 10,
    previewUrl: "",
    promptBase: "vintage vinyl record album cover, retro 70s aesthetic, warm analog tones, worn paper texture, classic typography",
  },
  {
    name:      "Street Photography",
    category:  "CLASSIC",
    sortOrder: 11,
    previewUrl: "",
    promptBase: "candid street photography album cover, urban setting, natural lighting, documentary style, raw authentic feel",
  },
  {
    name:      "Photo-Real Portrait",
    category:  "CLASSIC",
    sortOrder: 12,
    previewUrl: "",
    promptBase: "cinematic portrait album cover, shallow depth of field, studio lighting, high detail face, professional photography",
  },

  // ── Experimental ──────────────────────────────────────────────────────────
  {
    name:      "Abstract Geometric",
    category:  "EXPERIMENTAL",
    sortOrder: 13,
    previewUrl: "",
    promptBase: "abstract geometric album cover, bold shapes, intersecting lines, mathematical patterns, modern art influence",
  },
  {
    name:      "Collage Mixed Media",
    category:  "EXPERIMENTAL",
    sortOrder: 14,
    previewUrl: "",
    promptBase: "mixed media collage album cover, torn paper layers, overlapping textures, analog cut-and-paste aesthetic, raw edges",
  },
  {
    name:      "Watercolor Dreamy",
    category:  "EXPERIMENTAL",
    sortOrder: 15,
    previewUrl: "",
    promptBase: "soft watercolor album cover, flowing paint bleeds, pastel tones, ethereal dreamy atmosphere, gentle organic textures",
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  MINIMAL:      "Minimal",
  DARK:         "Dark",
  VIBRANT:      "Vibrant",
  CLASSIC:      "Classic",
  EXPERIMENTAL: "Experimental",
};
