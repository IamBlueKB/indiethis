/**
 * generate-demo-video.mjs
 *
 * Generates a real music video from the demo track for the Video Studio landing page.
 * Output: public/videos/video-studio-demo.mp4
 *
 * Run: node scripts/generate-demo-video.mjs
 */

import { UTApi }       from "uploadthing/server";
import { PrismaClient } from "@prisma/client";
import fs              from "fs";
import path            from "path";
import { fileURLToPath } from "url";
import { spawn }       from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ─── Load env ────────────────────────────────────────────────────────────────

const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const AUDIO_DIR  = path.join(ROOT, "public", "audio");
const OUT_DIR    = path.join(ROOT, "public", "videos");
const OUT_FILE   = path.join(OUT_DIR, "video-studio-demo.mp4");
const DEV_PORT   = 3456;
const BASE_URL   = `http://localhost:${DEV_PORT}`;

// ─── Find audio file ─────────────────────────────────────────────────────────

const audioFiles = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith(".wav"));
if (!audioFiles.length) {
  console.error("❌ No WAV files found in public/audio/");
  process.exit(1);
}

// Prefer non-(1) version (longer track)
const audioFile  = audioFiles.find(f => !f.includes("(1)")) ?? audioFiles[0];
const audioPath  = path.join(AUDIO_DIR, audioFile);
const trackTitle = "Razor's Edge";

// Estimate duration from file size (WAV: 44100Hz 16-bit stereo)
const fileSize    = fs.statSync(audioPath).size;
const trackDuration = Math.round((fileSize - 44) / (44100 * 2 * 2));

console.log(`\n🎵 Audio: ${audioFile}`);
console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(1)} MB | ~${trackDuration}s`);

// ─── Upload audio to UploadThing ─────────────────────────────────────────────

console.log("\n📤 Uploading audio to UploadThing…");

const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN ?? process.env.UPLOADTHING_SECRET });

const buffer = fs.readFileSync(audioPath);
const blob   = new Blob([buffer], { type: "audio/wav" });
const file   = new File([blob], audioFile, { type: "audio/wav" });

let audioUrl;
try {
  const result = await utapi.uploadFiles(file);
  if (!result?.data?.ufsUrl && !result?.data?.url) {
    throw new Error(result?.error?.message ?? "Upload returned no URL");
  }
  audioUrl = result.data.ufsUrl ?? result.data.url;
  console.log(`   ✅ Uploaded: ${audioUrl}`);
} catch (err) {
  console.error("❌ UploadThing upload failed:", err.message);
  process.exit(1);
}

// ─── Create MusicVideo DB record ────────────────────────────────────────────

console.log("\n🗄️  Creating MusicVideo record…");

const db = new PrismaClient();

let video;
try {
  video = await db.musicVideo.create({
    data: {
      userId:        null,           // no user — bypasses ownership check on generate
      guestEmail:    "demo@indiethis.com",
      trackTitle,
      trackDuration,
      audioUrl,
      mode:          "QUICK",
      videoLength:   "STANDARD",
      style:         "Cinematic Noir",
      aspectRatio:   "16:9",
      status:        "PENDING",
      amount:        0,              // free — bypasses payment requirement
      progress:      0,
    },
  });
  console.log(`   ✅ Created: ${video.id}`);
} catch (err) {
  console.error("❌ DB create failed:", err.message);
  await db.$disconnect();
  process.exit(1);
}

await db.$disconnect();

// ─── Start dev server ────────────────────────────────────────────────────────

console.log(`\n🚀 Starting dev server on port ${DEV_PORT}…`);

// Check if already running
let serverRunning = false;
try {
  const check = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (check?.ok || check?.status) serverRunning = true;
} catch { /* not running */ }

let devProcess = null;
if (!serverRunning) {
  devProcess = spawn("npm", ["run", "dev", "--", "--port", String(DEV_PORT)], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
    shell: true, detached: false,
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timed out after 60s")), 60_000);
    const check = async () => {
      try {
        const r = await fetch(`${BASE_URL}/api/video-studio/styles`).catch(() => null);
        if (r) { clearTimeout(timeout); resolve(); return; }
      } catch { /* still starting */ }
      setTimeout(check, 2000);
    };
    setTimeout(check, 5000);
    devProcess.stderr.on("data", (d) => {
      const s = d.toString();
      if (s.includes("Ready") || s.includes("started")) { clearTimeout(timeout); resolve(); }
      if (s.includes("EADDRINUSE")) { clearTimeout(timeout); reject(new Error("Port in use")); }
    });
  });
  console.log("   ✅ Server ready");
} else {
  console.log("   ✅ Server already running");
}

// ─── Trigger generation ───────────────────────────────────────────────────────

console.log(`\n🎬 Triggering Quick Mode generation for video ${video.id}…`);

const genRes = await fetch(`${BASE_URL}/api/video-studio/${video.id}/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});

if (!genRes.ok) {
  const body = await genRes.text();
  console.error(`❌ Generate failed (${genRes.status}):`, body);
  devProcess?.kill();
  process.exit(1);
}

console.log("   ✅ Generation started");

// ─── Poll status ──────────────────────────────────────────────────────────────

console.log("\n⏳ Polling status (this takes ~10-15 minutes)…\n");

const POLL_INTERVAL = 10_000; // 10s
const MAX_WAIT      = 30 * 60 * 1000; // 30 min
const start         = Date.now();
let finalVideo      = null;

while (Date.now() - start < MAX_WAIT) {
  await new Promise(r => setTimeout(r, POLL_INTERVAL));

  try {
    const statusRes = await fetch(`${BASE_URL}/api/video-studio/${video.id}/status`);
    const data      = await statusRes.json();

    const elapsed = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`\r   [${elapsed}s] Status: ${data.status ?? "?"} | Progress: ${data.progress ?? 0}% | Step: ${data.currentStep ?? "—"}          `);

    if (data.status === "COMPLETE") {
      finalVideo = data;
      console.log("\n\n   ✅ Generation complete!");
      break;
    }

    if (data.status === "FAILED") {
      console.error("\n\n❌ Generation failed:", data.error ?? "Unknown error");
      devProcess?.kill();
      process.exit(1);
    }
  } catch (err) {
    // Ignore transient errors during polling
  }
}

if (!finalVideo) {
  console.error("\n❌ Timed out waiting for generation");
  devProcess?.kill();
  process.exit(1);
}

// ─── Download output MP4 ──────────────────────────────────────────────────────

console.log("\n📥 Downloading output MP4…");

const videoOutputUrl = finalVideo.finalVideoUrl ?? finalVideo.outputUrl ?? finalVideo.videoUrl;
if (!videoOutputUrl) {
  console.error("❌ No output URL in status response:", JSON.stringify(finalVideo, null, 2));
  devProcess?.kill();
  process.exit(1);
}

console.log(`   Source: ${videoOutputUrl}`);

const mp4Res = await fetch(videoOutputUrl);
if (!mp4Res.ok) {
  console.error(`❌ Failed to download MP4 (${mp4Res.status})`);
  devProcess?.kill();
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const mp4Buffer = Buffer.from(await mp4Res.arrayBuffer());
fs.writeFileSync(OUT_FILE, mp4Buffer);

console.log(`   ✅ Saved to public/videos/video-studio-demo.mp4 (${(mp4Buffer.length / 1024 / 1024).toFixed(1)} MB)`);

// ─── Cleanup ──────────────────────────────────────────────────────────────────

if (devProcess) devProcess.kill();

console.log("\n🎉 Done! The DemoReel component will now auto-play the video.");
console.log("   Commit: git add public/videos/video-studio-demo.mp4 && git commit -m 'Add Video Studio demo reel'\n");
