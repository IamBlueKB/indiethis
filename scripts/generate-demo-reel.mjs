/**
 * generate-demo-reel.mjs
 *
 * Directly generates 4 cinematic Kling 3.0 Pro clips matched to Razor's Edge
 * (F minor, 118 BPM, sections: intro/verse/chorus/outro), then stitches them
 * with ffmpeg into public/videos/video-studio-demo.mp4.
 *
 * Run: node scripts/generate-demo-reel.mjs
 */

import falPkg from "@fal-ai/client";
const { fal } = falPkg;
import fs    from "fs";
import path  from "path";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ─── Load env ────────────────────────────────────────────────────────────────

const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

const FAL_KEY = process.env.FAL_KEY ?? "8f9bdedc-af3f-45bb-9ae4-ef33a5e7d7bd:bc5dd95f4e926f487628243d81f99c81";
fal.config({ credentials: FAL_KEY });

// ─── ffmpeg path ──────────────────────────────────────────────────────────────
// Use CapCut's bundled ffmpeg since it's not in PATH
const FFMPEG = '"/c/Users/brian/AppData/Local/CapCut/Apps/7.3.0.2974/ffmpeg.exe"';

// ─── Paths ────────────────────────────────────────────────────────────────────

const TMP_DIR  = path.join(ROOT, "tmp", "demo-reel");
const OUT_DIR  = path.join(ROOT, "public", "videos");
const OUT_FILE = path.join(OUT_DIR, "video-studio-demo.mp4");
const AUDIO    = (() => {
  const dir   = path.join(ROOT, "public", "audio");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".wav"));
  return path.join(dir, files.find(f => !f.includes("(1)")) ?? files[0]);
})();

fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Scene prompts ────────────────────────────────────────────────────────────
// Razor's Edge: F minor, 118 BPM, 49s — dark cinematic, atmospheric, high quality
// Sections: intro (0–12s), verse (12–24s), chorus (24–37s), outro (37–49s)

const SCENES = [
  {
    label:    "intro",
    start:    0,
    end:      12,
    duration: 10,
    prompt:   "Slow cinematic drone shot over a midnight city, fog rolling through dark streets, neon signs reflecting on wet asphalt, ultra-wide anamorphic lens, 35mm film grain, cold blue and amber color grade, no people, moody atmospheric, music video aesthetic, ultra high quality",
  },
  {
    label:    "verse",
    start:    12,
    end:      24,
    duration: 10,
    prompt:   "A lone figure standing at the edge of a rooftop at night, city lights blurring below, slow push-in close-up on their silhouette, cinematic depth of field, dark film noir color grade, volumetric light cutting through smoke, music video cinematography, 4K ultra detailed, anamorphic",
  },
  {
    label:    "chorus",
    start:    24,
    end:      37,
    duration: 10,
    prompt:   "High-energy cinematic montage — slow motion rain falling on a neon-lit street at night, shattered glass fragments suspended in air catching light, pulse of golden light from an unseen source, dynamic camera movement, intense dramatic color grade, deep blacks and warm highlights, music video production quality, ultra HD",
  },
  {
    label:    "outro",
    start:    37,
    end:      49,
    duration: 8,
    prompt:   "Slow pull-back aerial shot over dark city skyline at golden hour, the lone figure now gone, fog reclaiming the rooftop, horizon fading to deep indigo, poetic and melancholic, cinematic widescreen, anamorphic lens flare, film grain, final music video frame, ultra high quality",
  },
];

const MODEL = "fal-ai/kling-video/v3/pro/text-to-video";

// ─── Generate scenes in parallel ─────────────────────────────────────────────

console.log(`\n🎬 Generating ${SCENES.length} cinematic scenes with Kling 3.0 Pro…`);
console.log(`   Track: Razor's Edge (F minor, 118 BPM, 49s)\n`);

async function generateScene(scene, idx) {
  console.log(`   [${idx + 1}/${SCENES.length}] ${scene.label} — ${scene.start}–${scene.end}s — generating…`);
  const result = await fal.subscribe(MODEL, {
    input: {
      prompt:       scene.prompt,
      duration:     scene.duration,
      aspect_ratio: "16:9",
    },
    pollInterval: 8000,
    logs: false,
  });
  const output   = result.data ?? result;
  const videoUrl = output?.video?.url ?? output?.url;
  if (!videoUrl) throw new Error(`Scene ${scene.label}: no video URL in response`);
  console.log(`   [${idx + 1}/${SCENES.length}] ✅ ${scene.label} done: ${videoUrl.substring(0, 60)}…`);
  return { ...scene, videoUrl };
}

let generatedScenes;
try {
  // Generate all 4 in parallel
  generatedScenes = await Promise.all(SCENES.map((s, i) => generateScene(s, i)));
} catch (err) {
  console.error("\n❌ Scene generation failed:", err.message);
  process.exit(1);
}

// ─── Download clips ───────────────────────────────────────────────────────────

console.log("\n📥 Downloading clips…");

const clipPaths = [];
for (let i = 0; i < generatedScenes.length; i++) {
  const scene    = generatedScenes[i];
  const clipPath = path.join(TMP_DIR, `scene-${i}-${scene.label}.mp4`);
  const res      = await fetch(scene.videoUrl);
  if (!res.ok) throw new Error(`Failed to download scene ${scene.label}: ${res.status}`);
  fs.writeFileSync(clipPath, Buffer.from(await res.arrayBuffer()));
  const sizeMB = (fs.statSync(clipPath).size / 1024 / 1024).toFixed(1);
  console.log(`   ✅ scene-${i}-${scene.label}.mp4 (${sizeMB} MB)`);
  clipPaths.push(clipPath);
}

// ─── Re-encode clips to consistent format ────────────────────────────────────

console.log("\n🔧 Normalising clips to 1920x1080 30fps…");

const normPaths = [];
for (let i = 0; i < clipPaths.length; i++) {
  const src  = clipPaths[i];
  const dst  = path.join(TMP_DIR, `norm-${i}.mp4`);
  execSync(
    `${FFMPEG} -y -i "${src}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" -r 30 -c:v libx264 -preset fast -crf 18 -an "${dst}"`,
    { stdio: "pipe" }
  );
  normPaths.push(dst);
  console.log(`   ✅ Normalised clip ${i + 1}/${clipPaths.length}`);
}

// ─── Create concat list ───────────────────────────────────────────────────────

const concatList = path.join(TMP_DIR, "concat.txt");
fs.writeFileSync(concatList, normPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));

// ─── Stitch clips + mux with audio ───────────────────────────────────────────

console.log("\n✂️  Stitching clips and muxing with audio…");

const stitchedNoAudio = path.join(TMP_DIR, "stitched.mp4");

// Concat all clips
execSync(
  `${FFMPEG} -y -f concat -safe 0 -i "${concatList}" -c copy "${stitchedNoAudio}"`,
  { stdio: "pipe" }
);

// Mux with audio (trim video to audio length, or pad audio with silence)
execSync(
  `${FFMPEG} -y -i "${stitchedNoAudio}" -i "${AUDIO}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${OUT_FILE}"`,
  { stdio: "pipe" }
);

const finalSizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
console.log(`\n🎉 Done! Saved to public/videos/video-studio-demo.mp4 (${finalSizeMB} MB)`);
console.log("\nNext steps:");
console.log("  git add public/videos/video-studio-demo.mp4");
console.log("  git commit -m 'Add Video Studio demo reel (Razor\\'s Edge, Kling 3.0 Pro, 4 cinematic scenes)'");
console.log("  git push\n");

// ─── Cleanup tmp ─────────────────────────────────────────────────────────────

fs.rmSync(TMP_DIR, { recursive: true, force: true });
