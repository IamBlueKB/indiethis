/**
 * Comprehensive demo data seed for IndieThis platform.
 * Run: node scripts/seed-all.mjs
 *
 * Idempotent — safe to run multiple times.
 * Skips sections that already have data.
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  return new Date(Date.now() - n * 86400_000);
}
function future(n) {
  return new Date(Date.now() + n * 86400_000);
}
function hoursAgo(n) {
  return new Date(Date.now() - n * 3_600_000);
}
function ipHash(seed) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Simple bcrypt-like hash — we'll store a pre-computed bcrypt hash for "Demo1234!"
// bcrypt hash of "Demo1234!" with rounds=10  (pre-computed, deterministic)
const DEMO_PW_HASH =
  "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"; // "password" — fine for demo

// ── constants ─────────────────────────────────────────────────────────────────

const DEMO_ARTIST_EMAIL = "demo@indiethis.com";
const DEMO_ARTIST_SLUG  = "tyler-rhodes";
const STUDIO_SLUG       = "southside-sound";
const PRODUCER1_EMAIL   = "mikebeats@indiethis.com";
const PRODUCER1_SLUG    = "mike-beats";
const PRODUCER2_EMAIL   = "lyricbeats@indiethis.com";
const PRODUCER2_SLUG    = "lyric-beats";
const ADMIN_EMAIL       = "admin@indiethis.com";

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting full platform seed…\n");

  // ── 1. Demo artist user ──────────────────────────────────────────────────
  const artist = await db.user.upsert({
    where:  { email: DEMO_ARTIST_EMAIL },
    create: {
      email:       DEMO_ARTIST_EMAIL,
      passwordHash: DEMO_PW_HASH,
      name:        "Tyler Rhodes",
      artistName:  "Tyler Rhodes",
      artistSlug:  DEMO_ARTIST_SLUG,
      role:        "ARTIST",
      bio:         "Multi-platinum producer and recording artist from Atlanta, GA. Known for genre-bending production and raw lyricism across hip-hop, R&B, and alternative trap.",
      photo:       "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
      instagramHandle: "tylerrhodes",
      tiktokHandle:    "tylerrhodes",
      spotifyUrl:      "https://open.spotify.com/artist/demo",
      appleMusicUrl:   "https://music.apple.com/artist/demo",
      lastLoginAt:     hoursAgo(2),
    },
    update: { lastLoginAt: hoursAgo(2) },
  });
  console.log("✓  Demo artist:", artist.email);

  // Subscription
  await db.subscription.upsert({
    where:  { userId: artist.id },
    create: {
      userId:               artist.id,
      tier:                 "REIGN",
      status:               "ACTIVE",
      currentPeriodStart:   daysAgo(15),
      currentPeriodEnd:     future(15),
      aiVideoCreditsUsed:   2,
      aiVideoCreditsLimit:  5,
      aiArtCreditsUsed:     3,
      aiArtCreditsLimit:    10,
      aiMasterCreditsUsed:  1,
      aiMasterCreditsLimit: 5,
      lyricVideoCreditsUsed:  0,
      lyricVideoCreditsLimit: 3,
      aarReportCreditsUsed:   1,
      aarReportCreditsLimit:  3,
      pressKitCreditsUsed:    1,
      pressKitCreditsLimit:   3,
    },
    update: {},
  });

  // Artist site
  await db.artistSite.upsert({
    where:  { artistId: artist.id },
    create: {
      artistId:       artist.id,
      template:       "TEMPLATE_1",
      isPublished:    true,
      draftMode:      false,
      heroImage:      "https://images.unsplash.com/photo-1501386761578-ecd87563d930?w=1200",
      bioContent:     "Multi-platinum producer and recording artist from Atlanta. Known for genre-bending production and raw lyricism.",
      showMusic:      true,
      showVideos:     true,
      showMerch:      true,
      showContact:    true,
      pwywEnabled:    true,
      genre:          "Hip-Hop / R&B",
      role:           "Artist & Producer",
      city:           "Atlanta, GA",
      pinnedMessage:  "🔥 New album 'Midnight City' dropping March 28 — pre-save now!",
      pinnedActionText: "Pre-Save",
      pinnedActionUrl:  "https://distrokid.com/hyperfollow/tylerrhodes/midnight-city",
      activityTickerEnabled: true,
      credentials:    ["RIAA Certified Gold", "BMI Award Winner 2023", "XXL Freshman Class 2022"],
      bookingRate:    2500,
    },
    update: {},
  });

  // ── 2. Tracks ─────────────────────────────────────────────────────────────
  const trackDefs = [
    { title: "Midnight Drive",  bpm: 128, musicalKey: "Am",  plays: 4821, downloads: 203, price: 2.99,  coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400", fileUrl: "/demo/midnight-drive.wav",  status: "PUBLISHED", projectName: "Midnight City" },
    { title: "Golden Hour",     bpm: 95,  musicalKey: "C#m", plays: 3104, downloads: 145, price: 1.99,  coverArtUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400", fileUrl: "/demo/golden-hour.wav",    status: "PUBLISHED", projectName: "Midnight City" },
    { title: "Neon Nights",     bpm: 140, musicalKey: "Em",  plays: 2278, downloads: 87,  price: 0.99,  coverArtUrl: "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=400", fileUrl: "/demo/neon-nights.wav",    status: "PUBLISHED", projectName: "Midnight City" },
    { title: "City Lights",     bpm: 110, musicalKey: "Gm",  plays: 1543, downloads: 61,  price: 1.49,  coverArtUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400", fileUrl: "/demo/city-lights.wav",    status: "PUBLISHED", projectName: "Echoes EP" },
    { title: "Ocean Waves",     bpm: 80,  musicalKey: "F#m", plays: 982,  downloads: 29,  price: 1.99,  coverArtUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400", fileUrl: "/demo/ocean-waves.wav",    status: "PUBLISHED", projectName: "Echoes EP" },
  ];

  const createdTracks = [];
  for (const t of trackDefs) {
    const existing = await db.track.findFirst({ where: { artistId: artist.id, title: t.title } });
    const track = existing
      ? await db.track.update({ where: { id: existing.id }, data: { plays: t.plays, downloads: t.downloads, bpm: t.bpm, musicalKey: t.musicalKey, coverArtUrl: t.coverArtUrl, status: t.status, price: t.price } })
      : await db.track.create({ data: { ...t, artistId: artist.id, earnings: t.downloads * t.price * 0.7 } });
    createdTracks.push(track);
  }
  console.log("✓  Tracks:", createdTracks.length);

  // ── 3. Releases ───────────────────────────────────────────────────────────
  const relCount = await db.artistRelease.count({ where: { artistId: artist.id } });
  if (relCount === 0) {
    const album = await db.artistRelease.create({ data: { artistId: artist.id, title: "Midnight City", type: "ALBUM", releaseDate: future(8), coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400", sortOrder: 0 } });
    const ep    = await db.artistRelease.create({ data: { artistId: artist.id, title: "Echoes EP",     type: "EP",    releaseDate: daysAgo(45), coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400", sortOrder: 1 } });
    // Link tracks to releases
    await db.track.updateMany({ where: { artistId: artist.id, projectName: "Midnight City" }, data: { releaseId: album.id } });
    await db.track.updateMany({ where: { artistId: artist.id, projectName: "Echoes EP" },    data: { releaseId: ep.id } });
    console.log("✓  Releases: 2");
  } else {
    console.log("–  Releases: already seeded");
  }

  // ── 4. Pre-save campaign ─────────────────────────────────────────────────
  const psCount = await db.preSaveCampaign.count({ where: { artistId: artist.id } });
  if (psCount === 0) {
    const campaign = await db.preSaveCampaign.create({
      data: {
        artistId:     artist.id,
        title:        "Midnight City — Pre-Save",
        artUrl:       "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600",
        releaseDate:  future(8),
        spotifyUrl:   "https://open.spotify.com/album/demo",
        appleMusicUrl:"https://music.apple.com/album/demo",
        isActive:     true,
      },
    });
    // Pre-save clicks over last 14 days
    const clickData = [];
    for (let i = 14; i >= 0; i--) {
      const n = rand(8, 35);
      for (let j = 0; j < n; j++) {
        clickData.push({ campaignId: campaign.id, platform: j % 3 === 0 ? "APPLE_MUSIC" : "SPOTIFY", clickedAt: daysAgo(i) });
      }
    }
    await db.preSaveClick.createMany({ data: clickData });
    console.log("✓  Pre-save campaign with", clickData.length, "clicks");
  } else {
    console.log("–  Pre-save: already seeded");
  }

  // ── 5. Merch products + orders ───────────────────────────────────────────
  const merchCount = await db.merchProduct.count({ where: { artistId: artist.id } });
  if (merchCount === 0) {
    const products = await Promise.all([
      db.merchProduct.create({ data: { artistId: artist.id, title: "Midnight City Tee", description: "Official album tee — premium heavyweight cotton.", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", basePrice: 14.50, artistMarkup: 15.50, productType: "TSHIRT", isActive: true } }),
      db.merchProduct.create({ data: { artistId: artist.id, title: "Atlanta Hoodie",    description: "Embroidered hoodie — limited run.", imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400", basePrice: 28.00, artistMarkup: 22.00, productType: "HOODIE", isActive: true } }),
      db.merchProduct.create({ data: { artistId: artist.id, title: "Neon Poster 18×24", description: "Glossy fine-art print, numbered edition.", imageUrl: "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=400", basePrice: 7.00,  artistMarkup: 18.00, productType: "POSTER", isActive: true } }),
    ]);
    const orderRows = [
      { product: 0, email: "jayla.m@gmail.com",      qty: 1, status: "DELIVERED", days: 14 },
      { product: 0, email: "marcus.bell@outlook.com", qty: 2, status: "SHIPPED",   days: 7  },
      { product: 1, email: "drea.vox@gmail.com",      qty: 1, status: "DELIVERED", days: 21 },
      { product: 1, email: "kflow99@gmail.com",       qty: 1, status: "PROCESSING",days: 3  },
      { product: 2, email: "sunrise.music@gmail.com", qty: 3, status: "DELIVERED", days: 30 },
      { product: 2, email: "jayla.m@gmail.com",       qty: 1, status: "PENDING",   days: 1  },
    ];
    for (const o of orderRows) {
      const p = products[o.product];
      const total = p.basePrice + p.artistMarkup;
      await db.merchOrder.create({ data: { merchProductId: p.id, artistId: artist.id, buyerEmail: o.email, quantity: o.qty, totalPrice: total * o.qty, platformCut: total * o.qty * 0.10, artistEarnings: p.artistMarkup * o.qty, fulfillmentStatus: o.status, createdAt: daysAgo(o.days) } });
    }
    console.log("✓  Merch: 3 products, 6 orders");
  } else {
    console.log("–  Merch: already seeded");
  }

  // ── 6. AI jobs ────────────────────────────────────────────────────────────
  const aiCount = await db.aIJob.count({ where: { artistId: artist.id } });
  if (aiCount === 0) {
    await db.aIJob.createMany({
      data: [
        { type: "VIDEO",     status: "COMPLETE", triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: "runway", costToUs: 0.40, priceCharged: 4.99, inputData: { trackId: createdTracks[0].id, trackTitle: "Midnight Drive", style: "cinematic" }, outputData: { videoUrl: "https://example.com/video/midnight-drive.mp4" }, createdAt: daysAgo(5), completedAt: daysAgo(5) },
        { type: "COVER_ART", status: "COMPLETE", triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: "openai", costToUs: 0.08, priceCharged: 2.99, inputData: { prompt: "dark moody cityscape album cover" }, outputData: { imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600" }, createdAt: daysAgo(10), completedAt: daysAgo(10) },
        { type: "PRESS_KIT", status: "COMPLETE", triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: "anthropic", costToUs: 0.05, priceCharged: 1.99, inputData: { artistName: "Tyler Rhodes" }, outputData: { text: "Tyler Rhodes is a multi-platinum artist..." }, createdAt: daysAgo(18), completedAt: daysAgo(18) },
      ],
    });
    console.log("✓  AI jobs: 3");
  } else {
    console.log("–  AI jobs: already seeded");
  }

  // ── 7. Fan contacts ──────────────────────────────────────────────────────
  const fanCount = await db.fanContact.count({ where: { artistId: artist.id } });
  if (fanCount === 0) {
    await db.fanContact.createMany({
      data: [
        { artistId: artist.id, email: "jayla.m@gmail.com",       phone: "+14045550001", zip: "30301", source: "RELEASE_NOTIFY", createdAt: daysAgo(45) },
        { artistId: artist.id, email: "marcus.bell@outlook.com",  phone: "+14045550002", zip: "30303", source: "RELEASE_NOTIFY", createdAt: daysAgo(32) },
        { artistId: artist.id, email: "drea.vox@gmail.com",       phone: "+14045550003", zip: "30305", source: "SHOW_NOTIFY",    createdAt: daysAgo(21) },
        { artistId: artist.id, email: "kflow99@gmail.com",        phone: "+14045550004", zip: "30307", source: "SHOW_NOTIFY",    createdAt: daysAgo(14) },
        { artistId: artist.id, email: "sunrise.music@gmail.com",  phone: "+14045550005", zip: "30309", source: "RELEASE_NOTIFY", createdAt: daysAgo(7)  },
        { artistId: artist.id, email: "mia.luxe@gmail.com",       phone: "+14045550006", zip: "30311", source: "RELEASE_NOTIFY", createdAt: daysAgo(3)  },
        { artistId: artist.id, email: "ray.porter@icloud.com",    phone: null,           zip: "30313", source: "SHOW_NOTIFY",    createdAt: daysAgo(1)  },
      ],
    });
    console.log("✓  Fan contacts: 7");
  } else {
    console.log("–  Fan contacts: already seeded");
  }

  // Fan scores
  const fsCount = await db.fanScore.count({ where: { artistId: artist.id } });
  if (fsCount === 0) {
    await db.fanScore.createMany({
      data: [
        { artistId: artist.id, email: "jayla.m@gmail.com",       totalSpend: 77.50, merchSpend: 30.00, tipSpend: 47.50, orderCount: 2, tipCount: 3, lastSpentAt: daysAgo(3)  },
        { artistId: artist.id, email: "marcus.bell@outlook.com",  totalSpend: 60.00, merchSpend: 60.00, tipSpend: 0,     orderCount: 2, tipCount: 0, lastSpentAt: daysAgo(7)  },
        { artistId: artist.id, email: "drea.vox@gmail.com",       totalSpend: 50.00, merchSpend: 50.00, tipSpend: 0,     orderCount: 1, tipCount: 0, lastSpentAt: daysAgo(21) },
        { artistId: artist.id, email: "kflow99@gmail.com",        totalSpend: 50.00, merchSpend: 50.00, tipSpend: 0,     orderCount: 1, tipCount: 0, lastSpentAt: daysAgo(3)  },
        { artistId: artist.id, email: "sunrise.music@gmail.com",  totalSpend: 75.00, merchSpend: 75.00, tipSpend: 0,     orderCount: 3, tipCount: 0, lastSpentAt: daysAgo(30) },
      ],
    });
  }

  // ── 8. Tips (ArtistSupport) ───────────────────────────────────────────────
  const tipCount = await db.artistSupport.count({ where: { artistId: artist.id } });
  if (tipCount === 0) {
    await db.artistSupport.createMany({
      data: [
        { artistId: artist.id, supporterEmail: "jayla.m@gmail.com",      amount: 25.00, message: "Keep making fire 🔥", createdAt: daysAgo(5)  },
        { artistId: artist.id, supporterEmail: "jayla.m@gmail.com",      amount: 10.00, message: "Midnight Drive is my anthem", createdAt: daysAgo(12) },
        { artistId: artist.id, supporterEmail: "jayla.m@gmail.com",      amount: 12.50, message: null, createdAt: daysAgo(22) },
        { artistId: artist.id, supporterEmail: "ray.porter@icloud.com",  amount: 5.00,  message: "Appreciate the music", createdAt: daysAgo(8)  },
      ],
    });
    console.log("✓  Tips: 4");
  }

  // Receipts for artist
  const rcCount = await db.receipt.count({ where: { userId: artist.id } });
  if (rcCount === 0) {
    await db.receipt.createMany({
      data: [
        { userId: artist.id, type: "SUBSCRIPTION", description: "REIGN Plan — March 2025",   amount: 39.99, createdAt: daysAgo(45) },
        { userId: artist.id, type: "SUBSCRIPTION", description: "REIGN Plan — April 2025",   amount: 39.99, createdAt: daysAgo(15) },
        { userId: artist.id, type: "AI_TOOL",      description: "AI Video Generation",       amount: 4.99,  createdAt: daysAgo(5)  },
        { userId: artist.id, type: "AI_TOOL",      description: "AI Cover Art",              amount: 2.99,  createdAt: daysAgo(10) },
        { userId: artist.id, type: "AI_TOOL",      description: "Press Kit Generation",      amount: 1.99,  createdAt: daysAgo(18) },
        { userId: artist.id, type: "MERCH_SALE",   description: "Merch payout — March",      amount: 89.50, createdAt: daysAgo(30) },
        { userId: artist.id, type: "SUPPORT_TIP",  description: "Fan tips — March",          amount: 52.50, createdAt: daysAgo(25) },
      ],
    });
    console.log("✓  Receipts: 7");
  }

  // ── 9. Shows ──────────────────────────────────────────────────────────────
  const showCount = await db.artistShow.count({ where: { artistId: artist.id } });
  if (showCount === 0) {
    await db.artistShow.createMany({
      data: [
        { artistId: artist.id, venueName: "Center Stage",     city: "Atlanta, GA",    date: future(15), ticketUrl: "https://axs.com/demo",    isSoldOut: false },
        { artistId: artist.id, venueName: "The Fillmore",     city: "Charlotte, NC",  date: future(28), ticketUrl: "https://ticketmaster.com/demo", isSoldOut: false },
        { artistId: artist.id, venueName: "House of Blues",   city: "Houston, TX",    date: future(42), ticketUrl: "https://houseofblues.com/demo",  isSoldOut: false },
      ],
    });
    console.log("✓  Shows: 3");
  } else {
    console.log("–  Shows: already seeded");
  }

  // ── 10. Videos ────────────────────────────────────────────────────────────
  const vidCount = await db.artistVideo.count({ where: { artistId: artist.id } });
  if (vidCount === 0) {
    await db.artistVideo.createMany({
      data: [
        { artistId: artist.id, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Midnight Drive (Official Video)", sortOrder: 0 },
        { artistId: artist.id, url: "https://www.youtube.com/watch?v=9bZkp7q19f0", title: "Golden Hour (Lyric Video)",       sortOrder: 1 },
      ],
    });
    console.log("✓  Videos: 2");
  }

  // ── 11. Photos ────────────────────────────────────────────────────────────
  const photoCount = await db.artistPhoto.count({ where: { artistId: artist.id } });
  if (photoCount === 0) {
    await db.artistPhoto.createMany({
      data: [
        { artistId: artist.id, imageUrl: "https://images.unsplash.com/photo-1501386761578-ecd87563d930?w=600", caption: "Sold-out show at Center Stage",     sortOrder: 0 },
        { artistId: artist.id, imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600", caption: "Studio session — Midnight City",     sortOrder: 1 },
        { artistId: artist.id, imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600", caption: "Behind the boards",                  sortOrder: 2 },
      ],
    });
    console.log("✓  Photos: 3");
  }

  // ── 12. Testimonials ──────────────────────────────────────────────────────
  const testCount = await db.artistTestimonial.count({ where: { artistId: artist.id } });
  if (testCount === 0) {
    await db.artistTestimonial.createMany({
      data: [
        { artistId: artist.id, quote: "Tyler's ear for melody is unmatched. 'Midnight Drive' is a stone-cold classic.", attribution: "DJ Akademiks", sortOrder: 0 },
        { artistId: artist.id, quote: "The most authentic voice to come out of Atlanta in years. Real artistry.", attribution: "HipHopDX Editor",  sortOrder: 1 },
        { artistId: artist.id, quote: "I played 'Golden Hour' at three sold-out events. Crowd goes crazy every time.", attribution: "DJ Khaled",      sortOrder: 2 },
      ],
    });
    console.log("✓  Testimonials: 3");
  }

  // ── 13. Collaborators ─────────────────────────────────────────────────────
  const collabCount = await db.artistCollaborator.count({ where: { artistId: artist.id } });
  if (collabCount === 0) {
    await db.artistCollaborator.createMany({
      data: [
        { artistId: artist.id, name: "Lena Blue",   photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200", artistSlug: null,        sortOrder: 0 },
        { artistId: artist.id, name: "K-Flow",      photoUrl: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200", artistSlug: null,        sortOrder: 1 },
        { artistId: artist.id, name: "Jade Monroe", photoUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200", artistSlug: null,        sortOrder: 2 },
      ],
    });
    console.log("✓  Collaborators: 3");
  }

  // ── 14. Press items ───────────────────────────────────────────────────────
  const pressCount = await db.artistPressItem.count({ where: { artistId: artist.id } });
  if (pressCount === 0) {
    await db.artistPressItem.createMany({
      data: [
        { artistId: artist.id, source: "Rolling Stone",  title: "10 Artists to Watch in 2025",         url: "https://rollingstone.com/demo",  sortOrder: 0 },
        { artistId: artist.id, source: "Complex",        title: "Tyler Rhodes Is Redefining Atlanta Rap", url: "https://complex.com/demo",      sortOrder: 1 },
        { artistId: artist.id, source: "XXL",            title: "XXL Freshman Class 2022",              url: "https://xxlmag.com/demo",        sortOrder: 2 },
      ],
    });
    console.log("✓  Press items: 3");
  }

  // ── 15. Booking inquiries ─────────────────────────────────────────────────
  const inqCount = await db.artistBookingInquiry.count({ where: { artistId: artist.id } });
  if (inqCount === 0) {
    await db.artistBookingInquiry.createMany({
      data: [
        { artistId: artist.id, name: "Event Atlanta LLC", email: "events@eventatlanta.com", inquiryType: "Booking",    message: "Interested in booking Tyler for our annual music festival on July 4th. Capacity 5,000. Please send rates.", createdAt: daysAgo(3) },
        { artistId: artist.id, name: "Def Jam Records",   email: "a&r@defjam.com",          inquiryType: "Management", message: "We've been following Tyler's trajectory closely. Would love to set up a call to discuss partnership opportunities.", createdAt: daysAgo(8) },
      ],
    });
    console.log("✓  Booking inquiries: 2");
  }

  // ── 16. Page views (analytics) ────────────────────────────────────────────
  const pvCount = await db.pageView.count({ where: { artistId: artist.id } });
  if (pvCount === 0) {
    const pvRows = [];
    for (let i = 89; i >= 0; i--) {
      const base = i < 30 ? rand(80, 180) : i < 60 ? rand(50, 110) : rand(30, 70);
      for (let j = 0; j < base; j++) {
        pvRows.push({ artistId: artist.id, ipHash: ipHash(`artist-pv-${i}-${j}`), viewedAt: daysAgo(i), referrer: j % 8 === 0 ? "qr" : j % 4 === 0 ? "instagram" : null });
      }
    }
    await db.pageView.createMany({ data: pvRows });
    console.log(`✓  Artist page views: ${pvRows.length}`);
  } else {
    console.log("–  Artist page views: already seeded");
  }

  // ── 17. Track plays (analytics) ──────────────────────────────────────────
  const tpCount = await db.trackPlay.count({ where: { artistId: artist.id } });
  if (tpCount === 0) {
    const tpRows = [];
    for (let i = 29; i >= 0; i--) {
      for (const t of createdTracks) {
        const n = rand(5, 25);
        for (let j = 0; j < n; j++) {
          tpRows.push({ trackId: t.id, artistId: artist.id, ipHash: ipHash(`tp-${t.id}-${i}-${j}`), playedAt: daysAgo(i) });
        }
      }
    }
    await db.trackPlay.createMany({ data: tpRows });
    console.log(`✓  Track plays: ${tpRows.length}`);
  } else {
    console.log("–  Track plays: already seeded");
  }

  // ── 18. Link clicks ───────────────────────────────────────────────────────
  const lcCount = await db.linkClick.count({ where: { artistId: artist.id } });
  if (lcCount === 0) {
    const platforms = ["spotify", "apple_music", "instagram", "youtube", "tiktok"];
    const lcRows = [];
    for (let i = 29; i >= 0; i--) {
      platforms.forEach((p, pi) => {
        const n = rand(2, 12);
        for (let j = 0; j < n; j++) {
          lcRows.push({ artistId: artist.id, platform: p, clickedAt: daysAgo(i) });
        }
      });
    }
    await db.linkClick.createMany({ data: lcRows });
    console.log(`✓  Link clicks: ${lcRows.length}`);
  }

  // ── 19. Broadcast log ─────────────────────────────────────────────────────
  const blCount = await db.broadcastLog.count({ where: { artistId: artist.id } });
  if (blCount === 0) {
    await db.broadcastLog.createMany({
      data: [
        { artistId: artist.id, message: "🔥 New single 'Midnight Drive' is OUT NOW! Stream it everywhere — link in bio.", segment: "ALL", recipientCount: 312, successCount: 308, sentAt: daysAgo(30) },
        { artistId: artist.id, message: "Atlanta 🏠 we comin home! Tickets on sale NOW for the Center Stage show on the 15th.", segment: "SHOW_NOTIFY", recipientCount: 187, successCount: 184, sentAt: daysAgo(7) },
      ],
    });
    console.log("✓  Broadcast log: 2");
  }

  // ── 20. YouTube references ────────────────────────────────────────────────
  const yrCount = await db.youtubeReference.count({ where: { artistId: artist.id } });
  if (yrCount === 0) {
    await db.youtubeReference.createMany({
      data: [
        { artistId: artist.id, url: "https://youtube.com/watch?v=dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ", title: "Drake - God's Plan (Official Video)",   thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg", authorName: "Drake",           projectTag: "Midnight City", folder: "References" },
        { artistId: artist.id, url: "https://youtube.com/watch?v=9bZkp7q19f0", videoId: "9bZkp7q19f0", title: "PSY - GANGNAM STYLE (Official Video)", thumbnailUrl: "https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg", authorName: "officialpsy",    projectTag: "Echoes EP",    folder: "Vibes" },
      ],
    });
    console.log("✓  YouTube references: 2");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STUDIO DATA — southside-sound
  // ─────────────────────────────────────────────────────────────────────────

  const studio = await db.studio.findUnique({ where: { slug: STUDIO_SLUG } });
  if (!studio) {
    console.log(`⚠   Studio '${STUDIO_SLUG}' not found — skipping studio seed. Create it via /studio/settings first.`);
  } else {
    console.log(`\n✓  Found studio: ${studio.name} (${studio.id})`);
    const studioOwner = await db.user.findUnique({ where: { id: studio.ownerId } });

    // Ensure studio profile has hero + gallery images
    await db.studio.update({
      where: { id: studio.id },
      data: {
        heroImage: studio.heroImage ?? "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1600&q=80",
        galleryImages: Array.isArray(studio.galleryImages) && studio.galleryImages.length > 0
          ? studio.galleryImages
          : [
              "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
              "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80",
              "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80",
              "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
              "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
              "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
            ],
      },
    });
    console.log("✓  Studio hero + gallery images set");

    // ── 21. Studio portfolio tracks ────────────────────────────────────────
    const sptCount = await db.studioPortfolioTrack.count({ where: { studioId: studio.id } });
    if (sptCount === 0) {
      await db.studioPortfolioTrack.createMany({
        data: [
          { studioId: studio.id, title: "After Hours",     artistName: "Tyler Rhodes", audioUrl: "/demo/midnight-drive.wav", coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400", description: "Mixed & mastered at Southside Sound",    artistSlug: DEMO_ARTIST_SLUG, sortOrder: 0 },
          { studioId: studio.id, title: "Smoke & Mirrors", artistName: "Jade Monroe",  audioUrl: "/demo/golden-hour.wav",    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400", description: "Produced, mixed & mastered in-house",    artistSlug: null,             sortOrder: 1 },
          { studioId: studio.id, title: "North Star",      artistName: "Marcus Bell",  audioUrl: "/demo/neon-nights.wav",    coverUrl: "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=400", description: "Full production — tracking through master", artistSlug: null,             sortOrder: 2 },
          { studioId: studio.id, title: "Wavelength",      artistName: "Drea Vox",     audioUrl: "/demo/midnight-drive.wav", coverUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400", description: "R&B mix session",                         artistSlug: null,             sortOrder: 3 },
        ],
      });
      console.log("✓  Studio portfolio tracks: 4");
    } else {
      console.log("–  Studio portfolio tracks: already seeded");
    }

    // ── 22. Studio credits ─────────────────────────────────────────────────
    const scCount = await db.studioCredit.count({ where: { studioId: studio.id } });
    if (scCount === 0) {
      await db.studioCredit.createMany({
        data: [
          { studioId: studio.id, artistName: "Tyler Rhodes", artistPhotoUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200", projectName: "Midnight City",  artistSlug: DEMO_ARTIST_SLUG, sortOrder: 0 },
          { studioId: studio.id, artistName: "Jade Monroe",  artistPhotoUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200", projectName: "Smoke & Mirrors", artistSlug: null, sortOrder: 1 },
          { studioId: studio.id, artistName: "Marcus Bell",  artistPhotoUrl: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200", projectName: "North Star",      artistSlug: null, sortOrder: 2 },
          { studioId: studio.id, artistName: "Drea Vox",     artistPhotoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200", projectName: "Wavelength",      artistSlug: null, sortOrder: 3 },
          { studioId: studio.id, artistName: "K-Flow",       artistPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200", projectName: "Pressure EP",     artistSlug: null, sortOrder: 4 },
          { studioId: studio.id, artistName: "SunRise",      artistPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200", projectName: "Golden Era",      artistSlug: null, sortOrder: 5 },
          { studioId: studio.id, artistName: "DJ Cannon",    artistPhotoUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200", projectName: "Club Bangers V.2", artistSlug: null, sortOrder: 6 },
          { studioId: studio.id, artistName: "Lena Blue",    artistPhotoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200", projectName: "Azure EP",        artistSlug: null, sortOrder: 7 },
          { studioId: studio.id, artistName: "Ray Porter",   artistPhotoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200", projectName: "The Porter Tapes", artistSlug: null, sortOrder: 8 },
          { studioId: studio.id, artistName: "Mia Luxe",     artistPhotoUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200", projectName: "Luxe Life",        artistSlug: null, sortOrder: 9 },
        ],
      });
      console.log("✓  Studio credits: 10");
    } else {
      console.log("–  Studio credits: already seeded");
    }

    // ── 23. Studio engineers ───────────────────────────────────────────────
    const seCount = await db.studioEngineer.count({ where: { studioId: studio.id } });
    if (seCount === 0) {
      await db.studioEngineer.createMany({
        data: [
          { studioId: studio.id, name: "Chris Palmer",  role: "Head Engineer",    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300", specialties: ["Mixing", "Mastering", "Recording", "Hip-Hop", "R&B"],   bio: "15 years in the industry. Gold and platinum credits across hip-hop and R&B. Former senior engineer at Hit Factory NYC.", artistSlug: null, sortOrder: 0 },
          { studioId: studio.id, name: "Kayla Simms",   role: "Mix Engineer",     photoUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300", specialties: ["Mixing", "Hip-Hop", "Trap", "Vocal Production"],         bio: "Kayla specializes in vocal-forward hip-hop and trap. Known for her punchy low-end and clean high-frequency work.", artistSlug: null, sortOrder: 1 },
          { studioId: studio.id, name: "Devon West",    role: "Mastering Engineer", photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300", specialties: ["Mastering", "Analog", "Pop", "Electronic", "R&B"],        bio: "Analog mastering specialist with a focus on loudness-competitive streaming masters. Clients include major label and indie artists.", artistSlug: null, sortOrder: 2 },
        ],
      });
      console.log("✓  Studio engineers: 3");
    } else {
      console.log("–  Studio engineers: already seeded");
    }

    // ── 24. Studio equipment ──────────────────────────────────────────────
    const eqCount = await db.studioEquipment.count({ where: { studioId: studio.id } });
    if (eqCount === 0) {
      const equipment = [
        // CONSOLE
        { category: "CONSOLE", name: "SSL 4000 G+", sortOrder: 0 },
        { category: "CONSOLE", name: "Neve 8078 (Vintage)", sortOrder: 1 },
        // MONITORS
        { category: "MONITORS", name: "Yamaha NS-10M Studio", sortOrder: 0 },
        { category: "MONITORS", name: "Genelec 8351B", sortOrder: 1 },
        { category: "MONITORS", name: "Avantone MixCube (Passive)", sortOrder: 2 },
        { category: "MONITORS", name: "KRK Rokit 8 G4", sortOrder: 3 },
        // MICROPHONES
        { category: "MICROPHONES", name: "Neumann U87 Ai", sortOrder: 0 },
        { category: "MICROPHONES", name: "AKG C414 XLII", sortOrder: 1 },
        { category: "MICROPHONES", name: "Shure SM7B", sortOrder: 2 },
        { category: "MICROPHONES", name: "Telefunken ELA M 251E", sortOrder: 3 },
        { category: "MICROPHONES", name: "Blue Bottle Mic System", sortOrder: 4 },
        // OUTBOARD
        { category: "OUTBOARD", name: "API 2500 Bus Compressor", sortOrder: 0 },
        { category: "OUTBOARD", name: "Universal Audio LA-2A", sortOrder: 1 },
        { category: "OUTBOARD", name: "Neve 1073 DPA Preamp", sortOrder: 2 },
        { category: "OUTBOARD", name: "Manley VARI-MU Limiter", sortOrder: 3 },
        { category: "OUTBOARD", name: "Eventide H3000 Harmonizer", sortOrder: 4 },
        // DAW
        { category: "DAW", name: "Pro Tools Ultimate (v2024)", sortOrder: 0 },
        { category: "DAW", name: "Ableton Live 12 Suite", sortOrder: 1 },
        { category: "DAW", name: "Logic Pro X", sortOrder: 2 },
        // OTHER
        { category: "OTHER", name: "Moog Subsequent 37 CV", sortOrder: 0 },
        { category: "OTHER", name: "Roland MV-8800 Production Studio", sortOrder: 1 },
        { category: "OTHER", name: "Neve Shelford Channel Strip", sortOrder: 2 },
      ];
      await db.studioEquipment.createMany({ data: equipment.map(e => ({ ...e, studioId: studio.id })) });
      console.log("✓  Studio equipment:", equipment.length);
    } else {
      console.log("–  Studio equipment: already seeded");
    }

    // ── 25. Studio contacts ───────────────────────────────────────────────
    const contactCount = await db.contact.count({ where: { studioId: studio.id } });
    if (contactCount < 3) {
      const contacts = await Promise.all([
        db.contact.create({ data: { studioId: studio.id, name: "Tyler Rhodes",  email: DEMO_ARTIST_EMAIL, phone: "+14045551001", genre: "Hip-Hop",       source: "BOOKING",     totalSpent: 1250, instagramHandle: "tylerrhodes",  lastSessionDate: daysAgo(5)  } }),
        db.contact.create({ data: { studioId: studio.id, name: "Marcus Bell",   email: "marcus.bell@outlook.com", phone: "+14045551002", genre: "R&B",    source: "INTAKE_FORM", totalSpent: 800,  instagramHandle: "marcusbellmusic", lastSessionDate: daysAgo(14) } }),
        db.contact.create({ data: { studioId: studio.id, name: "Jade Monroe",   email: "jade.monroe@gmail.com",   phone: "+14045551003", genre: "Pop",    source: "REFERRAL",    totalSpent: 650,  instagramHandle: "jademonroeofficial" } }),
        db.contact.create({ data: { studioId: studio.id, name: "K-Flow",        email: "kflow99@gmail.com",       phone: "+14045551004", genre: "Trap",   source: "WALK_IN",     totalSpent: 400 } }),
        db.contact.create({ data: { studioId: studio.id, name: "SunRise",       email: "sunrise.music@gmail.com", phone: "+14045551005", genre: "R&B",    source: "INSTAGRAM",   totalSpent: 350,  instagramHandle: "sunriseofficial" } }),
        db.contact.create({ data: { studioId: studio.id, name: "Drea Vox",      email: "drea.vox@gmail.com",      phone: "+14045551006", genre: "R&B/Soul", source: "BOOKING",   totalSpent: 1100, instagramHandle: "dreavox" } }),
      ]);
      console.log("✓  Studio contacts:", contacts.length);

      // Activity logs for first contact
      const c = contacts[0];
      await db.activityLog.createMany({
        data: [
          { contactId: c.id, studioId: studio.id, type: "BOOKING_LINK_SENT", description: "Intake link sent via email", createdAt: daysAgo(20) },
          { contactId: c.id, studioId: studio.id, type: "FORM_SUBMITTED",    description: "Intake form submitted — Midnight City mix session", createdAt: daysAgo(19) },
          { contactId: c.id, studioId: studio.id, type: "PAYMENT_RECEIVED",  description: "Deposit received — $250 via Cash App", metadata: { amount: 250, method: "cashapp" }, createdAt: daysAgo(18) },
          { contactId: c.id, studioId: studio.id, type: "SESSION_COMPLETED", description: "Mix session completed — 8 hours", createdAt: daysAgo(5) },
          { contactId: c.id, studioId: studio.id, type: "FILES_DELIVERED",   description: "3 mix files delivered via download link", createdAt: daysAgo(5) },
        ],
      });

      // ── 26. Bookings ─────────────────────────────────────────────────────
      if (studioOwner) {
        const bookings = await Promise.all([
          db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[1].id, dateTime: daysAgo(3),  duration: 480, sessionType: "Mix Session",      status: "COMPLETED",  paymentStatus: "PAID",    notes: "Full Midnight City album mix — 12 tracks. Client was great to work with.", engineerNotes: "Pushed mids on tracks 3-7. Stem bounce needed for track 9.", createdAt: daysAgo(7) } }),
          db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[2].id, dateTime: future(2),   duration: 240, sessionType: "Recording",        status: "CONFIRMED",  paymentStatus: "DEPOSIT", notes: "Tracking vocals for Smoke & Mirrors EP. Bring reference tracks.", createdAt: daysAgo(5) } }),
          db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[3].id, dateTime: future(5),   duration: 120, sessionType: "Mastering",        status: "PENDING",    paymentStatus: "UNPAID",  notes: "6-track EP mastering. Wants loud and competitive.", createdAt: daysAgo(2) } }),
        ]);
        console.log("✓  Studio bookings: 3");

        // Delivered files for first booking
        await db.deliveredFile.createMany({
          data: [
            { sessionId: bookings[0].id, artistId: studioOwner.id, studioId: studio.id, contactId: contacts[1].id, fileName: "MidnightCity_MixedMastered_v3.wav", fileUrl: "/demo/midnight-drive.wav", notes: "Final approved mix — 24-bit 48kHz WAV", notificationSent: true, deliveredAt: daysAgo(3) },
            { sessionId: bookings[0].id, artistId: studioOwner.id, studioId: studio.id, contactId: contacts[1].id, fileName: "GoldenHour_Mix_v2.wav",              fileUrl: "/demo/golden-hour.wav",    notes: "Second revision", notificationSent: true, deliveredAt: daysAgo(3) },
            { sessionId: bookings[0].id, artistId: studioOwner.id, studioId: studio.id, contactId: contacts[1].id, fileName: "NeonNights_FinalMix.wav",            fileUrl: "/demo/neon-nights.wav",    notes: "Approved — ready for distribution", notificationSent: true, deliveredAt: daysAgo(3) },
          ],
        });
        console.log("✓  Delivered files: 3");
      }

      // ── 27. Invoices ─────────────────────────────────────────────────────
      const invCount = await db.invoice.count({ where: { studioId: studio.id } });
      if (invCount === 0) {
        await db.invoice.createMany({
          data: [
            { studioId: studio.id, contactId: contacts[0].id, invoiceNumber: 1001, lineItems: [{ description: "Mix Session — 8 hrs @ $100/hr", quantity: 8, rate: 100, total: 800 }, { description: "Mastering — 12 tracks @ $50", quantity: 12, rate: 50, total: 600 }], subtotal: 1400, tax: 0, taxRate: 0, total: 1400, dueDate: future(7),  status: "PAID",  paidAt: daysAgo(3), createdAt: daysAgo(10) },
            { studioId: studio.id, contactId: contacts[1].id, invoiceNumber: 1002, lineItems: [{ description: "Recording Session — 4 hrs @ $100/hr", quantity: 4, rate: 100, total: 400 }], subtotal: 400, tax: 0, taxRate: 0, total: 400, dueDate: future(14), status: "SENT", createdAt: daysAgo(2) },
          ],
        });
        console.log("✓  Invoices: 2");
      }

      // ── 28. Intake submissions ─────────────────────────────────────────
      const ilCount = await db.intakeLink.count({ where: { studioId: studio.id } });
      if (ilCount === 0) {
        const il1 = await db.intakeLink.create({ data: { studioId: studio.id, contactId: contacts[0].id, token: "demo-intake-001", name: "Tyler Rhodes", email: DEMO_ARTIST_EMAIL, expiresAt: future(30), usedAt: daysAgo(14) } });
        const il2 = await db.intakeLink.create({ data: { studioId: studio.id, contactId: contacts[1].id, token: "demo-intake-002", name: "Marcus Bell",  email: "marcus.bell@outlook.com", expiresAt: future(30), usedAt: daysAgo(7) } });
        const il3 = await db.intakeLink.create({ data: { studioId: studio.id, contactId: contacts[2].id, token: "demo-intake-003", name: "Jade Monroe",  email: "jade.monroe@gmail.com", expiresAt: future(30), usedAt: daysAgo(2) } });

        await db.intakeSubmission.createMany({
          data: [
            { intakeLinkId: il1.id, studioId: studio.id, contactId: contacts[0].id, artistName: "Tyler Rhodes", genre: "Hip-Hop", projectDesc: "Full album mix & master — 12 tracks, aggressive low-end, punchy snares, clear vocals.", youtubeLinks: ["https://youtube.com/watch?v=dQw4w9WgXcQ"], fileUrls: ["/demo/midnight-drive.wav"], bpmDetected: 128, keyDetected: "Am", instagram: "tylerrhodes", paymentMethod: "cashapp", depositPaid: true, depositAmount: 250, aiVideoRequested: false, createdAt: daysAgo(14) },
            { intakeLinkId: il2.id, studioId: studio.id, contactId: contacts[1].id, artistName: "Marcus Bell",  genre: "R&B",    projectDesc: "4-track EP recording session. Need to track vocals — have full production stems ready.", youtubeLinks: [], fileUrls: [], bpmDetected: 95,  keyDetected: "C#m", instagram: "marcusbellmusic", paymentMethod: "zelle", depositPaid: false, aiVideoRequested: false, createdAt: daysAgo(7) },
            { intakeLinkId: il3.id, studioId: studio.id, contactId: contacts[2].id, artistName: "Jade Monroe",  genre: "Pop",    projectDesc: "Single mastering — want loud, streaming-ready master. Reference: Olivia Rodrigo 'drivers license'.", youtubeLinks: ["https://youtube.com/watch?v=9bZkp7q19f0"], fileUrls: [], bpmDetected: 75,  keyDetected: "Dm", instagram: "jademonroeofficial", paymentMethod: "paypal", depositPaid: false, aiVideoRequested: false, createdAt: daysAgo(2) },
          ],
        });
        console.log("✓  Intake submissions: 3");
      }
    } else {
      console.log("–  Studio contacts/bookings/invoices: already seeded");
    }

    // ── 29. Studio email campaigns ─────────────────────────────────────────
    const ecCount = await db.emailCampaign.count({ where: { studioId: studio.id } });
    if (ecCount === 0) {
      await db.emailCampaign.createMany({
        data: [
          { studioId: studio.id, subject: "🎉 New Studio Rate Card — Book Now for Spring",       body: "We've just updated our rate card for Spring 2025. Mix sessions start at $85/hr with full equipment access. Book this week and get a complimentary stem bounce. Spots are limited!",               recipientCount: 148, openCount: 62, sentAt: daysAgo(14), createdAt: daysAgo(15) },
          { studioId: studio.id, subject: "Exclusive: New Vocal Booth + Neve Outboard Now Live", body: "We've added a new isolated vocal booth and the Neve 1073 DPA preamp to Studio A. Now accepting bookings for tracking sessions. Reply to this email or book via the link below.",              recipientCount: 203, openCount: 91, sentAt: daysAgo(3),  createdAt: daysAgo(4)  },
        ],
      });
      console.log("✓  Studio email campaigns: 2");
    }

    // ── 30. Studio page views ─────────────────────────────────────────────
    const spvCount = await db.pageView.count({ where: { studioId: studio.id } });
    if (spvCount === 0) {
      const spvRows = [];
      for (let i = 89; i >= 0; i--) {
        const base = i < 30 ? rand(20, 60) : i < 60 ? rand(10, 35) : rand(5, 20);
        for (let j = 0; j < base; j++) {
          spvRows.push({ studioId: studio.id, ipHash: ipHash(`studio-pv-${i}-${j}`), viewedAt: daysAgo(i) });
        }
      }
      await db.pageView.createMany({ data: spvRows });
      console.log(`✓  Studio page views: ${spvRows.length}`);
    }

    // Studio AI jobs
    const saijCount = await db.aIJob.count({ where: { studioId: studio.id } });
    if (saijCount === 0) {
      await db.aIJob.createMany({
        data: [
          { type: "VIDEO", status: "COMPLETE", triggeredBy: "STUDIO", triggeredById: studio.ownerId, studioId: studio.id, artistId: artist.id, provider: "runway",    costToUs: 0.40, priceCharged: 4.99, inputData: { trackTitle: "Midnight Drive" }, outputData: { videoUrl: "/demo/video.mp4" }, createdAt: daysAgo(8),  completedAt: daysAgo(8)  },
          { type: "PRESS_KIT", status: "COMPLETE", triggeredBy: "STUDIO", triggeredById: studio.ownerId, studioId: studio.id, provider: "anthropic", costToUs: 0.05, priceCharged: 1.99, inputData: { studioName: "Southside Sound" }, outputData: { text: "Southside Sound is Atlanta's premier recording facility..." }, createdAt: daysAgo(21), completedAt: daysAgo(21) },
        ],
      });
      console.log("✓  Studio AI jobs: 2");
    }

    // Contact submissions from public page
    const csCount = await db.contactSubmission.count({ where: { studioId: studio.id } });
    if (csCount === 0) {
      await db.contactSubmission.createMany({
        data: [
          { studioId: studio.id, name: "Alex Rivera",   email: "alexrivera@gmail.com",   phone: "+14045552001", message: "Interested in booking a full day session for my debut EP. Can we schedule a studio tour first?", isRead: true,  createdAt: daysAgo(4)  },
          { studioId: studio.id, name: "Priya Sharma",  email: "priya.s.music@gmail.com", phone: null,           message: "I'm an R&B vocalist looking for a mixing engineer for my single. Budget is around $400–600.", isRead: false, createdAt: daysAgo(1)  },
          { studioId: studio.id, name: "Jason Wu",      email: "jasonwubeats@outlook.com", phone: "+14045552003", message: "Do you have availability for a 3-hour tracking session next Friday? Hip-hop/trap production.", isRead: false, createdAt: hoursAgo(3) },
        ],
      });
      console.log("✓  Contact submissions: 3");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BEAT MARKETPLACE — 2 producers, 6 beats
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n🎹  Seeding beat marketplace…");

  const prod1 = await db.user.upsert({
    where:  { email: PRODUCER1_EMAIL },
    create: { email: PRODUCER1_EMAIL, passwordHash: DEMO_PW_HASH, name: "Mike Beats", artistName: "Mike Beats", artistSlug: PRODUCER1_SLUG, role: "ARTIST", bio: "Top-charting trap producer from Atlanta. Credits include multi-gold singles.", photo: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=300", lastLoginAt: daysAgo(1) },
    update: {},
  });
  const prod2 = await db.user.upsert({
    where:  { email: PRODUCER2_EMAIL },
    create: { email: PRODUCER2_EMAIL, passwordHash: DEMO_PW_HASH, name: "LyricBeats", artistName: "LyricBeats Official", artistSlug: PRODUCER2_SLUG, role: "ARTIST", bio: "Soulful beats for R&B and conscious hip-hop. Sample-based and original production.", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300", lastLoginAt: daysAgo(2) },
    update: {},
  });
  await db.subscription.upsert({ where: { userId: prod1.id }, create: { userId: prod1.id, tier: "PUSH", status: "ACTIVE", currentPeriodStart: daysAgo(10), currentPeriodEnd: future(20), aiVideoCreditsUsed: 0, aiVideoCreditsLimit: 3, aiArtCreditsUsed: 1, aiArtCreditsLimit: 5, aiMasterCreditsUsed: 0, aiMasterCreditsLimit: 3, lyricVideoCreditsUsed: 0, lyricVideoCreditsLimit: 1, aarReportCreditsUsed: 0, aarReportCreditsLimit: 1, pressKitCreditsUsed: 0, pressKitCreditsLimit: 1 }, update: {} });
  await db.subscription.upsert({ where: { userId: prod2.id }, create: { userId: prod2.id, tier: "LAUNCH", status: "ACTIVE", currentPeriodStart: daysAgo(5), currentPeriodEnd: future(25), aiVideoCreditsUsed: 0, aiVideoCreditsLimit: 1, aiArtCreditsUsed: 0, aiArtCreditsLimit: 2, aiMasterCreditsUsed: 0, aiMasterCreditsLimit: 1, lyricVideoCreditsUsed: 0, lyricVideoCreditsLimit: 0, aarReportCreditsUsed: 0, aarReportCreditsLimit: 0, pressKitCreditsUsed: 0, pressKitCreditsLimit: 0 }, update: {} });

  const beatDefs = [
    { artistId: prod1.id, title: "808 Vibez",    bpm: 135, musicalKey: "Am",  price: 29.99,  coverArtUrl: "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=400",  description: "Hard-hitting 808 trap with hypnotic melody. Perfect for aggressive rap records." },
    { artistId: prod1.id, title: "Trap Wave",    bpm: 145, musicalKey: "F#m", price: 34.99,  coverArtUrl: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=400",  description: "Dark and atmospheric trap production.808s hit hard, pads breathe." },
    { artistId: prod1.id, title: "Night Ride",   bpm: 90,  musicalKey: "Gm",  price: 24.99,  coverArtUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400",  description: "Moody night-drive vibes. Slow-rolling 808s, lush synths." },
    { artistId: prod2.id, title: "Soul Sample",  bpm: 88,  musicalKey: "Cm",  price: 29.99,  coverArtUrl: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400",  description: "Classic soul sample flip with vinyl texture. Dusty boom-bap feel." },
    { artistId: prod2.id, title: "R&B Groove",   bpm: 75,  musicalKey: "Dm",  price: 19.99,  coverArtUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",  description: "Smooth R&B production ideal for melodic vocal records." },
    { artistId: prod2.id, title: "Latin Drill",  bpm: 150, musicalKey: "Em",  price: 39.99,  coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400",  description: "Energetic drill with Latin percussion elements. Unique crossover sound." },
  ];

  const beatTracks = [];
  for (const b of beatDefs) {
    const existing = await db.track.findFirst({ where: { artistId: b.artistId, title: b.title } });
    const beat = existing ?? await db.track.create({ data: { ...b, fileUrl: "/demo/midnight-drive.wav", status: "PUBLISHED", plays: rand(50, 400), downloads: rand(5, 40), earnings: 0 } });
    beatTracks.push(beat);
  }
  console.log("✓  Beat tracks:", beatTracks.length);

  // Beat previews sent to demo artist (so their "My Previews" tab has data)
  const bpCount = await db.beatPreview.count({ where: { artistId: artist.id } });
  if (bpCount === 0) {
    for (let i = 0; i < beatTracks.length; i++) {
      const bt = beatTracks[i];
      const preview = await db.beatPreview.create({
        data: {
          producerId:     bt.artistId,
          artistId:       artist.id,
          trackId:        bt.id,
          expiresAt:      future(14),
          isDownloadable: false,
          status:         i === 0 ? "PURCHASED" : i < 3 ? "LISTENED" : "PENDING",
          createdAt:      daysAgo(i * 3),
        },
      });
      // Add a license for the "purchased" beat
      if (i === 0) {
        await db.beatLicense.create({
          data: { beatPreviewId: preview.id, trackId: bt.id, producerId: bt.artistId, artistId: artist.id, licenseType: "LEASE", price: bt.price ?? 29.99, status: "ACTIVE", createdAt: daysAgo(10) },
        });
      }
    }
    console.log("✓  Beat previews:", beatTracks.length, "(1 licensed)");
  } else {
    console.log("–  Beat previews: already seeded");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN PANEL DATA — extra users, payments, AI jobs for charts
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n🔧  Seeding admin panel data…");

  // Admin account
  await db.adminAccount.upsert({
    where:  { email: ADMIN_EMAIL },
    create: { email: ADMIN_EMAIL, passwordHash: DEMO_PW_HASH, name: "Platform Admin", role: "SUPER_ADMIN", isActive: true, mustChangePassword: false, lastLoginAt: hoursAgo(1) },
    update: { lastLoginAt: hoursAgo(1) },
  });
  console.log("✓  Admin account:", ADMIN_EMAIL);

  // Seed enough users spread over 12 months for the growth chart
  const adminUsersExist = await db.user.count({ where: { email: { contains: "@demo-user-" } } });
  if (adminUsersExist < 10) {
    const userSeed = [
      // name, email-suffix, role, tier, daysAgo, hasStudio
      ["Aaliyah Carter",    "01", "ARTIST",      "LAUNCH",  365], ["Jordan Blake",  "02", "ARTIST",      "PUSH",   320],
      ["Sofia Reyes",       "03", "ARTIST",      "REIGN",   280], ["Dante Morales", "04", "ARTIST",      "LAUNCH", 240],
      ["Nadia Hassan",      "05", "ARTIST",      "PUSH",    200], ["Kevin Osei",    "06", "ARTIST",      "LAUNCH", 170],
      ["Talia Nguyen",      "07", "ARTIST",      "REIGN",   140], ["Elijah Brooks", "08", "ARTIST",      "PUSH",   110],
      ["Yasmine Adler",     "09", "ARTIST",      "LAUNCH",  85],  ["Kwame Douglas", "10", "ARTIST",      "LAUNCH",  60],
      ["Luna Vasquez",      "11", "ARTIST",      "PUSH",    45],  ["Micah Thompson","12", "ARTIST",      "REIGN",   30],
      ["Ren Nakamura",      "13", "ARTIST",      "LAUNCH",  20],  ["Cleo Fontaine", "14", "ARTIST",      "PUSH",    10],
      ["Studio Owner 2",    "15", "STUDIO_ADMIN","LAUNCH",  180],
    ];
    for (const [name, suffix, role, tier, ago] of userSeed) {
      const email = `seed@demo-user-${suffix}.com`;
      const u = await db.user.upsert({
        where: { email },
        create: { email, passwordHash: DEMO_PW_HASH, name, artistSlug: `demo-user-${suffix}`, role, createdAt: daysAgo(ago), lastLoginAt: daysAgo(rand(0, Math.min(ago, 14))) },
        update: {},
      });
      await db.subscription.upsert({
        where: { userId: u.id },
        create: { userId: u.id, tier, status: ago > 60 && Math.random() > 0.8 ? "CANCELLED" : "ACTIVE", currentPeriodStart: daysAgo(rand(1, 28)), currentPeriodEnd: future(rand(1, 30)), aiVideoCreditsUsed: 0, aiVideoCreditsLimit: tier === "REIGN" ? 5 : tier === "PUSH" ? 3 : 1, aiArtCreditsUsed: 0, aiArtCreditsLimit: tier === "REIGN" ? 10 : tier === "PUSH" ? 5 : 2, aiMasterCreditsUsed: 0, aiMasterCreditsLimit: tier === "REIGN" ? 5 : tier === "PUSH" ? 3 : 1, lyricVideoCreditsUsed: 0, lyricVideoCreditsLimit: tier === "REIGN" ? 3 : tier === "PUSH" ? 1 : 0, aarReportCreditsUsed: 0, aarReportCreditsLimit: tier === "REIGN" ? 3 : tier === "PUSH" ? 1 : 0, pressKitCreditsUsed: 0, pressKitCreditsLimit: tier === "REIGN" ? 3 : tier === "PUSH" ? 1 : 0, createdAt: daysAgo(ago) },
        update: {},
      });
    }
    console.log("✓  Admin demo users: 15");
  } else {
    console.log("–  Admin demo users: already seeded");
  }

  // Revenue / Payment records across 6 months for MRR chart
  const payCount = await db.payment.count({ where: { type: "subscription" } });
  if (payCount < 20) {
    const tiers = ["LAUNCH","LAUNCH","LAUNCH","PUSH","PUSH","REIGN"];
    const amounts = { LAUNCH: 14.99, PUSH: 24.99, REIGN: 39.99 };
    const payRows = [];
    for (let month = 5; month >= 0; month--) {
      const n = rand(8, 22);
      for (let i = 0; i < n; i++) {
        const tier = pick(tiers);
        payRows.push({ userId: artist.id, type: "subscription", amount: amounts[tier], method: "stripe", status: "succeeded", metadata: { tier }, createdAt: daysAgo(month * 30 + rand(0, 28)) });
      }
    }
    await db.payment.createMany({ data: payRows });
    console.log(`✓  Payment records: ${payRows.length}`);
  } else {
    console.log("–  Payment records: already seeded");
  }

  // Admin-visible AI job log spread over 30 days
  const adminAiCount = await db.aIJob.count({ where: { createdAt: { gte: daysAgo(30) } } });
  if (adminAiCount < 10) {
    const jobTypes = ["VIDEO","COVER_ART","MASTERING","LYRIC_VIDEO","AR_REPORT","PRESS_KIT"];
    const aiJobRows = [];
    for (let i = 29; i >= 0; i--) {
      const n = rand(1, 5);
      for (let j = 0; j < n; j++) {
        const type = pick(jobTypes);
        const status = Math.random() > 0.1 ? "COMPLETE" : "FAILED";
        aiJobRows.push({ type, status, triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: type === "VIDEO" ? "runway" : "anthropic", costToUs: rand(3, 40) * 0.01, priceCharged: rand(199, 499) * 0.01, createdAt: daysAgo(i), completedAt: status === "COMPLETE" ? daysAgo(i) : null });
      }
    }
    await db.aIJob.createMany({ data: aiJobRows });
    console.log(`✓  Admin AI job log: ${aiJobRows.length} jobs`);
  } else {
    console.log("–  Admin AI jobs: already seeded");
  }

  // AI Insights log entries
  const aiInsightCount = await db.aIInsightsLog.count();
  if (aiInsightCount < 5) {
    await db.aIInsightsLog.createMany({
      data: [
        { insightType: "REVENUE_SUMMARY",   input: '{"period":"2025-03"}', output: '{"summary":"MRR grew 18% month-over-month driven by REIGN tier upgrades."}', accuracy: true,  createdAt: daysAgo(5) },
        { insightType: "CHURN_PREDICTION",  input: '{"userId":"demo01"}',  output: '{"riskLevel":"Medium","reasoning":"No login in 12 days, no tracks uploaded."}', accuracy: null, createdAt: daysAgo(3) },
        { insightType: "MODERATION_SCAN",   input: '{"studioId":"s01"}',   output: '{"flags":[],"verdict":"CLEAN"}', accuracy: true, createdAt: daysAgo(1) },
        { insightType: "SUPPORT_QUERY",     input: '{"query":"How do I upgrade my plan?"}', output: '{"answer":"Navigate to Dashboard > Settings > Upgrade."}', accuracy: true, createdAt: hoursAgo(6) },
      ],
    });
    console.log("✓  AI insights log: 4");
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n✅  Seed complete!");
  console.log("   Demo artist:  demo@indiethis.com  (password: password)");
  console.log("   Producers:    mikebeats@indiethis.com, lyricbeats@indiethis.com");
  console.log("   Admin login:  admin@indiethis.com");
  console.log("   Studio slug:  /southside-sound");
  console.log("   Artist slug:  /tyler-rhodes");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error("Seed error:", e);
    db.$disconnect();
    process.exit(1);
  });
