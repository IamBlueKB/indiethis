/**
 * seed-overlay-test.ts
 *
 * Populates all test tracks with full overlay data:
 * - Track credits + metadata (bpm, key, genre, producer, songwriter, featuredArtists)
 * - AudioFeatures records for the radar chart
 * - One DigitalProduct linked to a track (Buy button)
 * - Three CrateItems on "Midnight Drive" (DJ badge)
 *
 * Run: npx tsx scripts/seed-overlay-test.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Realistic per-track data so each radar looks different
const TRACK_DATA: Record<string, {
  bpm: number; musicalKey: string; genre: string;
  producer: string; songwriter: string; featuredArtists: string;
  coverArtUrl?: string;
  af: {
    loudness: number; energy: number; danceability: number;
    acousticness: number; instrumentalness: number; speechiness: number;
    liveness: number; valence: number; genre: string; mood: string; isVocal: boolean;
  };
}> = {
  "Midnight Drive": {
    bpm: 92,  musicalKey: "F Minor",   genre: "R&B",
    producer: "DJ Dahi", songwriter: "Bryson Tiller", featuredArtists: "SZA",
    coverArtUrl: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=600&q=80",
    af: { loudness:0.68, energy:0.55, danceability:0.72, acousticness:0.38, instrumentalness:0.08, speechiness:0.12, liveness:0.14, valence:0.44, genre:"R&B", mood:"Melancholic", isVocal:true },
  },
  "Golden Hour": {
    bpm: 105, musicalKey: "A Major",   genre: "Soul",
    producer: "No I.D.", songwriter: "H.E.R.", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80",
    af: { loudness:0.60, energy:0.48, danceability:0.65, acousticness:0.55, instrumentalness:0.04, speechiness:0.09, liveness:0.11, valence:0.72, genre:"Soul", mood:"Uplifting", isVocal:true },
  },
  "Neon Nights": {
    bpm: 138, musicalKey: "Eb Minor",  genre: "Electronic",
    producer: "Skrillex", songwriter: "", featuredArtists: "Diplo",
    coverArtUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80",
    af: { loudness:0.88, energy:0.93, danceability:0.82, acousticness:0.05, instrumentalness:0.75, speechiness:0.06, liveness:0.22, valence:0.58, genre:"Electronic", mood:"Energetic", isVocal:false },
  },
  "City Lights": {
    bpm: 120, musicalKey: "G Major",   genre: "Pop",
    producer: "Max Martin", songwriter: "Olivia Rodrigo", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80",
    af: { loudness:0.75, energy:0.78, danceability:0.80, acousticness:0.18, instrumentalness:0.02, speechiness:0.08, liveness:0.15, valence:0.81, genre:"Pop", mood:"Happy", isVocal:true },
  },
  "Ocean Waves": {
    bpm: 80,  musicalKey: "D Major",   genre: "Lo-Fi",
    producer: "Knxwledge", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80",
    af: { loudness:0.42, energy:0.32, danceability:0.58, acousticness:0.72, instrumentalness:0.88, speechiness:0.04, liveness:0.08, valence:0.55, genre:"Lo-Fi", mood:"Calm", isVocal:false },
  },
  "808 Vibez": {
    bpm: 145, musicalKey: "C Minor",   genre: "Trap",
    producer: "Metro Boomin", songwriter: "Future", featuredArtists: "Young Thug",
    coverArtUrl: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=600&q=80",
    af: { loudness:0.85, energy:0.88, danceability:0.76, acousticness:0.06, instrumentalness:0.15, speechiness:0.42, liveness:0.12, valence:0.35, genre:"Trap", mood:"Dark", isVocal:true },
  },
  "Trap Wave": {
    bpm: 150, musicalKey: "Bb Minor",  genre: "Trap",
    producer: "Southside", songwriter: "Gunna", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&q=80",
    af: { loudness:0.82, energy:0.85, danceability:0.74, acousticness:0.04, instrumentalness:0.20, speechiness:0.38, liveness:0.10, valence:0.30, genre:"Trap", mood:"Dark", isVocal:true },
  },
  "Night Ride": {
    bpm: 98,  musicalKey: "Ab Major",  genre: "Hip-Hop",
    producer: "Pharrell", songwriter: "Kendrick Lamar", featuredArtists: "Anderson .Paak",
    coverArtUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
    af: { loudness:0.70, energy:0.65, danceability:0.78, acousticness:0.22, instrumentalness:0.05, speechiness:0.28, liveness:0.18, valence:0.60, genre:"Hip-Hop", mood:"Chill", isVocal:true },
  },
  "Soul Sample": {
    bpm: 88,  musicalKey: "E Minor",   genre: "Soul",
    producer: "9th Wonder", songwriter: "Erykah Badu", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80",
    af: { loudness:0.55, energy:0.50, danceability:0.68, acousticness:0.48, instrumentalness:0.10, speechiness:0.14, liveness:0.20, valence:0.62, genre:"Soul", mood:"Nostalgic", isVocal:true },
  },
  "R&B Groove": {
    bpm: 95,  musicalKey: "Db Major",  genre: "R&B",
    producer: "Timbaland", songwriter: "Aaliyah", featuredArtists: "Missy Elliott",
    coverArtUrl: "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=600&q=80",
    af: { loudness:0.65, energy:0.60, danceability:0.82, acousticness:0.30, instrumentalness:0.06, speechiness:0.16, liveness:0.13, valence:0.68, genre:"R&B", mood:"Romantic", isVocal:true },
  },
  "Latin Drill": {
    bpm: 144, musicalKey: "C# Minor",  genre: "Drill",
    producer: "Central Cee", songwriter: "Unknown T", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80",
    af: { loudness:0.80, energy:0.84, danceability:0.71, acousticness:0.08, instrumentalness:0.18, speechiness:0.40, liveness:0.09, valence:0.28, genre:"Drill", mood:"Aggressive", isVocal:true },
  },
  // Beat pack tracks
  "Dark Matter": {
    bpm: 140, musicalKey: "D Minor",   genre: "Hip-Hop",
    producer: "Test Artist", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&q=80",
    af: { loudness:0.78, energy:0.80, danceability:0.68, acousticness:0.10, instrumentalness:0.82, speechiness:0.05, liveness:0.08, valence:0.25, genre:"Hip-Hop", mood:"Dark", isVocal:false },
  },
  "Solar Funk": {
    bpm: 112, musicalKey: "F# Major",  genre: "Funk",
    producer: "Test Artist", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&q=80",
    af: { loudness:0.72, energy:0.82, danceability:0.88, acousticness:0.25, instrumentalness:0.70, speechiness:0.07, liveness:0.25, valence:0.85, genre:"Funk", mood:"Uplifting", isVocal:false },
  },
  "Glass Grid": {
    bpm: 160, musicalKey: "B Minor",   genre: "Electronic",
    producer: "Test Artist", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80",
    af: { loudness:0.84, energy:0.90, danceability:0.75, acousticness:0.06, instrumentalness:0.92, speechiness:0.04, liveness:0.12, valence:0.50, genre:"Electronic", mood:"Tense", isVocal:false },
  },
  "Night Market": {
    bpm: 128, musicalKey: "G Minor",   genre: "Afrobeats",
    producer: "Test Artist", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
    af: { loudness:0.74, energy:0.77, danceability:0.86, acousticness:0.20, instrumentalness:0.45, speechiness:0.10, liveness:0.30, valence:0.75, genre:"Afrobeats", mood:"Energetic", isVocal:false },
  },
  "Ocean Drive": {
    bpm: 100, musicalKey: "A Minor",   genre: "Chill",
    producer: "Test Artist", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=600&q=80",
    af: { loudness:0.50, energy:0.45, danceability:0.62, acousticness:0.60, instrumentalness:0.78, speechiness:0.05, liveness:0.10, valence:0.65, genre:"Chill", mood:"Calm", isVocal:false },
  },
  "Pulse": {
    bpm: 132, musicalKey: "E Major",   genre: "Electronic",
    producer: "Test Artist", songwriter: "", featuredArtists: "",
    coverArtUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80",
    af: { loudness:0.80, energy:0.87, danceability:0.80, acousticness:0.08, instrumentalness:0.88, speechiness:0.05, liveness:0.16, valence:0.60, genre:"Electronic", mood:"Energetic", isVocal:false },
  },
};

async function main() {
  console.log("\n🌱  Seeding overlay test data…\n");

  // 1. Update all tracks with metadata + credits
  const tracks = await db.track.findMany({ select: { id: true, title: true } });

  for (const track of tracks) {
    const d = TRACK_DATA[track.title];
    if (!d) { console.log(`  ⚠  No seed data for "${track.title}" — skipping`); continue; }

    await db.track.update({
      where: { id: track.id },
      data: {
        bpm:            d.bpm,
        musicalKey:     d.musicalKey,
        genre:          d.genre,
        producer:       d.producer   || null,
        songwriter:     d.songwriter || null,
        featuredArtists:d.featuredArtists || null,
        ...(d.coverArtUrl ? { coverArtUrl: d.coverArtUrl } : {}),
        fileUrl:        "/demo/midnight-drive.wav",
      },
    });

    // 2. Upsert AudioFeatures
    await db.audioFeatures.upsert({
      where:  { trackId: track.id },
      update: d.af,
      create: { trackId: track.id, ...d.af },
    });

    console.log(`  ✅  ${track.title}`);
  }

  // 3. Ensure a DigitalProduct linked to "Dark Matter" (Buy button test)
  const darkMatter = tracks.find(t => t.title === "Dark Matter");
  if (darkMatter) {
    const artist = await db.track.findUnique({
      where: { id: darkMatter.id },
      select: { artistId: true },
    });
    if (artist) {
      const existing = await db.digitalProduct.findFirst({
        where: { tracks: { some: { id: darkMatter.id } } },
      });
      if (!existing) {
        await db.digitalProduct.create({
          data: {
            userId:      artist.artistId,
            type:        "SINGLE",
            title:       "Dark Matter — Single",
            price:       999,   // cents → $9.99
            producer:    "Test Artist",
            songwriter:  "",
            published:   true,
            tracks:      { connect: { id: darkMatter.id } },
          },
        });
        console.log("  ✅  DigitalProduct created for Dark Matter");
      } else {
        console.log("  ℹ️   DigitalProduct already exists for Dark Matter");
      }
    }
  }

  // 4. Create DJ badge test: 3 CrateItems on "Midnight Drive"
  const midnightDrive = tracks.find(t => t.title === "Midnight Drive");
  if (midnightDrive) {
    const existingCount = await db.crateItem.count({ where: { trackId: midnightDrive.id } });
    if (existingCount < 3) {
      // Need DJProfiles + Crates — create test ones if missing
      const djUsers = await db.user.findMany({
        where: { djMode: true },
        take: 3,
        select: { id: true },
      });

      // If fewer than 3 DJ users, grab any users and enable djMode
      let userPool = djUsers;
      if (userPool.length < 3) {
        const anyUsers = await db.user.findMany({ take: 3, select: { id: true } });
        userPool = anyUsers;
        for (const u of anyUsers) {
          await db.user.update({ where: { id: u.id }, data: { djMode: true } });
        }
      }

      for (let i = 0; i < Math.min(3, userPool.length); i++) {
        const userId = userPool[i].id;

        // Upsert DJProfile
        let djProfile = await db.dJProfile.findUnique({ where: { userId } });
        if (!djProfile) {
          djProfile = await db.dJProfile.create({
            data: {
              userId,
              slug: `test-dj-${i + 1}-${Date.now()}`,
              bio:  `Test DJ ${i + 1}`,
            },
          });
        }

        // Create a crate
        const crate = await db.crate.create({
          data: {
            djProfileId: djProfile.id,
            name:        `Test Crate ${i + 1}`,
            isPublic:    true,
          },
        });

        // Add track to crate (ignore duplicates)
        await db.crateItem.upsert({
          where:  { crateId_trackId: { crateId: crate.id, trackId: midnightDrive.id } },
          update: {},
          create: { crateId: crate.id, trackId: midnightDrive.id },
        });

        console.log(`  ✅  CrateItem ${i + 1}/3 for Midnight Drive`);
      }
    } else {
      console.log(`  ℹ️   Midnight Drive already has ${existingCount} crate items`);
    }
  }

  console.log("\n✅  Done.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
