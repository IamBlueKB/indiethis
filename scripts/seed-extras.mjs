/**
 * seed-extras.mjs — patch all missing data on top of existing seeded records.
 *
 * Run: node scripts/seed-extras.mjs
 * Idempotent — safe to run multiple times.
 *
 * Covers:
 *  1. AudioFeatures for all Jay Nova + Tyler Rhodes + beat tracks
 *  2. genre / producer / songwriter / featuredArtists on those tracks
 *  3. djMode + DJProfile + Crate + CrateItems for Jay Nova
 *  4. Published ArtistSite for Mike Beats + LyricBeats
 *  5. DigitalProducts for Jay Nova + Tyler Rhodes
 *  6. MerchProducts + MerchVariants (correct schema) for Jay Nova + Tyler Rhodes
 *  7. Sample MerchOrders + MerchOrderItems
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function daysAgo(n) { return new Date(Date.now() - n * 86400_000); }
function future(n)  { return new Date(Date.now() + n * 86400_000); }

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  seed-extras — patching missing data…\n");

  // ── Resolve user IDs ─────────────────────────────────────────────────────

  const jayNova   = await db.user.findUnique({ where: { email: "artist@indiethis.dev"  } });
  const tylerR    = await db.user.findUnique({ where: { email: "demo@indiethis.com"     } });
  const mikeB     = await db.user.findUnique({ where: { email: "mikebeats@indiethis.com" } });
  const lyricB    = await db.user.findUnique({ where: { email: "lyricbeats@indiethis.com" } });

  if (!jayNova) { console.error("❌  Jay Nova not found — run seed-test-accounts.mjs first"); process.exit(1); }
  if (!tylerR)  { console.error("❌  Tyler Rhodes not found — run seed-all.mjs first");       process.exit(1); }
  if (!mikeB)   { console.error("❌  Mike Beats not found — run seed-all.mjs first");          process.exit(1); }
  if (!lyricB)  { console.error("❌  LyricBeats not found — run seed-all.mjs first");          process.exit(1); }

  console.log("✓  Resolved all users");

  // ── 1. AudioFeatures + track metadata ────────────────────────────────────

  console.log("\n🎵  Upserting AudioFeatures + track metadata…");

  // Jay Nova tracks
  const jayTracks = [
    { title: "Elevate",      genre: "Hip-Hop",       producer: "Jay Nova",  songwriter: "Jay Nova",           featuredArtists: null,        bpm: 132, energy: 0.88, danceability: 0.76, valence: 0.72, acousticness: 0.08, instrumentalness: 0.05, liveness: 0.12, speechiness: 0.28, loudness: 0.82, mood: "Energetic", isVocal: true },
    { title: "Cold Summer",  genre: "Trap / R&B",    producer: "Jay Nova",  songwriter: "Jay Nova",           featuredArtists: null,        bpm: 98,  energy: 0.65, danceability: 0.68, valence: 0.40, acousticness: 0.18, instrumentalness: 0.03, liveness: 0.09, speechiness: 0.22, loudness: 0.70, mood: "Melancholic", isVocal: true },
    { title: "Neon Dreams",  genre: "Alt-Trap",      producer: "Jay Nova",  songwriter: "Jay Nova",           featuredArtists: null,        bpm: 142, energy: 0.92, danceability: 0.80, valence: 0.60, acousticness: 0.05, instrumentalness: 0.10, liveness: 0.15, speechiness: 0.18, loudness: 0.88, mood: "Euphoric",   isVocal: true },
    { title: "City Pulse",   genre: "Hip-Hop",       producer: "Nova Beats",songwriter: "Jay Nova",           featuredArtists: "Drea Vox",  bpm: 112, energy: 0.75, danceability: 0.82, valence: 0.65, acousticness: 0.10, instrumentalness: 0.02, liveness: 0.11, speechiness: 0.25, loudness: 0.76, mood: "Upbeat",     isVocal: true },
    { title: "Midnight Run", genre: "R&B",           producer: "Jay Nova",  songwriter: "Jay Nova",           featuredArtists: null,        bpm: 82,  energy: 0.50, danceability: 0.62, valence: 0.35, acousticness: 0.32, instrumentalness: 0.04, liveness: 0.08, speechiness: 0.12, loudness: 0.60, mood: "Chill",      isVocal: true },
  ];

  // Tyler Rhodes tracks
  const tylerTracks = [
    { title: "Midnight Drive", genre: "Hip-Hop",     producer: "Tyler Rhodes", songwriter: "Tyler Rhodes",    featuredArtists: null,        bpm: 128, energy: 0.85, danceability: 0.79, valence: 0.55, acousticness: 0.06, instrumentalness: 0.04, liveness: 0.13, speechiness: 0.24, loudness: 0.84, mood: "Energetic",  isVocal: true },
    { title: "Golden Hour",    genre: "R&B / Soul",  producer: "Tyler Rhodes", songwriter: "Tyler Rhodes",    featuredArtists: null,        bpm: 95,  energy: 0.62, danceability: 0.71, valence: 0.78, acousticness: 0.25, instrumentalness: 0.02, liveness: 0.10, speechiness: 0.14, loudness: 0.68, mood: "Happy",      isVocal: true },
    { title: "Neon Nights",    genre: "Trap",         producer: "Tyler Rhodes", songwriter: "Tyler Rhodes",   featuredArtists: "Lena Blue", bpm: 140, energy: 0.90, danceability: 0.77, valence: 0.50, acousticness: 0.04, instrumentalness: 0.08, liveness: 0.16, speechiness: 0.20, loudness: 0.90, mood: "Aggressive", isVocal: true },
    { title: "City Lights",    genre: "Hip-Hop",      producer: "Tyler Rhodes", songwriter: "Tyler Rhodes",   featuredArtists: null,        bpm: 110, energy: 0.72, danceability: 0.75, valence: 0.60, acousticness: 0.09, instrumentalness: 0.03, liveness: 0.09, speechiness: 0.22, loudness: 0.74, mood: "Upbeat",     isVocal: true },
    { title: "Ocean Waves",    genre: "Alt-R&B",      producer: "Tyler Rhodes", songwriter: "Tyler Rhodes",   featuredArtists: null,        bpm: 80,  energy: 0.45, danceability: 0.58, valence: 0.42, acousticness: 0.40, instrumentalness: 0.06, liveness: 0.07, speechiness: 0.10, loudness: 0.55, mood: "Chill",      isVocal: true },
  ];

  // Beat tracks
  const beatTracksData = [
    { artistId: mikeB.id,  title: "808 Vibez",   genre: "Trap",       producer: "Mike Beats",          songwriter: null, featuredArtists: null, energy: 0.94, danceability: 0.72, valence: 0.38, acousticness: 0.02, instrumentalness: 0.92, liveness: 0.08, speechiness: 0.06, loudness: 0.92, mood: "Aggressive", isVocal: false },
    { artistId: mikeB.id,  title: "Trap Wave",   genre: "Trap",       producer: "Mike Beats",          songwriter: null, featuredArtists: null, energy: 0.91, danceability: 0.68, valence: 0.30, acousticness: 0.03, instrumentalness: 0.95, liveness: 0.09, speechiness: 0.04, loudness: 0.90, mood: "Dark",       isVocal: false },
    { artistId: mikeB.id,  title: "Night Ride",  genre: "Trap / R&B", producer: "Mike Beats",          songwriter: null, featuredArtists: null, energy: 0.60, danceability: 0.65, valence: 0.35, acousticness: 0.15, instrumentalness: 0.88, liveness: 0.07, speechiness: 0.05, loudness: 0.65, mood: "Melancholic", isVocal: false },
    { artistId: lyricB.id, title: "Soul Sample", genre: "Boom-Bap",   producer: "LyricBeats Official", songwriter: null, featuredArtists: null, energy: 0.65, danceability: 0.70, valence: 0.55, acousticness: 0.45, instrumentalness: 0.85, liveness: 0.12, speechiness: 0.05, loudness: 0.62, mood: "Soulful",    isVocal: false },
    { artistId: lyricB.id, title: "R&B Groove",  genre: "R&B",        producer: "LyricBeats Official", songwriter: null, featuredArtists: null, energy: 0.55, danceability: 0.78, valence: 0.68, acousticness: 0.30, instrumentalness: 0.90, liveness: 0.08, speechiness: 0.04, loudness: 0.58, mood: "Romantic",   isVocal: false },
    { artistId: lyricB.id, title: "Latin Drill", genre: "Drill",      producer: "LyricBeats Official", songwriter: null, featuredArtists: null, energy: 0.88, danceability: 0.74, valence: 0.45, acousticness: 0.06, instrumentalness: 0.93, liveness: 0.14, speechiness: 0.05, loudness: 0.88, mood: "Energetic",  isVocal: false },
  ];

  async function upsertAudioAndMeta(artistId, trackDef) {
    const { title, genre, producer, songwriter, featuredArtists, energy, danceability, valence,
            acousticness, instrumentalness, liveness, speechiness, loudness, mood, isVocal } = trackDef;

    const track = await db.track.findFirst({ where: { artistId, title } });
    if (!track) {
      console.log(`  – Track not found: "${title}" (artistId=${artistId}) — skipping`);
      return null;
    }

    // Update track metadata
    await db.track.update({
      where: { id: track.id },
      data: { genre, producer: producer ?? undefined, songwriter: songwriter ?? undefined, featuredArtists: featuredArtists ?? undefined },
    });

    // Upsert AudioFeatures
    await db.audioFeatures.upsert({
      where:  { trackId: track.id },
      create: { trackId: track.id, energy, danceability, valence, acousticness, instrumentalness, liveness, speechiness, loudness, mood, genre, isVocal },
      update: { energy, danceability, valence, acousticness, instrumentalness, liveness, speechiness, loudness, mood, genre, isVocal },
    });

    return track;
  }

  const jayTrackRecords = [];
  for (const t of jayTracks) {
    const r = await upsertAudioAndMeta(jayNova.id, t);
    if (r) jayTrackRecords.push(r);
  }
  console.log(`  ✓ Jay Nova: ${jayTrackRecords.length} tracks patched`);

  const tylerTrackRecords = [];
  for (const t of tylerTracks) {
    const r = await upsertAudioAndMeta(tylerR.id, t);
    if (r) tylerTrackRecords.push(r);
  }
  console.log(`  ✓ Tyler Rhodes: ${tylerTrackRecords.length} tracks patched`);

  for (const t of beatTracksData) {
    await upsertAudioAndMeta(t.artistId, t);
  }
  console.log(`  ✓ Beat tracks: ${beatTracksData.length} tracks patched`);

  // ── 2. DJ Mode + DJProfile + Crate for Jay Nova ──────────────────────────

  console.log("\n🎧  Setting up DJ mode for Jay Nova…");

  await db.user.update({ where: { id: jayNova.id }, data: { djMode: true, djDiscoveryOptIn: true } });
  console.log("  ✓ djMode = true");

  let djProfile = await db.dJProfile.findUnique({ where: { userId: jayNova.id } });
  if (!djProfile) {
    djProfile = await db.dJProfile.create({
      data: {
        userId:          jayNova.id,
        slug:            "jay-nova-dj",
        bio:             "Chicago-based DJ and producer. Specialties: hip-hop, trap, and alt-R&B. Resident at Thalia Hall.",
        genres:          ["Hip-Hop", "Trap", "R&B", "Alt-Trap"],
        city:            "Chicago, IL",
        profilePhotoUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
        isVerified:      false,
        verificationStatus: "NONE",
      },
    });
    console.log("  ✓ DJProfile created:", djProfile.slug);
  } else {
    console.log("  – DJProfile already exists:", djProfile.slug);
  }

  // Crates
  const crateCount = await db.crate.count({ where: { djProfileId: djProfile.id } });
  if (crateCount === 0) {
    const mainCrate = await db.crate.create({
      data: {
        djProfileId: djProfile.id,
        name:        "Main Set — Spring 2025",
        description: "My go-to club set. Hits and transitions that work every time.",
        isPublic:    true,
        coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400",
      },
    });

    const studyCrate = await db.crate.create({
      data: {
        djProfileId: djProfile.id,
        name:        "Study / Reference Tracks",
        description: "Tracks I'm studying for production inspiration.",
        isPublic:    false,
      },
    });

    // Add items to main crate (use Jay Nova tracks + Tyler Rhodes tracks)
    const allForCrate = [...jayTrackRecords, ...tylerTrackRecords];
    for (let i = 0; i < Math.min(allForCrate.length, 6); i++) {
      await db.crateItem.create({
        data: {
          crateId: mainCrate.id,
          trackId: allForCrate[i].id,
          notes:   i === 0 ? "Opener — crowd always goes up" : i === 1 ? "Energy peak" : null,
          addedAt: daysAgo(10 - i),
        },
      });
    }

    // Study crate — Tyler Rhodes tracks
    for (let i = 0; i < Math.min(tylerTrackRecords.length, 3); i++) {
      await db.crateItem.create({
        data: {
          crateId: studyCrate.id,
          trackId: tylerTrackRecords[i].id,
          notes:   "Reference for production",
          addedAt: daysAgo(5 - i),
        },
      });
    }

    console.log("  ✓ Crates: 2 (main + study), items added");
  } else {
    console.log("  – Crates: already seeded");
  }

  // ── 3. Publish ArtistSites for Mike Beats + LyricBeats ───────────────────

  console.log("\n🌐  Publishing artist sites for producers…");

  for (const [user, name, genre, city, role, bio] of [
    [mikeB,  "Mike Beats",          "Trap / Hip-Hop",  "Atlanta, GA",    "Producer",          "Top-charting trap producer from Atlanta. Credits include multi-gold singles. Available for custom beats and exclusive licenses."],
    [lyricB, "LyricBeats Official", "Boom-Bap / R&B",  "Los Angeles, CA","Producer & Beatmaker","Soulful beats for R&B and conscious hip-hop. Sample-based and original production. Catalog available now."],
  ]) {
    await db.artistSite.upsert({
      where:  { artistId: user.id },
      create: {
        artistId:    user.id,
        template:    "TEMPLATE_1",
        isPublished: true,
        draftMode:   false,
        heroImage:   user.photo ?? "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=1200",
        bioContent:  bio,
        showMusic:   true,
        showVideos:  false,
        showMerch:   true,
        showContact: true,
        genre,
        role,
        city,
        bookingRate: 500,
      },
      update: {
        isPublished: true,
        draftMode:   false,
        genre,
        role,
        city,
        bioContent:  bio,
      },
    });
    console.log(`  ✓ ${name} artist site published`);
  }

  // ── 4. DigitalProducts for Jay Nova + Tyler Rhodes ───────────────────────

  console.log("\n💿  Creating DigitalProducts…");

  // Jay Nova — "Elevation" album + "Echoes EP"
  const jayDpCount = await db.digitalProduct.count({ where: { userId: jayNova.id } });
  if (jayDpCount === 0 && jayTrackRecords.length > 0) {
    const jayAlbum = await db.digitalProduct.create({
      data: {
        userId:      jayNova.id,
        type:        "ALBUM",
        title:       "Elevation",
        price:       999,   // $9.99 in cents
        description: "Jay Nova's debut album. 5-track project blending hip-hop, trap, and alt-R&B.",
        coverArtUrl: jayTrackRecords[0].coverArtUrl,
        genre:       "Hip-Hop / R&B",
        releaseYear: 2025,
        producer:    "Jay Nova",
        songwriter:  "Jay Nova",
        published:   true,
        tracks:      { connect: jayTrackRecords.slice(0, 3).map(t => ({ id: t.id })) },
      },
    });

    const jayEP = await db.digitalProduct.create({
      data: {
        userId:      jayNova.id,
        type:        "EP",
        title:       "Echoes EP",
        price:       499,   // $4.99
        description: "A 2-track EP exploring Jay Nova's melodic side.",
        coverArtUrl: jayTrackRecords[3]?.coverArtUrl ?? jayTrackRecords[0].coverArtUrl,
        genre:       "R&B / Alt-Trap",
        releaseYear: 2024,
        producer:    "Jay Nova, Nova Beats",
        songwriter:  "Jay Nova",
        published:   true,
        tracks:      { connect: jayTrackRecords.slice(3).map(t => ({ id: t.id })) },
      },
    });

    console.log(`  ✓ Jay Nova: 2 digital products (Elevation album + Echoes EP)`);
  } else {
    console.log("  – Jay Nova DigitalProducts: already seeded or no tracks found");
  }

  // Tyler Rhodes — "Midnight City" album
  const tylerDpCount = await db.digitalProduct.count({ where: { userId: tylerR.id } });
  if (tylerDpCount === 0 && tylerTrackRecords.length > 0) {
    await db.digitalProduct.create({
      data: {
        userId:      tylerR.id,
        type:        "ALBUM",
        title:       "Midnight City",
        price:       1199,  // $11.99
        description: "Tyler Rhodes' breakthrough project. 5 tracks of Atlanta-bred hip-hop and R&B.",
        coverArtUrl: tylerTrackRecords[0].coverArtUrl,
        genre:       "Hip-Hop / R&B",
        releaseYear: 2025,
        producer:    "Tyler Rhodes",
        songwriter:  "Tyler Rhodes",
        published:   true,
        tracks:      { connect: tylerTrackRecords.slice(0, 3).map(t => ({ id: t.id })) },
      },
    });
    console.log(`  ✓ Tyler Rhodes: 1 digital product (Midnight City album)`);
  } else {
    console.log("  – Tyler Rhodes DigitalProducts: already seeded or no tracks found");
  }

  // ── 5. MerchProducts + Variants (correct schema) ─────────────────────────

  console.log("\n👕  Creating Merch products + variants…");

  // Jay Nova merch
  const jayMerchCount = await db.merchProduct.count({ where: { artistId: jayNova.id } });
  if (jayMerchCount === 0) {
    // T-shirt (Printful catalog ID 71)
    const jayTee = await db.merchProduct.create({
      data: {
        artistId:          jayNova.id,
        fulfillmentType:   "POD",
        printfulProductId: 71,
        title:             "Elevation Tee",
        description:       "Official Jay Nova 'Elevation' album tee. Premium heavyweight cotton, bold chest print.",
        imageUrl:          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600",
        markup:            15.00,
        isActive:          true,
      },
    });
    // T-shirt variants
    const teeVariants = [
      { size: "S",   color: "Black",  colorCode: "#000000", printfulVariantId: 10001, basePrice: 13.25 },
      { size: "M",   color: "Black",  colorCode: "#000000", printfulVariantId: 10002, basePrice: 13.25 },
      { size: "L",   color: "Black",  colorCode: "#000000", printfulVariantId: 10003, basePrice: 13.25 },
      { size: "XL",  color: "Black",  colorCode: "#000000", printfulVariantId: 10004, basePrice: 13.25 },
      { size: "M",   color: "White",  colorCode: "#FFFFFF", printfulVariantId: 10005, basePrice: 13.25 },
      { size: "L",   color: "White",  colorCode: "#FFFFFF", printfulVariantId: 10006, basePrice: 13.25 },
    ];
    for (const v of teeVariants) {
      await db.merchVariant.create({ data: { productId: jayTee.id, ...v, retailPrice: v.basePrice + 15.00, inStock: true } });
    }
    console.log("  ✓ Jay Nova: Elevation Tee + 6 variants");

    // Hoodie (Printful catalog ID 146)
    const jayHoodie = await db.merchProduct.create({
      data: {
        artistId:          jayNova.id,
        fulfillmentType:   "POD",
        printfulProductId: 146,
        title:             "Chicago Hoodie",
        description:       "Embroidered Jay Nova hoodie — Chicago on the chest, limited run.",
        imageUrl:          "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600",
        markup:            22.00,
        isActive:          true,
      },
    });
    const hoodieVariants = [
      { size: "S",  color: "Black", colorCode: "#000000", printfulVariantId: 20001, basePrice: 27.50 },
      { size: "M",  color: "Black", colorCode: "#000000", printfulVariantId: 20002, basePrice: 27.50 },
      { size: "L",  color: "Black", colorCode: "#000000", printfulVariantId: 20003, basePrice: 27.50 },
      { size: "XL", color: "Black", colorCode: "#000000", printfulVariantId: 20004, basePrice: 27.50 },
    ];
    for (const v of hoodieVariants) {
      await db.merchVariant.create({ data: { productId: jayHoodie.id, ...v, retailPrice: v.basePrice + 22.00, inStock: true } });
    }
    console.log("  ✓ Jay Nova: Chicago Hoodie + 4 variants");

    // Poster (Printful catalog ID 1)
    const jayPoster = await db.merchProduct.create({
      data: {
        artistId:          jayNova.id,
        fulfillmentType:   "POD",
        printfulProductId: 1,
        title:             "Neon Dreams Poster",
        description:       "Glossy fine-art print, numbered 18×24. Official album artwork.",
        imageUrl:          "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=600",
        markup:            18.00,
        isActive:          true,
      },
    });
    await db.merchVariant.create({ data: { productId: jayPoster.id, size: '18"×24"', color: "White", colorCode: "#FFFFFF", printfulVariantId: 30001, basePrice: 7.25, retailPrice: 25.25, inStock: true } });
    await db.merchVariant.create({ data: { productId: jayPoster.id, size: '24"×36"', color: "White", colorCode: "#FFFFFF", printfulVariantId: 30002, basePrice: 11.50, retailPrice: 29.50, inStock: true } });
    console.log("  ✓ Jay Nova: Neon Dreams Poster + 2 variants");

    // Sample orders for Jay Nova
    const jayVariants = await db.merchVariant.findMany({ where: { product: { artistId: jayNova.id } }, include: { product: true }, take: 3 });
    if (jayVariants.length >= 3) {
      const orderDefs = [
        { email: "jayla.m@gmail.com",      name: "Jayla Mitchell",  variant: jayVariants[0], qty: 1, days: 14, status: "DELIVERED" },
        { email: "marcus.bell@outlook.com",name: "Marcus Bell",     variant: jayVariants[1], qty: 2, days: 7,  status: "SHIPPED"   },
        { email: "drea.vox@gmail.com",      name: "Drea Vox",       variant: jayVariants[2], qty: 1, days: 21, status: "DELIVERED" },
      ];
      for (const o of orderDefs) {
        const unitPrice    = o.variant.retailPrice;
        const subtotal     = unitPrice * o.qty;
        const shipping     = 5.99;
        const total        = subtotal + shipping;
        const platformCut  = subtotal * 0.15;
        const artistEarns  = subtotal - (unitPrice - o.variant.product.markup) * o.qty - platformCut + o.variant.product.markup * o.qty;

        const order = await db.merchOrder.create({
          data: {
            artistId:         jayNova.id,
            buyerEmail:       o.email,
            buyerName:        o.name,
            shippingAddress:  { street: "123 Main St", city: "Chicago", state: "IL", zip: "60601", country: "US" },
            fulfillmentStatus: o.status,
            totalPrice:       total,
            shippingCost:     shipping,
            platformCut:      subtotal * 0.15,
            artistEarnings:   o.variant.product.markup * o.qty,
            createdAt:        daysAgo(o.days),
          },
        });
        await db.merchOrderItem.create({
          data: {
            orderId:   order.id,
            variantId: o.variant.id,
            productId: o.variant.productId,
            quantity:  o.qty,
            unitPrice,
            subtotal,
          },
        });
      }
      console.log("  ✓ Jay Nova: 3 sample orders");
    }
  } else {
    console.log("  – Jay Nova merch: already seeded");
  }

  // Tyler Rhodes merch
  const tylerMerchCount = await db.merchProduct.count({ where: { artistId: tylerR.id } });
  if (tylerMerchCount === 0) {
    // T-shirt
    const tylerTee = await db.merchProduct.create({
      data: {
        artistId:          tylerR.id,
        fulfillmentType:   "POD",
        printfulProductId: 71,
        title:             "Midnight City Tee",
        description:       "Tyler Rhodes 'Midnight City' album tee. Premium cotton, Atlanta-bred.",
        imageUrl:          "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600",
        markup:            14.00,
        isActive:          true,
      },
    });
    const tylerTeeVariants = [
      { size: "S",  color: "Black", colorCode: "#000000", printfulVariantId: 40001, basePrice: 13.25 },
      { size: "M",  color: "Black", colorCode: "#000000", printfulVariantId: 40002, basePrice: 13.25 },
      { size: "L",  color: "Black", colorCode: "#000000", printfulVariantId: 40003, basePrice: 13.25 },
      { size: "XL", color: "Black", colorCode: "#000000", printfulVariantId: 40004, basePrice: 13.25 },
      { size: "M",  color: "White", colorCode: "#FFFFFF", printfulVariantId: 40005, basePrice: 13.25 },
    ];
    for (const v of tylerTeeVariants) {
      await db.merchVariant.create({ data: { productId: tylerTee.id, ...v, retailPrice: v.basePrice + 14.00, inStock: true } });
    }
    console.log("  ✓ Tyler Rhodes: Midnight City Tee + 5 variants");

    // Mug (Printful catalog ID 19)
    const tylerMug = await db.merchProduct.create({
      data: {
        artistId:          tylerR.id,
        fulfillmentType:   "POD",
        printfulProductId: 19,
        title:             "Golden Hour Mug",
        description:       "11oz ceramic mug featuring 'Golden Hour' album art. Microwave + dishwasher safe.",
        imageUrl:          "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600",
        markup:            8.00,
        isActive:          true,
      },
    });
    await db.merchVariant.create({ data: { productId: tylerMug.id, size: "11oz", color: "White", colorCode: "#FFFFFF", printfulVariantId: 50001, basePrice: 7.25, retailPrice: 15.25, inStock: true } });
    await db.merchVariant.create({ data: { productId: tylerMug.id, size: "15oz", color: "White", colorCode: "#FFFFFF", printfulVariantId: 50002, basePrice: 8.50, retailPrice: 16.50, inStock: true } });
    console.log("  ✓ Tyler Rhodes: Golden Hour Mug + 2 variants");

    // Dad Hat (Printful catalog ID 162)
    const tylerHat = await db.merchProduct.create({
      data: {
        artistId:          tylerR.id,
        fulfillmentType:   "POD",
        printfulProductId: 162,
        title:             "ATL Dad Hat",
        description:       "Embroidered dad hat. Tyler Rhodes logo on front, ATL on side.",
        imageUrl:          "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600",
        markup:            12.00,
        isActive:          true,
      },
    });
    await db.merchVariant.create({ data: { productId: tylerHat.id, size: "One Size", color: "Black", colorCode: "#000000", printfulVariantId: 60001, basePrice: 12.75, retailPrice: 24.75, inStock: true } });
    await db.merchVariant.create({ data: { productId: tylerHat.id, size: "One Size", color: "Navy",  colorCode: "#1B2A4A", printfulVariantId: 60002, basePrice: 12.75, retailPrice: 24.75, inStock: true } });
    console.log("  ✓ Tyler Rhodes: ATL Dad Hat + 2 variants");

    // Sample orders for Tyler Rhodes
    const tylerVariants = await db.merchVariant.findMany({ where: { product: { artistId: tylerR.id } }, include: { product: true }, take: 3 });
    if (tylerVariants.length >= 2) {
      const orderDefs = [
        { email: "jayla.m@gmail.com",      name: "Jayla Mitchell", variant: tylerVariants[0], qty: 1, days: 30, status: "DELIVERED" },
        { email: "kflow99@gmail.com",       name: "K-Flow",         variant: tylerVariants[1], qty: 2, days: 10, status: "SHIPPED"   },
        { email: "sunrise.music@gmail.com", name: "SunRise",        variant: tylerVariants[2] ?? tylerVariants[0], qty: 3, days: 45, status: "DELIVERED" },
      ];
      for (const o of orderDefs) {
        const unitPrice   = o.variant.retailPrice;
        const subtotal    = unitPrice * o.qty;
        const shipping    = 5.99;
        const total       = subtotal + shipping;

        const order = await db.merchOrder.create({
          data: {
            artistId:         tylerR.id,
            buyerEmail:       o.email,
            buyerName:        o.name,
            shippingAddress:  { street: "456 Peachtree St", city: "Atlanta", state: "GA", zip: "30301", country: "US" },
            fulfillmentStatus: o.status,
            totalPrice:       total,
            shippingCost:     shipping,
            platformCut:      subtotal * 0.15,
            artistEarnings:   o.variant.product.markup * o.qty,
            createdAt:        daysAgo(o.days),
          },
        });
        await db.merchOrderItem.create({
          data: {
            orderId:   order.id,
            variantId: o.variant.id,
            productId: o.variant.productId,
            quantity:  o.qty,
            unitPrice,
            subtotal,
          },
        });
      }
      console.log("  ✓ Tyler Rhodes: 3 sample orders");
    }
  } else {
    console.log("  – Tyler Rhodes merch: already seeded");
  }

  // ── 6. Update artistBalance/totalEarnings ─────────────────────────────────

  console.log("\n💰  Updating artist balances…");

  const jayOrders = await db.merchOrder.aggregate({ where: { artistId: jayNova.id }, _sum: { artistEarnings: true } });
  const tylerOrders = await db.merchOrder.aggregate({ where: { artistId: tylerR.id }, _sum: { artistEarnings: true } });

  await db.user.update({ where: { id: jayNova.id }, data: { artistBalance: jayOrders._sum.artistEarnings ?? 0, artistTotalEarnings: jayOrders._sum.artistEarnings ?? 0 } });
  await db.user.update({ where: { id: tylerR.id  }, data: { artistBalance: tylerOrders._sum.artistEarnings ?? 0, artistTotalEarnings: tylerOrders._sum.artistEarnings ?? 0 } });

  console.log(`  ✓ Jay Nova balance: $${(jayOrders._sum.artistEarnings ?? 0).toFixed(2)}`);
  console.log(`  ✓ Tyler Rhodes balance: $${(tylerOrders._sum.artistEarnings ?? 0).toFixed(2)}`);

  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n✅  seed-extras complete!");
  console.log("   Jay Nova DJ slug:  /dj/jay-nova-dj");
  console.log("   Mike Beats site:   /mike-beats");
  console.log("   LyricBeats site:   /lyric-beats");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error("Seed error:", e.message ?? e);
    db.$disconnect();
    process.exit(1);
  });
