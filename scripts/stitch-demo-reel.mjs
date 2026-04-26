/**
 * stitch-demo-reel.mjs
 * Stitches already-downloaded clips from tmp/demo-reel/ into the final demo video.
 * Run: node scripts/stitch-demo-reel.mjs
 */

import fs   from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

const FFMPEG  = "C:\\Users\\brian\\AppData\\Local\\CapCut\\Apps\\7.3.0.2974\\ffmpeg.exe";
const TMP_DIR = path.join(ROOT, "tmp", "demo-reel");
const OUT_DIR = path.join(ROOT, "public", "videos");
const OUT_FILE = path.join(OUT_DIR, "video-studio-demo.mp4");

// Find audio file
const audioDir  = path.join(ROOT, "public", "audio");
const audioFiles = fs.readdirSync(audioDir).filter(f => f.endsWith(".wav"));
const AUDIO = path.join(audioDir, audioFiles.find(f => !f.includes("(1)")) ?? audioFiles[0]);

fs.mkdirSync(OUT_DIR, { recursive: true });

const clips = ["scene-0-intro", "scene-1-verse", "scene-2-chorus", "scene-3-outro"]
  .map(n => path.join(TMP_DIR, `${n}.mp4`))
  .filter(p => fs.existsSync(p));

if (!clips.length) { console.error("No clips found in tmp/demo-reel/"); process.exit(1); }
console.log(`Found ${clips.length} clips`);

// Write concat list (stream-copy — no re-encode, Kling clips are already h264 1080p)
const concatList = path.join(TMP_DIR, "concat.txt");
fs.writeFileSync(concatList, clips.map(p => `file '${p.replace(/\\/g, "/").replace(/'/g, "\\'")}'`).join("\n"));

// Concat
console.log("Concatenating…");
const stitched = path.join(TMP_DIR, "stitched.mp4");
execSync(`"${FFMPEG}" -y -f concat -safe 0 -i "${concatList}" -c copy "${stitched}"`, { stdio: "pipe" });

// Mux with audio
console.log("Muxing with audio…");
execSync(`"${FFMPEG}" -y -i "${stitched}" -i "${AUDIO}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${OUT_FILE}"`, { stdio: "pipe" });

const mb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
console.log(`\n✅ Done! public/videos/video-studio-demo.mp4 (${mb} MB)`);
console.log("Ready to commit.");
