/**
 * Seed 20 VideoPreset records into the database.
 * Run: node scripts/seed-video-presets.mjs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Style name → id mapping (from DB)
const STYLE = {
  "Cinematic Noir":      "cmno8vnu20000103crgs89yy3",
  "Golden Hour":         "cmno8vo8v0001103czty8hiom",
  "Desaturated Drama":   "cmno8volp0002103c86bby6j9",
  "Anamorphic Widescreen": "cmno8voyl0003103c0t9l7dsi",
  "VHS Glitch":          "cmno8vsks000d103cdsljgzci",
  "90s Hip-Hop":         "cmno8vsy1000e103cjeo2379e",
  "Vintage Film Grain":  "cmno8vtau000f103cqw314cog",
  "Smoke & Shadow":      "cmno8vuq9000j103csy8m1dbj",
  "Underground":         "cmno8vv34000k103c67j7ll0j",
  "Pop Color Burst":     "cmno8vvsq000m103ct6n06kb2",
  "Pastel Dream":        "cmno8vw5j000n103c25g39086",
  "Neon Waves":          "cmno8vs7l000c103c6jr6x7ys",
  "Festival":            "cmno8vwie000o103c985pe31i",
  "Tropical":            "cmno8vw5j000n103c25g39086",
  "Polaroid":            "cmno8vtnq000g103cj6c3jfvn",
  "Watercolor Dream":    "cmno8vq240006103cgzzstcdq",
  "Particle Flow":       "cmno8vr4i0009103copvw1t3o",
};

const presets = [
  // ─── Hip-Hop / Trap ───────────────────────────────────────────────────────

  {
    name: "Street Anthem",
    genre: "HIP_HOP",
    description: "Outdoor performance, gritty urban energy, low angles and raw streets",
    moodArc: "intense_throughout",
    defaultFilmLook: "16mm_grain",
    styleName: "Underground",
    sortOrder: 1,
    cameraSequence: {
      intro:   "aerial",
      verse:   "tracking",
      chorus:  "static_wide",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A raw street-level performance set against an urban landscape.",
      tone:            "Gritty, authentic, high-energy",
      colorPalette:    "Muted grays, concrete, splashes of red and gold",
      visualThemes:    "City streets, alleyways, rooftops, performance energy",
      cinematography:  "Low-angle hero shots, handheld movement, heavy grain",
    },
  },

  {
    name: "Cinematic Trap",
    genre: "HIP_HOP",
    description: "Narrative storytelling with noir film look and slow dramatic shots",
    moodArc: "dark_to_bright",
    defaultFilmLook: "noir",
    styleName: "Cinematic Noir",
    sortOrder: 2,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "push_in",
      chorus:  "orbit",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A dark, story-driven trap video with cinematic weight.",
      tone:            "Moody, intense, cinematic",
      colorPalette:    "Deep blacks, cold blues, harsh white light",
      visualThemes:    "Dimly lit rooms, shadows, dramatic reveals",
      cinematography:  "Slow dolly moves, high contrast noir lighting, anamorphic lens flares",
    },
  },

  {
    name: "Club Banger",
    genre: "HIP_HOP",
    description: "Nightclub energy with neon lighting, fast cuts, and VHS nostalgia",
    moodArc: "intense_throughout",
    defaultFilmLook: "vhs_retro",
    styleName: "VHS Glitch",
    sortOrder: 3,
    cameraSequence: {
      intro:   "tracking",
      verse:   "close_up",
      chorus:  "orbit",
      bridge:  "static_wide",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A high-energy club performance dripping in neon and nostalgia.",
      tone:            "Hype, celebratory, chaotic",
      colorPalette:    "Neon pink, electric blue, gold",
      visualThemes:    "Nightclub, dance floor, crowd energy, flashing lights",
      cinematography:  "Fast cuts on beat, handheld chaos, VHS scan lines",
    },
  },

  // ─── R&B / Soul ───────────────────────────────────────────────────────────

  {
    name: "Intimate R&B",
    genre: "RNB",
    description: "Close-up emotional performance with warm candlelight and 35mm film",
    moodArc: "emotional_journey",
    defaultFilmLook: "35mm_film",
    styleName: "Golden Hour",
    sortOrder: 4,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "push_in",
      chorus:  "close_up",
      bridge:  "slow_pan",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A deeply personal R&B performance bathed in warm candlelight.",
      tone:            "Vulnerable, warm, emotional",
      colorPalette:    "Warm ambers, honey gold, soft shadows",
      visualThemes:    "Candlelit rooms, intimate spaces, soft textures",
      cinematography:  "Slow push-ins, shallow depth of field, 35mm warmth",
    },
  },

  {
    name: "Sultry & Dark",
    genre: "RNB",
    description: "Dark moody rooms, smoke, deep reds — slow and seductive",
    moodArc: "intense_throughout",
    defaultFilmLook: "noir",
    styleName: "Smoke & Shadow",
    sortOrder: 5,
    cameraSequence: {
      intro:   "slow_pan",
      verse:   "push_in",
      chorus:  "orbit",
      bridge:  "close_up",
      outro:   "static_wide",
    },
    briefTemplate: {
      logline:         "A sultry, smoke-filled performance with dangerous energy.",
      tone:            "Seductive, tense, mysterious",
      colorPalette:    "Deep crimson, near-black shadows, gold accents",
      visualThemes:    "Smoke, velvet, mirrors, low light, slow reveals",
      cinematography:  "Slow orbiting shots, smoke diffusion, extreme close-ups",
    },
  },

  {
    name: "Soulful Uplift",
    genre: "RNB",
    description: "Golden hour outdoors, gospel energy, bright and warm",
    moodArc: "dark_to_bright",
    defaultFilmLook: "35mm_film",
    styleName: "Golden Hour",
    sortOrder: 6,
    cameraSequence: {
      intro:   "aerial",
      verse:   "tracking",
      chorus:  "static_wide",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "An uplifting soul performance at golden hour with wide open skies.",
      tone:            "Hopeful, joyful, powerful",
      colorPalette:    "Warm gold, sky blue, rich earth tones",
      visualThemes:    "Open fields, sunset, community, joy",
      cinematography:  "Wide sweeping shots, golden backlight, handheld energy",
    },
  },

  // ─── Pop ──────────────────────────────────────────────────────────────────

  {
    name: "Bright Pop",
    genre: "POP",
    description: "Colorful studio performance, clean and upbeat with fast cuts",
    moodArc: "intense_throughout",
    defaultFilmLook: "clean_digital",
    styleName: "Pop Color Burst",
    sortOrder: 7,
    cameraSequence: {
      intro:   "pull_back",
      verse:   "tracking",
      chorus:  "orbit",
      bridge:  "close_up",
      outro:   "static_wide",
    },
    briefTemplate: {
      logline:         "A fun, colorful pop performance full of energy and movement.",
      tone:            "Upbeat, playful, confident",
      colorPalette:    "Bright primary colors, candy pastels, white studio",
      visualThemes:    "Studio sets, bold backdrops, choreography, fun props",
      cinematography:  "Quick cuts on beat, smooth tracking, clean bright lighting",
    },
  },

  {
    name: "Emotional Ballad",
    genre: "POP",
    description: "Single performer, stripped-back setting, slow zoom on chorus reveal",
    moodArc: "emotional_journey",
    defaultFilmLook: "35mm_film",
    styleName: "Vintage Film Grain",
    sortOrder: 8,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "push_in",
      chorus:  "close_up",
      bridge:  "slow_pan",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A raw, emotional ballad performance — just an artist and their truth.",
      tone:            "Vulnerable, honest, moving",
      colorPalette:    "Desaturated whites, soft blues, warm skin tones",
      visualThemes:    "Empty rooms, single spotlight, rain, letters, memory",
      cinematography:  "Slow push-ins, minimal cuts, natural light, intimate framing",
    },
  },

  {
    name: "Pop Anthem",
    genre: "POP",
    description: "Stadium energy, wide hero shots, bold colors — made for the big moment",
    moodArc: "building_energy",
    defaultFilmLook: "clean_digital",
    styleName: "Pop Color Burst",
    sortOrder: 9,
    cameraSequence: {
      intro:   "aerial",
      verse:   "tracking",
      chorus:  "static_wide",
      bridge:  "orbit",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A massive pop anthem with stadium scale and hero energy.",
      tone:            "Triumphant, epic, inspiring",
      colorPalette:    "Bold primaries, bright white light, electric accents",
      visualThemes:    "Stages, crowds, spotlights, grand landscapes",
      cinematography:  "Wide hero shots, aerial sweeps, slow-motion climax moments",
    },
  },

  // ─── EDM / Electronic ─────────────────────────────────────────────────────

  {
    name: "Festival Mode",
    genre: "EDM",
    description: "Stage performance with light show, fast drops, neon futuristic look",
    moodArc: "building_energy",
    defaultFilmLook: "clean_digital",
    styleName: "Festival",
    sortOrder: 10,
    cameraSequence: {
      intro:   "aerial",
      verse:   "tracking",
      chorus:  "orbit",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A massive festival set with laser shows and a crowd going wild.",
      tone:            "Euphoric, explosive, massive",
      colorPalette:    "Electric blue, laser green, hot pink, deep purple",
      visualThemes:    "Festival stages, lasers, pyrotechnics, crowd energy, DJ booth",
      cinematography:  "Fast cuts on drops, aerial crowd shots, strobe effects",
    },
  },

  {
    name: "Lo-fi Chill",
    genre: "EDM",
    description: "Bedroom or rooftop setting, soft grain, static camera, muted earth tones",
    moodArc: "emotional_journey",
    defaultFilmLook: "16mm_grain",
    styleName: "Vintage Film Grain",
    sortOrder: 11,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "slow_pan",
      chorus:  "push_in",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A lo-fi chill track video — rain, warm lights, and slow moments.",
      tone:            "Relaxed, nostalgic, introspective",
      colorPalette:    "Muted greens, warm amber, soft grays",
      visualThemes:    "Bedroom studio, rooftop at dusk, coffee, rain on windows",
      cinematography:  "Static locked-off shots, minimal movement, soft grain",
    },
  },

  {
    name: "Dark Bass",
    genre: "EDM",
    description: "Industrial warehouse, strobes, noir look, high contrast and minimal movement",
    moodArc: "intense_throughout",
    defaultFilmLook: "noir",
    styleName: "Cinematic Noir",
    sortOrder: 12,
    cameraSequence: {
      intro:   "slow_pan",
      verse:   "static_wide",
      chorus:  "push_in",
      bridge:  "close_up",
      outro:   "orbit",
    },
    briefTemplate: {
      logline:         "A dark, heavy bass video set in an industrial underground space.",
      tone:            "Menacing, raw, industrial",
      colorPalette:    "Pure black, harsh white strobes, cold steel gray",
      visualThemes:    "Warehouse raves, fog machines, concrete, chain-link, darkness",
      cinematography:  "Slow reveals, strobe lighting effects, high contrast noir",
    },
  },

  // ─── Indie / Alternative ──────────────────────────────────────────────────

  {
    name: "Indie Road Trip",
    genre: "INDIE",
    description: "Moving car shots, natural landscapes, golden hour, wandering handheld",
    moodArc: "building_energy",
    defaultFilmLook: "35mm_film",
    styleName: "Golden Hour",
    sortOrder: 13,
    cameraSequence: {
      intro:   "aerial",
      verse:   "tracking",
      chorus:  "static_wide",
      bridge:  "slow_pan",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A sun-drenched road trip video full of movement and open horizons.",
      tone:            "Free, adventurous, bittersweet",
      colorPalette:    "Warm gold, dusty orange, faded blue sky",
      visualThemes:    "Open highways, desert landscapes, car windows, small towns",
      cinematography:  "Handheld movement, window reflections, wide landscape shots",
    },
  },

  {
    name: "Bedroom Pop",
    genre: "INDIE",
    description: "Intimate bedroom setting, warm lamp light, 16mm grain, subtle movements",
    moodArc: "emotional_journey",
    defaultFilmLook: "16mm_grain",
    styleName: "Polaroid",
    sortOrder: 14,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "push_in",
      chorus:  "close_up",
      bridge:  "slow_pan",
      outro:   "static_wide",
    },
    briefTemplate: {
      logline:         "A cozy, intimate bedroom pop video shot like a personal diary.",
      tone:            "Warm, personal, dreamy",
      colorPalette:    "Warm amber, fairy light gold, soft greens",
      visualThemes:    "Bedroom, string lights, plants, polaroids, journals",
      cinematography:  "Static shots with minimal movement, warm practical lighting",
    },
  },

  {
    name: "Indie Cinematic",
    genre: "INDIE",
    description: "Short film style with narrative arc, anamorphic lens, muted desaturated palette",
    moodArc: "dark_to_bright",
    defaultFilmLook: "anamorphic",
    styleName: "Anamorphic Widescreen",
    sortOrder: 15,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "tracking",
      chorus:  "pull_back",
      bridge:  "close_up",
      outro:   "aerial",
    },
    briefTemplate: {
      logline:         "A cinematic indie music video that tells a story through images.",
      tone:            "Melancholic, cinematic, introspective",
      colorPalette:    "Desaturated greens, muted blues, faded whites",
      visualThemes:    "Rural landscapes, empty towns, solitary figures, wide open spaces",
      cinematography:  "Anamorphic scope, letterbox feel, long takes, minimal dialogue",
    },
  },

  // ─── Latin ────────────────────────────────────────────────────────────────

  {
    name: "Latin Heat",
    genre: "LATIN",
    description: "Dance performance, vibrant warm colors, fast rhythmic cuts",
    moodArc: "intense_throughout",
    defaultFilmLook: "clean_digital",
    styleName: "Tropical",
    sortOrder: 16,
    cameraSequence: {
      intro:   "tracking",
      verse:   "orbit",
      chorus:  "static_wide",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A vibrant Latin dance performance full of fire and rhythm.",
      tone:            "Passionate, energetic, celebratory",
      colorPalette:    "Hot orange, deep red, tropical greens, warm gold",
      visualThemes:    "Outdoor plazas, rooftops, dance choreography, tropical settings",
      cinematography:  "Fast rhythmic cuts, low angles during dance, tracking movement",
    },
  },

  {
    name: "Reggaeton Night",
    genre: "LATIN",
    description: "Club or rooftop night setting, neon and gold tones, VHS retro look",
    moodArc: "intense_throughout",
    defaultFilmLook: "vhs_retro",
    styleName: "VHS Glitch",
    sortOrder: 17,
    cameraSequence: {
      intro:   "slow_pan",
      verse:   "tracking",
      chorus:  "orbit",
      bridge:  "close_up",
      outro:   "static_wide",
    },
    briefTemplate: {
      logline:         "A late-night reggaeton video with neon glow and VHS nostalgia.",
      tone:            "Seductive, hype, nightlife",
      colorPalette:    "Gold, neon pink, deep purple, warm amber",
      visualThemes:    "Rooftop parties, nightclub, city lights, cars, late nights",
      cinematography:  "Handheld energy, VHS grain, quick zoom-ins, wide night shots",
    },
  },

  // ─── Acoustic / Singer-Songwriter ─────────────────────────────────────────

  {
    name: "Raw Acoustic",
    genre: "ACOUSTIC",
    description: "Single performer, natural light, minimal cuts, 35mm film, earthy palette",
    moodArc: "emotional_journey",
    defaultFilmLook: "35mm_film",
    styleName: "Vintage Film Grain",
    sortOrder: 18,
    cameraSequence: {
      intro:   "static_wide",
      verse:   "slow_pan",
      chorus:  "push_in",
      bridge:  "close_up",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "A stripped-back acoustic performance shot with honesty and warmth.",
      tone:            "Honest, raw, intimate",
      colorPalette:    "Warm wood tones, soft natural light, earthy greens",
      visualThemes:    "Front porches, living rooms, fields, guitar, natural settings",
      cinematography:  "Long takes, natural window light, minimal cuts, 35mm grain",
    },
  },

  {
    name: "Orchestral Story",
    genre: "ACOUSTIC",
    description: "Wide cinematic landscapes, slow camera movements, anamorphic, emotional arc",
    moodArc: "building_energy",
    defaultFilmLook: "anamorphic",
    styleName: "Anamorphic Widescreen",
    sortOrder: 19,
    cameraSequence: {
      intro:   "aerial",
      verse:   "static_wide",
      chorus:  "push_in",
      bridge:  "slow_pan",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "An epic orchestral journey across sweeping cinematic landscapes.",
      tone:            "Epic, emotional, grand",
      colorPalette:    "Cool blues, dramatic grays, golden light breaks",
      visualThemes:    "Mountains, oceans, forests, solitary figures in vast landscapes",
      cinematography:  "Sweeping aerials, slow push-ins, anamorphic flares, long takes",
    },
  },

  // ─── Abstract / Experimental ──────────────────────────────────────────────

  {
    name: "Visual Art Film",
    genre: "ABSTRACT",
    description: "Non-literal imagery, color washes, experimental cuts — no traditional performance",
    moodArc: "emotional_journey",
    defaultFilmLook: "anamorphic",
    styleName: "Watercolor Dream",
    sortOrder: 20,
    cameraSequence: {
      intro:   "slow_pan",
      verse:   "push_in",
      chorus:  "orbit",
      bridge:  "aerial",
      outro:   "pull_back",
    },
    briefTemplate: {
      logline:         "An abstract visual art film where emotion replaces narrative.",
      tone:            "Surreal, introspective, artistic",
      colorPalette:    "Shifting color washes, muted pastels, unexpected hues",
      visualThemes:    "Abstract textures, nature macro shots, dreamlike sequences, symbolism",
      cinematography:  "Experimental cuts, double exposures, slow motion, color grading extremes",
    },
  },
];

async function main() {
  console.log(`Seeding ${presets.length} VideoPreset records...`);

  for (const preset of presets) {
    await db.videoPreset.upsert({
      where: { name: preset.name },
      update: preset,
      create: preset,
    });
    console.log(`  ✓ ${preset.name}`);
  }

  console.log("\nDone.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
