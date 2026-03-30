// scripts/seed-dj.js — creates a test DJ profile + sets + crate + mix for local dev
// YouTube API used to seed real set videos with thumbnails
const { PrismaClient } = require("@prisma/client");
const https = require("https");

require("dotenv").config({ path: ".env.local" });
const db = new PrismaClient();

function ytFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function getYouTubeSets() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) { console.warn("No YOUTUBE_API_KEY — skipping sets"); return []; }

  const queries = [
    "house music DJ set live 2024",
    "hip hop DJ set live 2024",
    "techno DJ set live 2024",
  ];

  const results = [];
  for (const q of queries) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoDuration=long&maxResults=2&key=${key}`;
    const data = await ytFetch(url);
    if (data.error) { console.warn("YT error:", data.error.message); continue; }
    for (const item of data.items || []) {
      results.push({
        videoId: item.id.videoId,
        title: item.snippet.title.slice(0, 100),
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
      });
    }
  }
  return results;
}

async function main() {
  const userId = "cmnaylns301tpldzxsjpg9nwt"; // Jay Nova — artist@indiethis.dev

  // Enable DJ mode
  await db.user.update({
    where: { id: userId },
    data: { djMode: true, djDiscoveryOptIn: false },
  });

  // Upsert DJ profile
  const dj = await db.dJProfile.upsert({
    where: { userId },
    update: { slug: "jaynova-dj", bio: "House, techno & hip-hop. Resident at The Promontory Chicago. Booking: bookings@jaynova.com", isVerified: true, verificationStatus: "APPROVED", balance: 4250, totalEarnings: 12300 },
    create: {
      userId,
      slug: "jaynova-dj",
      bio: "House, techno & hip-hop. Resident at The Promontory Chicago. Booking: bookings@jaynova.com",
      genres: ["House", "Techno", "Hip-Hop"],
      city: "Chicago, IL",
      isVerified: true,
      verificationStatus: "APPROVED",
      balance: 4250,
      totalEarnings: 12300,
      socialLinks: {
        instagram: "https://instagram.com/jaynovadj",
        tiktok: "https://tiktok.com/@jaynovadj",
        soundcloud: "https://soundcloud.com/jaynovadj",
        twitter: "https://twitter.com/jaynovadj",
      },
    },
  });
  console.log("DJ Profile:", dj.id, dj.slug);

  // Fetch real YouTube set videos
  const ytSets = await getYouTubeSets();
  console.log(`Fetched ${ytSets.length} YouTube sets`);

  // Seed DJ sets from YouTube results
  await db.dJSet.deleteMany({ where: { djProfileId: dj.id } });
  const venues = ["The Promontory", "Smartbar", "Spybar", "Sound Bar", "Primary Chicago", "The Mid"];
  for (let i = 0; i < ytSets.length; i++) {
    const s = ytSets[i];
    const setDate = new Date();
    setDate.setDate(setDate.getDate() - (i + 1) * 14);
    await db.dJSet.create({
      data: {
        djProfileId: dj.id,
        title: s.title,
        videoUrl: `https://www.youtube.com/watch?v=${s.videoId}`,
        thumbnailUrl: s.thumbnail,
        venue: venues[i % venues.length],
        date: setDate,
        duration: 3600 + i * 600,
      },
    });
  }
  console.log(`Created ${ytSets.length} DJ sets`);

  // Seed upcoming events
  await db.dJEvent.deleteMany({ where: { djProfileId: dj.id } });
  const events = [
    { name: "Late Night Sessions Vol. 12", venue: "Smartbar", city: "Chicago, IL", daysOut: 7, time: "10:00 PM" },
    { name: "House Music Marathon", venue: "Primary Chicago", city: "Chicago, IL", daysOut: 21, time: "9:00 PM" },
    { name: "Underground Frequencies", venue: "The Promontory", city: "Chicago, IL", daysOut: 45, time: "11:00 PM" },
  ];
  for (const e of events) {
    const d = new Date();
    d.setDate(d.getDate() + e.daysOut);
    await db.dJEvent.create({
      data: {
        djProfileId: dj.id,
        name: e.name,
        venue: e.venue,
        city: e.city,
        date: d,
        time: e.time,
        ticketUrl: "https://ra.co",
        description: `${e.name} — live at ${e.venue}. Doors at 9PM.`,
      },
    });
  }
  console.log("Created 3 events");

  // Crate
  const crate = await db.crate.upsert({
    where: { id: "seed-crate-001" },
    update: {},
    create: {
      id: "seed-crate-001",
      djProfileId: dj.id,
      name: "Late Night Selections",
      description: "Deep cuts for the after-hours crowd.",
      isPublic: true,
    },
  });
  console.log("Crate:", crate.name);

  // Second crate
  const crate2 = await db.crate.upsert({
    where: { id: "seed-crate-002" },
    update: {},
    create: {
      id: "seed-crate-002",
      djProfileId: dj.id,
      name: "Morning Warmup",
      description: "Smooth openers for early sets.",
      isPublic: true,
    },
  });
  console.log("Crate 2:", crate2.name);

  // Add tracks to crate
  const tracks = await db.track.findMany({ take: 5 });
  for (let i = 0; i < tracks.length; i++) {
    await db.crateItem.upsert({
      where: { id: `seed-crate-item-${i}` },
      update: {},
      create: {
        id: `seed-crate-item-${i}`,
        crateId: crate.id,
        trackId: tracks[i].id,
        notes: i === 0 ? "Classic opener" : null,
      },
    });
  }
  // Add remaining tracks to crate 2
  const allTracks = await db.track.findMany({ take: 10 });
  const crate2Tracks = allTracks.slice(5);
  for (let i = 0; i < crate2Tracks.length; i++) {
    await db.crateItem.upsert({
      where: { id: `seed-crate2-item-${i}` },
      update: {},
      create: {
        id: `seed-crate2-item-${i}`,
        crateId: crate2.id,
        trackId: crate2Tracks[i].id,
        notes: null,
      },
    });
  }
  console.log(`Added ${tracks.length} tracks to crate 1, ${crate2Tracks.length} to crate 2`);

  // Use YouTube thumbnail for mix cover art
  const mixCover = ytSets.length > 0 ? ytSets[0].thumbnail : null;

  // Mix
  const mix = await db.dJMix.upsert({
    where: { id: "seed-mix-001" },
    update: { coverArtUrl: mixCover },
    create: {
      id: "seed-mix-001",
      djProfileId: dj.id,
      title: "Late Night Vol. 1",
      description: "90-minute live set at The Promontory, Chicago.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      coverArtUrl: mixCover,
      duration: 5400,
    },
  });
  console.log("Mix:", mix.title, mixCover ? "(with cover)" : "");

  // Second mix with different cover
  const mix2Cover = ytSets.length > 1 ? ytSets[1].thumbnail : null;
  await db.dJMix.upsert({
    where: { id: "seed-mix-002" },
    update: { coverArtUrl: mix2Cover },
    create: {
      id: "seed-mix-002",
      djProfileId: dj.id,
      title: "Sunrise Sessions Vol. 3",
      description: "Early morning deep house set. Recorded live at Spybar.",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      coverArtUrl: mix2Cover,
      duration: 7200,
    },
  });
  console.log("Mix 2: Sunrise Sessions Vol. 3");

  // Attributions (spread over 12 weeks for chart)
  await db.dJAttribution.deleteMany({ where: { fanSessionId: { startsWith: "seed-session-" } } });
  const now = new Date();
  const amounts = [90, 150, 200, 75, 120, 180, 90, 60, 110, 240, 85, 160];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const expires = new Date(d);
    expires.setDate(expires.getDate() + 30);
    await db.dJAttribution.create({
      data: {
        djProfileId: dj.id,
        fanSessionId: `seed-session-${i}`,
        sourceType: i % 3 === 0 ? "CRATE" : i % 3 === 1 ? "MIX" : "PROFILE",
        sourceId: i % 3 === 0 ? crate.id : i % 3 === 1 ? mix.id : dj.id,
        artistId: userId,
        amount: amounts[i],
        createdAt: d,
        expiresAt: expires,
      },
    });
  }
  console.log("Created 12 attribution records (12 weeks of chart data)");

  console.log("\nDone! Log in as artist@indiethis.dev");
  console.log("Pages to check:");
  console.log("  /dashboard/dj/analytics");
  console.log("  /dashboard/dj/sets");
  console.log("  /dashboard/dj/mixes");
  console.log("  /dashboard/dj/crates");
  console.log("  /dashboard/dj/events");
  console.log("  /dj/jaynova-dj  (public profile)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
