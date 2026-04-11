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
      colorPalette: ["#6B6B6B", "#8B7355", "#C0392B", "#D4A843"],
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
      colorPalette: ["#0A0A0A", "#1A2A4A", "#2C3E6B", "#F0F0F0"],
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
      colorPalette: ["#FF2D78", "#00BFFF", "#D4A843", "#1A0A2E"],
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
      colorPalette: ["#D4854A", "#C8963C", "#D4A843", "#2C1810"],
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
      colorPalette: ["#8B0000", "#1A0A0A", "#D4A843", "#3D0000"],
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
      colorPalette: ["#D4A843", "#87CEEB", "#8B6914", "#A0522D"],
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
      colorPalette: ["#FF3B30", "#FFD60A", "#30D158", "#0A84FF", "#FFFFFF"],
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
      colorPalette: ["#E8E8E8", "#B0C4D8", "#C4956A", "#F5F0EB"],
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
      colorPalette: ["#FF3B30", "#0A84FF", "#FFD60A", "#FFFFFF"],
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
      colorPalette: ["#0080FF", "#00FF41", "#FF0090", "#6A0DAD"],
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
      colorPalette: ["#5C7A5C", "#C8963C", "#9E9E9E", "#2C2C2C"],
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
      colorPalette: ["#000000", "#FFFFFF", "#4A4A4A", "#1C1C1C"],
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
      colorPalette: ["#D4A843", "#C17A3A", "#87AABF", "#D4956A"],
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
      colorPalette: ["#C8963C", "#D4A843", "#7A9E7A", "#F5E6C8"],
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
      colorPalette: ["#5A7A5A", "#5A7A9E", "#D8D8D0", "#3A4A3A"],
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
      colorPalette: ["#FF6B2B", "#C0392B", "#2ECC71", "#D4A843"],
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
      colorPalette: ["#D4A843", "#FF2D78", "#6A0DAD", "#C8963C"],
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
      colorPalette: ["#8B6914", "#D4B896", "#6B8C6B", "#F5E6C8"],
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
      colorPalette: ["#4A7A9E", "#6E6E6E", "#D4A843", "#1A2A3A"],
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
      colorPalette: ["#B388C8", "#88B8C8", "#C8B888", "#C888A8"],
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
