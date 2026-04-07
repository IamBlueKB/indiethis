import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const STYLES = [
  // ── CINEMATIC ────────────────────────────────────────────────────────────
  {
    name:       "Cinematic Noir",
    category:   "CINEMATIC",
    previewUrl: "/previews/cinematic-noir.mp4",
    promptBase: "cinematic noir style, high contrast black and white with selective deep shadows, dramatic chiaroscuro lighting, film grain texture, 35mm anamorphic lens flare, moody atmospheric fog, rain-soaked streets, vintage Hollywood glamour",
    sortOrder:  1,
  },
  {
    name:       "Golden Hour",
    category:   "CINEMATIC",
    previewUrl: "/previews/golden-hour.mp4",
    promptBase: "golden hour cinematic, warm amber and orange sunlight, lens flare halations, soft bokeh background, cinematic color grade, dusty haze in atmosphere, epic landscape composition, 4K film quality",
    sortOrder:  2,
  },
  {
    name:       "Desaturated Drama",
    category:   "CINEMATIC",
    previewUrl: "/previews/desaturated-drama.mp4",
    promptBase: "desaturated cinematic drama, muted color palette, teal and orange color grade, deep shadows, emotional intimate close-ups, shallow depth of field, modern prestige television aesthetic, slow deliberate camera movement",
    sortOrder:  3,
  },
  {
    name:       "Anamorphic Widescreen",
    category:   "CINEMATIC",
    previewUrl: "/previews/anamorphic.mp4",
    promptBase: "anamorphic widescreen 2.39:1 aspect ratio, horizontal lens flares, oval bokeh, ultra-cinematic scope, Hollywood blockbuster production value, smooth dolly movement, epic wide establishing shots, cinematic color science",
    sortOrder:  4,
  },

  // ── ANIMATED ──────────────────────────────────────────────────────────────
  {
    name:       "Anime",
    category:   "ANIMATED",
    previewUrl: "/previews/anime.mp4",
    promptBase: "anime art style, detailed hand-drawn animation, vibrant saturated colors, expressive character designs, dynamic action lines, cel shading, sakura petals, dramatic sky backgrounds, Studio Ghibli emotional quality",
    sortOrder:  10,
  },
  {
    name:       "Cel-Shaded",
    category:   "ANIMATED",
    previewUrl: "/previews/cel-shaded.mp4",
    promptBase: "cel-shaded 3D animation, bold black outlines, flat color fills, comic book inspired shading, expressive stylized characters, vibrant palette, smooth toon-shader rendering, Borderlands game art aesthetic",
    sortOrder:  11,
  },
  {
    name:       "Watercolor Dream",
    category:   "ANIMATED",
    previewUrl: "/previews/watercolor.mp4",
    promptBase: "watercolor painting animation, soft wet-on-wet color bleeds, delicate ink linework, painterly texture throughout, ethereal dreamlike quality, muted pastels with vivid accents, flowing organic shapes, impressionist brush strokes",
    sortOrder:  12,
  },
  {
    name:       "Comic Book",
    category:   "ANIMATED",
    previewUrl: "/previews/comic-book.mp4",
    promptBase: "comic book illustration style, Ben-Day dot halftone shading, bold black outlines, primary color palette, speed lines and action panels, speech bubble energy, Marvel and DC superhero aesthetic, dynamic action poses",
    sortOrder:  13,
  },
  {
    name:       "Pixel Art",
    category:   "ANIMATED",
    previewUrl: "/previews/pixel-art.mp4",
    promptBase: "retro pixel art style, 16-bit color palette, chunky pixel aesthetic, sprite animation, scanline effect, arcade game nostalgia, lo-fi charm, dithering patterns, classic video game visual language",
    sortOrder:  14,
  },

  // ── ABSTRACT ─────────────────────────────────────────────────────────────
  {
    name:       "Particle Flow",
    category:   "ABSTRACT",
    previewUrl: "/previews/particle-flow.mp4",
    promptBase: "particle system abstract visualization, thousands of luminous particles flowing in fluid dynamics, deep space background, color gradients shifting with music energy, volumetric light beams, physics-based motion, generative art aesthetic",
    sortOrder:  20,
  },
  {
    name:       "Liquid Metal",
    category:   "ABSTRACT",
    previewUrl: "/previews/liquid-metal.mp4",
    promptBase: "liquid metal morphing abstract, chrome and mercury surfaces, reflective fluid simulation, iridescent color shifts, slow viscous movement, photorealistic metal material, dark studio lighting, hypnotic flowing shapes",
    sortOrder:  21,
  },
  {
    name:       "Geometric Pulse",
    category:   "ABSTRACT",
    previewUrl: "/previews/geometric-pulse.mp4",
    promptBase: "geometric abstract animation, precise mathematical shapes, pulsing and rotating polygons, clean vector aesthetic, neon colors on dark background, minimalist Bauhaus influence, synchronized geometric transformations, sharp edges and perfect symmetry",
    sortOrder:  22,
  },
  {
    name:       "Neon Waves",
    category:   "ABSTRACT",
    previewUrl: "/previews/neon-waves.mp4",
    promptBase: "neon wave abstract, electric blue and pink sine waves rippling through space, dark void background, glowing plasma energy, oscilloscope visualization, synesthesia-inspired color response, smooth fluid wave motion, phosphorescent glow",
    sortOrder:  23,
  },

  // ── RETRO ─────────────────────────────────────────────────────────────────
  {
    name:       "VHS Glitch",
    category:   "RETRO",
    previewUrl: "/previews/vhs-glitch.mp4",
    promptBase: "VHS tape aesthetic, analog glitch artifacts, tracking error distortions, chromatic aberration scan lines, washed-out 80s colors, video noise grain, CRT monitor curvature, nostalgic lo-fi quality, magnetic tape degradation",
    sortOrder:  30,
  },
  {
    name:       "90s Hip-Hop",
    category:   "RETRO",
    previewUrl: "/previews/90s-hiphop.mp4",
    promptBase: "90s hip-hop music video aesthetic, handheld camcorder look, urban street settings, bold graphic lower thirds, strong directional sunlight, oversized clothing fashion, classic B-boy energy, gritty city backdrop, warm filmic color grade",
    sortOrder:  31,
  },
  {
    name:       "Vintage Film Grain",
    category:   "RETRO",
    previewUrl: "/previews/vintage-film.mp4",
    promptBase: "vintage 16mm film aesthetic, heavy grain texture, slight color fade and yellowing, light leaks and film scratches, warm sepia undertones, Super 8 handheld feel, analog imperfection, timeless nostalgia, documentary authenticity",
    sortOrder:  32,
  },
  {
    name:       "Polaroid",
    category:   "RETRO",
    previewUrl: "/previews/polaroid.mp4",
    promptBase: "Polaroid instant photograph aesthetic, faded color saturation, subtle vignette edges, warm overexposed highlights, soft dreamy focus, vintage snapshot composition, intimate candid framing, lo-fi analog charm, weekend nostalgia",
    sortOrder:  33,
  },

  // ── DARK ─────────────────────────────────────────────────────────────────
  {
    name:       "Horror",
    category:   "DARK",
    previewUrl: "/previews/horror.mp4",
    promptBase: "horror atmospheric visual style, desaturated cold color palette, deep unsettling shadows, practical lighting with hard shadows, fog and mist effects, abandoned locations, unsettling stillness, psychological dread, Blair Witch meets A24 aesthetic",
    sortOrder:  40,
  },
  {
    name:       "Gothic",
    category:   "DARK",
    previewUrl: "/previews/gothic.mp4",
    promptBase: "gothic dark aesthetic, Victorian architecture and ironwork, candlelight and moonlight illumination, deep jewel tone palette of crimson and purple, ornate baroque details, dramatic storm clouds, ravens and gargoyles, romantic macabre atmosphere",
    sortOrder:  41,
  },
  {
    name:       "Smoke & Shadow",
    category:   "DARK",
    previewUrl: "/previews/smoke-shadow.mp4",
    promptBase: "moody smoke and shadow aesthetic, volumetric smoke tendrils, dramatic single-source lighting, deep blacks and dark navy, atmospheric haze, silhouette artistry, slow drifting fog, underground club ambiance, mysterious and sensual",
    sortOrder:  42,
  },
  {
    name:       "Underground",
    category:   "DARK",
    previewUrl: "/previews/underground.mp4",
    promptBase: "underground music scene aesthetic, raw industrial settings, exposed concrete and brick, stark fluorescent or red lighting, gritty authentic textures, chain-link and corrugated metal, unpolished documentary energy, warehouse rave atmosphere",
    sortOrder:  43,
  },

  // ── BRIGHT ────────────────────────────────────────────────────────────────
  {
    name:       "Pop Color Burst",
    category:   "BRIGHT",
    previewUrl: "/previews/pop-color-burst.mp4",
    promptBase: "pop art color burst aesthetic, hyper-saturated primary colors, bold graphic design sensibility, clean bright backgrounds, electric energy, confetti and paint splash elements, optimistic youthful vibe, high-key studio lighting, Instagram-era pop",
    sortOrder:  50,
  },
  {
    name:       "Pastel Dream",
    category:   "BRIGHT",
    previewUrl: "/previews/pastel-dream.mp4",
    promptBase: "pastel dream aesthetic, soft cotton candy color palette of lavender mint peach and baby blue, ethereal soft focus, dreamy overexposed whites, whimsical floral and cloud elements, delicate feminine energy, fairy tale visual language",
    sortOrder:  51,
  },
  {
    name:       "Tropical",
    category:   "BRIGHT",
    previewUrl: "/previews/tropical.mp4",
    promptBase: "tropical vibrant aesthetic, lush green jungle foliage, turquoise ocean waters, sun-drenched beach settings, vivid tropical flowers in orange and yellow, dappled natural sunlight through palms, warm humid atmosphere, Caribbean and coastal energy",
    sortOrder:  52,
  },
  {
    name:       "Festival",
    category:   "BRIGHT",
    previewUrl: "/previews/festival.mp4",
    promptBase: "music festival aesthetic, golden sunlight and crowd energy, colorful flags and banners, dusty warm haze, euphoric audience moments, stage lighting rigs and LED walls, communal celebration, Coachella and Glastonbury visual language, magic hour glow",
    sortOrder:  53,
  },
];

async function main() {
  let created = 0;
  for (const style of STYLES) {
    await db.videoStyle.upsert({
      where:  { name: style.name },
      update: {},
      create: style,
    });
    created++;
  }
  console.log(`Seeded ${created} VideoStyle records.`);
}

main().catch(console.error).finally(() => db.$disconnect());
