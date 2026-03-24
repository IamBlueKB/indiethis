/**
 * fix-demo-audio.ts
 * Patches all Beat and Track records whose fileUrl points at
 * the placeholder "https://example.com/seed/..." URLs so that
 * they cycle through the real demo WAV files in /public/demo/.
 *
 * Run:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/fix-demo-audio.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Real audio files served from /public/demo/
const DEMO_WAVS = [
  "/demo/midnight-drive.wav",
  "/demo/golden-hour.wav",
  "/demo/neon-nights.wav",
  "/demo/beat-128bpm.wav",
];

function demoUrl(index: number) {
  return DEMO_WAVS[index % DEMO_WAVS.length];
}

async function main() {
  console.log("\n🔧  Patching placeholder audio URLs to real demo files…\n");

  // ── All Tracks (beats and regular tracks share the same model) ───────────
  const tracks = await db.track.findMany({
    where: { fileUrl: { contains: "example.com" } },
    select: { id: true, title: true },
  });
  console.log(`Found ${tracks.length} Track(s) with placeholder fileUrl`);
  for (let i = 0; i < tracks.length; i++) {
    const url = demoUrl(i);
    await db.track.update({ where: { id: tracks[i].id }, data: { fileUrl: url } });
    console.log(`  ✓ "${tracks[i].title}" → ${url}`);
  }

  console.log("\n✅  Done.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
