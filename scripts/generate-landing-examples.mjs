import falPkg from "@fal-ai/client";
const { fal: falClient } = falPkg;
import { PrismaClient } from "@prisma/client";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT  = path.join(ROOT, "public", "images", "cover-art-examples");

falClient.config({ credentials: "8f9bdedc-af3f-45bb-9ae4-ef33a5e7d7bd:bc5dd95f4e926f487628243d81f99c81" });
const fal = falClient;

const EXAMPLES = [
  {
    slug:   "hiphop-trap",
    genre:  "Hip-Hop / Trap",
    seed:   11317,
    prompt:
      "square format album cover art, dark atmospheric urban scene at 2am, " +
      "hooded figure standing motionless in a fog-filled concrete alley, " +
      "single sodium vapor streetlight overhead casting a harsh downward cone of amber light, " +
      "rain-wet pavement reflecting the light in distorted pools, " +
      "thick ground-level fog swallowing the figure from the knees down, " +
      "oppressive charcoal grey and desaturated amber palette, " +
      "steam rising from a nearby grate, cinematic and menacing, the silence is loud, " +
      "no text no words no letters no numbers, " +
      "professional album cover art, Kendrick Lamar TPAB visual weight, Drake Take Care mood",
  },
  {
    slug:   "rnb-soul",
    genre:  "R&B / Soul",
    seed:   23741,
    prompt:
      "square format album cover art, intimate fine art portrait study, " +
      "a woman's silhouette in perfect profile against absolute darkness, " +
      "warm amber candlelight illuminating the curve of her bare shoulder and jaw from directly behind, " +
      "soft wisps of smoke curling upward and dissolving into the dark, " +
      "rich velvety darkness filling 65 percent of the frame, " +
      "the light source unseen but deeply felt, " +
      "Caravaggio chiaroscuro rendered in photographic quality, " +
      "sensual and deeply emotional, velvet black surrounds everything, " +
      "no text no words no letters no numbers, " +
      "professional album cover art, Sade elegance, SZA intimacy, Frank Ocean feeling",
  },
  {
    slug:   "pop",
    genre:  "Pop",
    seed:   37159,
    prompt:
      "square format album cover art, bold vibrant digital illustration, " +
      "cascading explosion of tropical flowers bursting outward from the center of the frame, " +
      "hibiscus blooms in electric coral pink, bird of paradise in acid yellow, " +
      "monstera leaves in cobalt blue and emerald green, " +
      "dynamic diagonal energy radiating to every corner, " +
      "saturated vivid palette that demands attention, " +
      "confident modern graphic illustration meets botanical fine art, " +
      "joyful and alive with colour and movement, " +
      "no text no words no letters no numbers, " +
      "professional album cover art, Doja Cat visual confidence, Olivia Rodrigo energy",
  },
  {
    slug:   "indie-alternative",
    genre:  "Indie / Alternative",
    seed:   51283,
    prompt:
      "square format album cover art, Kodachrome 64 film photograph, " +
      "solitary figure walking away down an empty rural highway shot from behind, " +
      "golden hour sunlight flooding the landscape from the left horizon, " +
      "tall overgrown amber and green grass fields stretching wide on both sides, " +
      "the road ahead shrinks to nothing, the figure is small and alone against the vast open sky, " +
      "authentic 35mm film grain across the entire image, " +
      "colors softened and faded with age, warm light leak bleeding in from the left edge, " +
      "melancholy and enormous, the loneliness is beautiful, " +
      "no text no words no letters no numbers, " +
      "professional album cover art, Phoebe Bridgers Stranger in the Alps soul, Big Thief rawness",
  },
  {
    slug:   "electronic-edm",
    genre:  "Electronic / EDM",
    seed:   67433,
    prompt:
      "square format album cover art, abstract digital geometry, " +
      "infinite perspective grid receding to a single vanishing point at the exact center, " +
      "electric cobalt blue grid lines glowing against an absolute black void, " +
      "magenta and cyan horizontal light trails streaking across the mid-ground with motion, " +
      "a single luminous orb at the vanishing point radiating everything, " +
      "the grid breathes with kinetic energy, mathematically perfect and relentless, " +
      "no text no words no letters no numbers, " +
      "professional album cover art, Daft Punk Discovery era aesthetic, " +
      "Four Tet visual language, Aphex Twin geometric tension",
  },
  {
    slug:   "acoustic-singer-songwriter",
    genre:  "Acoustic / Singer-Songwriter",
    seed:   83561,
    prompt:
      "square format album cover art, master watercolor painting, " +
      "an acoustic guitar resting against a sunlit wooden window frame, " +
      "morning light pouring through the glass and dissolving at the edges " +
      "into soft watercolor washes of warm honey gold and pale sky blue, " +
      "wet-on-wet technique with organic paint blooms and natural soft edges, " +
      "the guitar rendered with quiet affection while the surrounding light melts into pure colour, " +
      "peaceful and deeply intimate, the feeling of a Sunday morning alone with music, " +
      "no text no words no letters no numbers, " +
      "professional album cover art, Bon Iver For Emma tenderness, " +
      "Julien Baker rawness, Iron and Wine warmth",
  },
];

async function run() {
  console.log(`Generating ${EXAMPLES.length} genre landing page examples with FLUX.1 [dev]\n`);

  for (let i = 0; i < EXAMPLES.length; i++) {
    const ex = EXAMPLES[i];
    const dest = path.join(OUT, `${ex.slug}.png`);
    console.log(`[${i + 1}/${EXAMPLES.length}] ${ex.genre}`);

    try {
      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt:                ex.prompt,
          image_size:            "square_hd",
          num_inference_steps:   30,
          guidance_scale:        3.5,
          num_images:            1,
          seed:                  ex.seed,
          enable_safety_checker: false,
        },
      });

      const url = result?.data?.images?.[0]?.url;
      if (!url) throw new Error("No image URL returned");

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const buf = await res.arrayBuffer();
      fs.writeFileSync(dest, Buffer.from(buf));
      console.log(`  ✓ Saved: ${ex.slug}.png (${Math.round(fs.statSync(dest).size / 1024)} KB)`);

      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }
  }

  console.log("\nDone. ~$" + (EXAMPLES.length * 0.025).toFixed(2) + " used.");
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
