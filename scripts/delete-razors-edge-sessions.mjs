/**
 * Delete all MusicVideo sessions for Razor's Edge and inspect cached Track data.
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = join(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const eq = trimmed.indexOf("=");
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  // Find all MusicVideo records with "Razor" in the title
  const videos = await db.musicVideo.findMany({
    where: { trackTitle: { contains: "Razor", mode: "insensitive" } },
    select: {
      id: true, trackTitle: true, status: true,
      bpm: true, musicalKey: true, energy: true,
      trackId: true, songStructure: true, createdAt: true,
    },
  });

  console.log(`\nFound ${videos.length} MusicVideo session(s) for "Razor":\n`);
  for (const v of videos) {
    const ss = v.songStructure;
    console.log(`  ID: ${v.id}`);
    console.log(`  Title: ${v.trackTitle}`);
    console.log(`  Status: ${v.status}`);
    console.log(`  BPM: ${v.bpm} | Key: ${v.musicalKey} | Energy: ${v.energy}`);
    console.log(`  trackId: ${v.trackId ?? "(none)"}`);
    if (ss && typeof ss === "object") {
      console.log(`  songStructure.bpm: ${ss.bpm}`);
      console.log(`  songStructure.genres: ${JSON.stringify(ss.genres)}`);
      console.log(`  songStructure.moods:  ${JSON.stringify(ss.moods)}`);
    } else {
      console.log(`  songStructure: ${ss === null ? "NULL" : "present"}`);
    }
    console.log(`  Created: ${v.createdAt}\n`);
  }

  // Check linked Track records
  const trackIds = [...new Set(videos.filter(v => v.trackId).map(v => v.trackId))];
  if (trackIds.length > 0) {
    console.log(`Linked Track records:\n`);
    for (const tid of trackIds) {
      const track = await db.track.findUnique({
        where: { id: tid },
        select: {
          id: true, title: true, bpm: true, musicalKey: true,
          essentiaGenres: true, essentiaMoods: true,
          essentiaVoice: true, essentiaTimbre: true,
          audioFeatures: { select: { energy: true } },
        },
      });
      if (track) {
        console.log(`  Track ID: ${track.id} | Title: ${track.title}`);
        console.log(`  BPM: ${track.bpm} | Key: ${track.musicalKey} | energy: ${track.audioFeatures?.energy ?? "null"}`);
        console.log(`  essentiaGenres: ${JSON.stringify(track.essentiaGenres)}`);
        console.log(`  essentiaMoods:  ${JSON.stringify(track.essentiaMoods)}`);
        console.log(`  essentiaVoice:  ${track.essentiaVoice}`);
        console.log(`  essentiaTimbre: ${track.essentiaTimbre}\n`);
      }
    }
  }

  // Delete the sessions
  if (videos.length > 0) {
    const ids = videos.map(v => v.id);
    const deleted = await db.musicVideo.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${deleted.count} MusicVideo session(s).\n`);
  } else {
    // Broader look at recent sessions
    const all = await db.musicVideo.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, trackTitle: true, status: true, createdAt: true },
    });
    console.log("No 'Razor' sessions found. Last 10 MusicVideo records:");
    for (const v of all) {
      console.log(`  ${v.id} | "${v.trackTitle}" | ${v.status} | ${v.createdAt}`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
