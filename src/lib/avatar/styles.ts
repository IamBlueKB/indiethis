/**
 * src/lib/avatar/styles.ts
 *
 * Client-safe avatar style definitions — NO server imports (no sharp, no fal).
 * Import this in client components (AvatarStudio, etc.).
 * generator.ts re-exports this for API routes.
 */

export const AVATAR_STYLES: Record<string, { label: string; description: string; promptBase: string }> = {
  cinematic: {
    label:       "Cinematic",
    description: "Dramatic lighting, shallow depth of field, film-grade color",
    promptBase:  "Cinematic portrait, dramatic side lighting, shallow depth of field, film color grading, moody atmosphere",
  },
  illustrated: {
    label:       "Illustrated",
    description: "Digital illustration, bold lines, vibrant color palette",
    promptBase:  "Digital illustration portrait, bold confident lines, vibrant saturated colors, professional character design",
  },
  dark_moody: {
    label:       "Dark & Moody",
    description: "Deep shadows, desaturated tones, urban edge",
    promptBase:  "Dark moody portrait, deep shadows, desaturated cool tones, urban gritty texture, dramatic contrast",
  },
  neon_glow: {
    label:       "Neon Glow",
    description: "Cyberpunk lighting, neon highlights, futuristic feel",
    promptBase:  "Cyberpunk neon portrait, electric blue and hot pink rim lighting, futuristic glow effects, dark background",
  },
  vintage_film: {
    label:       "Vintage Film",
    description: "Warm tones, film grain, retro 70s aesthetic",
    promptBase:  "Vintage 70s film portrait, warm analog tones, subtle film grain, golden hour lighting, nostalgic feel",
  },
  clean_portrait: {
    label:       "Clean Portrait",
    description: "Minimal styling, studio-quality, professional headshot",
    promptBase:  "Clean professional portrait, neutral studio backdrop, even lighting, sharp focus, minimal styling",
  },
  watercolor: {
    label:       "Watercolor",
    description: "Soft painted look, flowing colors, artistic texture",
    promptBase:  "Watercolor painted portrait, soft flowing brushstrokes, gentle color bleeds, artistic texture, ethereal",
  },
  comic_book: {
    label:       "Comic Book",
    description: "Bold outlines, cel-shaded, graphic novel aesthetic",
    promptBase:  "Comic book portrait, bold black outlines, cel-shaded flat colors, graphic novel aesthetic, dynamic pose",
  },
};
