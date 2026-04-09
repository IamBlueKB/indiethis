/**
 * generate-style-previews.mjs
 *
 * Generates one world-class fal.ai image per CoverArtStyle and saves it to
 * /public/images/cover-art-examples/<slug>.png, then updates previewUrl in DB.
 *
 * Uses FLUX.1 [dev] — highest quality model for these permanent showcase images.
 *
 * Run: node scripts/generate-style-previews.mjs
 */

import falPkg from "@fal-ai/client";
const { fal: falClient } = falPkg;
import { PrismaClient } from "@prisma/client";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Setup ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const OUT_DIR   = path.join(ROOT, "public", "images", "cover-art-examples");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const FAL_KEY = process.env.FAL_KEY ?? "8f9bdedc-af3f-45bb-9ae4-ef33a5e7d7bd:bc5dd95f4e926f487628243d81f99c81";
falClient.config({ credentials: FAL_KEY });
const fal = falClient;
const db  = new PrismaClient();

// ─── Style slug helper ────────────────────────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ─── Art-directed prompts — crafted for professional album cover quality ───────
//
// Rules enforced in every prompt:
//   - NO text, NO words, NO letters, NO titles, NO numbers
//   - Perfect 1:1 square composition
//   - Spotify / Apple Music / Bandcamp professional standard
//   - Specific lighting, mood, palette, and artistic reference

const PROMPTS = {

  "Minimalist Typography":
    "square format album cover art, single perfect brushed-gold circle suspended in infinite matte black space, " +
    "razor-sharp geometric edge, extreme negative space commanding the composition, " +
    "deep obsidian black background with the faintest surface texture, " +
    "ultra premium minimalist aesthetic, Dieter Rams design philosophy, " +
    "museum gallery quality, no text, no words, no letters, no numbers, " +
    "pure visual silence, breathtaking in its restraint",

  "Monochrome Film":
    "square format album cover art, black and white fine art portrait photograph, " +
    "face emerging dramatically from near-total darkness, single narrow beam of window light " +
    "crossing the left cheekbone and eye, deep velvety blacks surrounding luminous skin, " +
    "visible Kodak Tri-X 400 film grain across the entire image, " +
    "Sebastião Salgado documentary gravitas, silver gelatin darkroom print quality, " +
    "no text, no words, no letters, no numbers, " +
    "timeless and deeply human, haunting tonal range",

  "Clean Gradient":
    "square format album cover art, flawless two-tone color wash, " +
    "deep midnight indigo at top corner dissolving into warm blush rose gold at the opposite corner, " +
    "the transition is impossibly smooth with the faintest watercolor grain, " +
    "open breathing composition with soft atmospheric depth, " +
    "contemporary Scandinavian gallery aesthetic, serene and sophisticated, " +
    "no text, no words, no letters, no numbers, " +
    "calming premium feel, perfect color harmony",

  "Dark & Gritty":
    "square format album cover art, extreme macro photograph of brutally weathered concrete, " +
    "deep fissures cutting across the surface like fault lines, " +
    "rust streaks bleeding down from corroded rebar within, " +
    "single harsh spotlight raking across at 15 degrees casting dramatic shadows in every crack, " +
    "desaturated palette with only the rust retaining any warmth, " +
    "raw industrial visceral energy, no text, no words, no letters, no numbers, " +
    "deeply tactile and intense, urban decay at its most cinematic",

  "Smoke & Shadow":
    "square format album cover art, vast dark space filled with dense volumetric smoke and fog, " +
    "a single narrow beam of amber light descends from directly above, " +
    "illuminating particles of smoke in a perfect column, " +
    "a lone human silhouette stands at the base of the light column, " +
    "completely surrounded by darkness on all sides, " +
    "deep navy, charcoal and warm amber palette, " +
    "cinematic god-ray lighting, mysterious and deeply atmospheric, " +
    "no text, no words, no letters, no numbers, sensual and haunting",

  "Gothic Portrait":
    "square format album cover art, baroque oil painting rendered with photographic realism, " +
    "dramatic portrait subject lit solely by candlelight from below, " +
    "shadows consuming 65% of the frame in pure blackness, " +
    "oxblood burgundy and aged gold accents in ornate background details, " +
    "cracked antique varnish texture over the entire composition, " +
    "Caravaggio chiaroscuro technique, Old Masters gravitas, " +
    "no text, no words, no letters, no numbers, " +
    "powerful and haunting, timeless dark romanticism",

  "Vibrant Illustrated":
    "square format album cover art, bold contemporary digital illustration, " +
    "abstract figure with flowing hair fragmenting into geometric shards and dynamic brushstrokes, " +
    "electric magenta and cobalt blue as dominant palette, " +
    "acid yellow bursts at key focal points, confident expressive linework, " +
    "diagonal energy cutting through the composition, " +
    "Jean-Michel Basquiat energy meets Tadashi Torii precision, " +
    "no text, no words, no letters, no numbers, " +
    "vivid saturated and utterly alive, gallery-quality digital art",

  "Neon Futuristic":
    "square format album cover art, rain-soaked narrow Tokyo alley at 3am, " +
    "neon light reflections stretching endlessly across wet black pavement, " +
    "electric cyan and deep magenta neon sources out of frame, " +
    "lone figure in a dark long coat walking away into the luminous haze, " +
    "foreground puddles reflecting the entire scene like a mirror, " +
    "no visible signage, no text, no words, no letters, no numbers, " +
    "Blade Runner 2049 cinematography, ultra-detailed atmosphere, " +
    "futuristic melancholy and beauty",

  "Psychedelic":
    "square format album cover art, high-speed liquid paint pour photography, " +
    "perfect radial mandala explosion from center of frame, " +
    "electric magenta swirling into acid yellow into deep violet into electric cyan, " +
    "no two colors mixing to create mud, each transition luminous and pure, " +
    "analog fluid art captured at 1/8000s shutter speed, " +
    "the entire image is the art, no subject needed, " +
    "no text, no words, no letters, no numbers, " +
    "mind-bending optical depth, 60s psychedelic elevated to fine art photography",

  "Vintage Vinyl":
    "square format album cover art, warm Kodachrome 64 film photograph, " +
    "late afternoon golden hour, lone country road cutting through amber wheat fields, " +
    "sun positioned just off-frame creating beautiful lens flare, " +
    "natural film light leaks bleeding warm orange along the left edge, " +
    "faded color saturation with lifted shadows, " +
    "genuine photographic grain of expired 1970s stock, " +
    "romantic and deeply nostalgic, no text, no words, no letters, no numbers, " +
    "timeless Americana, Ektachrome warmth and soul",

  "Street Photography":
    "square format album cover art, decisive moment documentary photography, " +
    "New York City street at blue hour, steam rising from a subway grate, " +
    "solitary figure mid-stride under a cone of sodium vapor streetlight, " +
    "rain-wet asphalt reflecting orange and white light sources, " +
    "motion blur on passing cars in background, sharp subject, " +
    "available light only, no flash, deeply authentic urban moment, " +
    "no text, no signs, no words, no letters, no numbers, " +
    "Henri Cartier-Bresson compositional instinct, raw and true",

  "Photo-Real Portrait":
    "square format album cover art, studio fine art portrait photography, " +
    "face filling 70% of the frame, direct and unblinking eye contact with the camera, " +
    "split lighting with deep Rembrandt shadow on one side, " +
    "warm golden key light defining cheekbone and jaw with precision, " +
    "creamy out-of-focus studio backdrop, ultra-shallow depth of field, " +
    "every pore and eyelash rendered in perfect detail, " +
    "Hasselblad H6D medium format quality, no text, no words, no letters, no numbers, " +
    "intimate and commanding, the definitive portrait album cover",

  "Abstract Geometric":
    "square format album cover art, hard-edge geometric abstraction, " +
    "bold composition of overlapping triangles and hexagonal forms, " +
    "deep navy blue, architectural crimson red, and burnished gold palette, " +
    "razor-precise clean edges with zero anti-aliasing, " +
    "strong visual hierarchy from lower-left to upper-right, " +
    "Bauhaus 1923 meets contemporary Swiss graphic design, " +
    "Josef Albers color relationship theory in action, " +
    "no text, no words, no letters, no numbers, " +
    "commanding and mathematically beautiful, museum-quality art",

  "Collage Mixed Media":
    "square format album cover art, richly layered analog collage composition, " +
    "torn vintage botanical engravings overlapping with splashes of cobalt blue acrylic, " +
    "aged sepia photograph fragments with torn deckled edges, " +
    "burnt orange paint strokes cutting diagonally across the layers, " +
    "handmade quality with tactile depth, you can feel the layers, " +
    "warm ochre and deep teal as anchoring palette, " +
    "no legible text, no words, no readable letters, no numbers anywhere, " +
    "visually rich and endlessly rewarding, contemporary fine art collage",

  "Watercolor Dreamy":
    "square format album cover art, master-level loose watercolor painting, " +
    "abstract cherry blossom branches dissolving at their edges into pure color, " +
    "pale blush pink bleeding freely into misty lavender and sage green, " +
    "genuine wet-on-wet technique with natural blooms and backruns, " +
    "soft morning light washing through the entire composition, " +
    "white paper breathing through unpainted areas, " +
    "Alvaro Castagnet expressive looseness with botanical delicacy, " +
    "no text, no words, no letters, no numbers, " +
    "ethereal and dreamlike, the most tender album cover imaginable",

};

// ─── Generate one image via FLUX.1 [dev] ─────────────────────────────────────

async function generateOne(styleName, seed) {
  const prompt = PROMPTS[styleName];
  if (!prompt) throw new Error(`No prompt defined for: ${styleName}`);

  console.log(`  Generating with FLUX.1 [dev]…`);

  try {
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size:        "square_hd",   // 1024×1024
        num_inference_steps: 28,
        guidance_scale:    3.5,
        num_images:        1,
        seed,
        enable_safety_checker: false,
      },
    });

    const url = result?.data?.images?.[0]?.url;
    if (!url) {
      throw new Error(
        `No image URL returned. Data: ${JSON.stringify(result?.data).slice(0, 200)}`
      );
    }
    return url;
  } catch (err) {
    if (err?.body) console.error(`  fal error:`, JSON.stringify(err.body).slice(0, 300));
    throw err;
  }
}

// ─── Download and save ────────────────────────────────────────────────────────

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buf));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const styles = await db.coverArtStyle.findMany({ orderBy: { sortOrder: "asc" } });
  console.log(`Generating ${styles.length} cover art style previews with FLUX.1 [dev]\n`);
  console.log(`Output: ${OUT_DIR}\n${"─".repeat(60)}`);

  let ok = 0;
  let fail = 0;

  for (const style of styles) {
    const slug      = toSlug(style.name);
    const filename  = `${slug}.png`;
    const filepath  = path.join(OUT_DIR, filename);
    const publicPath = `/images/cover-art-examples/${filename}`;

    console.log(`\n[${style.sortOrder}/15] ${style.name}`);

    // Skip if already generated and DB is updated
    if (fs.existsSync(filepath) && style.previewUrl === publicPath) {
      console.log(`  ✓ Already done — skipping`);
      ok++;
      continue;
    }

    try {
      // Deterministic seed per style
      const seed = style.sortOrder * 3571;

      const falUrl = await generateOne(style.name, seed);
      console.log(`  Downloading…`);
      await downloadImage(falUrl, filepath);

      const kb = (fs.statSync(filepath).size / 1024).toFixed(0);
      console.log(`  Saved: ${filename} (${kb} KB)`);

      await db.coverArtStyle.update({
        where: { id: style.id },
        data:  { previewUrl: publicPath },
      });
      console.log(`  ✓ DB updated`);

      ok++;

      // Brief pause between calls
      await new Promise(r => setTimeout(r, 800));

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Complete. ✓ ${ok} generated  ✗ ${fail} failed`);
  console.log(`Cost: ~$${(ok * 0.025).toFixed(2)} of your $10 balance used`);

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await db.$disconnect();
  process.exit(1);
});
