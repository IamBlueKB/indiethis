/**
 * Seed: YouTube Sync + Artist Videos
 *
 * Connects Tyler Rhodes (demo@indiethis.com) to the NCS YouTube channel
 * and inserts 5 synced videos. Links 2 to tracks, 1 to a beat.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-videos.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// NCS YouTube channel (No Copyright Sounds — UCM8geh8lAT9Qt2GWN75w1-w)
const NCS_CHANNEL_ID  = "UCM8geh8lAT9Qt2GWN75w1-w";
const NCS_CHANNEL_URL = "https://www.youtube.com/@NCSMusic";
const NCS_CHANNEL_NAME = "NoCopyrightSounds";

// Real NCS video IDs (hardcoded — no API key needed for seed)
const SEED_VIDEOS = [
  {
    youtubeVideoId: "NlDOL4L_9zU",
    title:          "Elektronomia - Sky High",
    description:    "NCS Release [NCS: Music Without Limitations]",
    publishedAt:    new Date("2015-08-14"),
  },
  {
    youtubeVideoId: "TW9d8vYrVFQ",
    title:          "Alan Walker - Fade",
    description:    "NCS Release — Alan Walker's debut single on NCS.",
    publishedAt:    new Date("2014-08-25"),
  },
  {
    youtubeVideoId: "ywMGJe2m8GI",
    title:          "DEAF KEV - Invincible",
    description:    "NCS Release [NCS: Music Without Limitations]",
    publishedAt:    new Date("2016-04-09"),
  },
  {
    youtubeVideoId: "EPLMoKpIFSE",
    title:          "Janji - Heroes Tonight (feat. Johnning)",
    description:    "NCS Release [NCS: Music Without Limitations]",
    publishedAt:    new Date("2015-10-29"),
  },
  {
    youtubeVideoId: "yJg-Y5byMMw",
    title:          "Vanze - Forever (feat. Brenton Mattheus)",
    description:    "NCS Release [NCS: Music Without Limitations]",
    publishedAt:    new Date("2017-02-19"),
  },
];

async function main() {
  console.log("🌱 Seeding YouTube sync data for Tyler Rhodes…");

  // Find Tyler Rhodes
  const artist = await db.user.findUnique({
    where:  { email: "demo@indiethis.com" },
    select: { id: true, name: true },
  });

  if (!artist) {
    console.error("❌ Artist demo@indiethis.com not found. Skipping seed.");
    return;
  }

  console.log(`  Artist: ${artist.name} (${artist.id})`);

  // Upsert YouTubeSync record
  await db.youTubeSync.upsert({
    where:  { userId: artist.id },
    create: {
      userId:        artist.id,
      channelId:     NCS_CHANNEL_ID,
      channelUrl:    NCS_CHANNEL_URL,
      channelName:   NCS_CHANNEL_NAME,
      syncStatus:    "SYNCED",
      totalVideos:   SEED_VIDEOS.length,
      lastSyncedAt:  new Date(),
      nextSyncAt:    new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {
      channelId:     NCS_CHANNEL_ID,
      channelUrl:    NCS_CHANNEL_URL,
      channelName:   NCS_CHANNEL_NAME,
      syncStatus:    "SYNCED",
      totalVideos:   SEED_VIDEOS.length,
      lastSyncedAt:  new Date(),
      nextSyncAt:    new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log("  ✅ YouTubeSync record upserted");

  // Get Tyler's first 2 tracks for linking
  const tracks = await db.track.findMany({
    where:   { artistId: artist.id },
    orderBy: { createdAt: "asc" },
    take:    2,
    select:  { id: true, title: true },
  });

  // Get first beat (Track with BeatLeaseSettings) for linking
  const beat = await db.track.findFirst({
    where: {
      artistId:          artist.id,
      beatLeaseSettings: { isNot: null },
    },
    select: { id: true, title: true },
  });

  // Delete existing seed videos (clean re-seed)
  await db.artistVideo.deleteMany({
    where: { artistId: artist.id, syncedFromYouTube: true },
  });

  // Insert seed videos
  let count = 0;
  for (let i = 0; i < SEED_VIDEOS.length; i++) {
    const v = SEED_VIDEOS[i];
    const thumbUrl = `https://img.youtube.com/vi/${v.youtubeVideoId}/mqdefault.jpg`;
    const embedUrl = `https://www.youtube.com/embed/${v.youtubeVideoId}`;
    const videoUrl = `https://www.youtube.com/watch?v=${v.youtubeVideoId}`;

    const data: Parameters<typeof db.artistVideo.create>[0]["data"] = {
      artistId:         artist.id,
      title:            v.title,
      description:      v.description,
      videoUrl,
      thumbnailUrl:     thumbUrl,
      embedUrl,
      type:             "YOUTUBE",
      syncedFromYouTube: true,
      youtubeVideoId:   v.youtubeVideoId,
      sortOrder:        i,
      createdAt:        v.publishedAt,
      isPublished:      true,
    };

    // Link first video to first track
    if (i === 0 && tracks[0]) {
      data.linkedTrackId = tracks[0].id;
      console.log(`  Linking video 0 ("${v.title}") → track "${tracks[0].title}"`);
    }

    // Link second video to second track
    if (i === 1 && tracks[1]) {
      data.linkedTrackId = tracks[1].id;
      console.log(`  Linking video 1 ("${v.title}") → track "${tracks[1].title}"`);
    }

    // Link third video to beat
    if (i === 2 && beat) {
      data.linkedBeatId = beat.id;
      console.log(`  Linking video 2 ("${v.title}") → beat "${beat.title}"`);
    }

    await db.artistVideo.create({ data });
    count++;
  }

  console.log(`  ✅ Inserted ${count} synced videos`);

  // Verify
  const ytSync  = await db.youTubeSync.findUnique({ where: { userId: artist.id } });
  const vidCount = await db.artistVideo.count({ where: { artistId: artist.id, syncedFromYouTube: true } });
  const linked  = await db.artistVideo.count({ where: { artistId: artist.id, NOT: { linkedTrackId: null } } });

  console.log(`\n✅ Verification:`);
  console.log(`   YouTubeSync status:  ${ytSync?.syncStatus}`);
  console.log(`   YouTubeSync channel: ${ytSync?.channelName} (${ytSync?.channelId})`);
  console.log(`   Synced videos:       ${vidCount}`);
  console.log(`   Videos with links:   ${linked}`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
