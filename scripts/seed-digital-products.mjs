/**
 * seed-digital-products.mjs
 *
 * Wipes and re-seeds DigitalProducts for Jay Nova + Tyler Rhodes.
 * Albums: 5 tracks  |  EPs: 3 tracks  |  Singles: 1 track
 * All products are published so they appear in Music & Merch on /explore.
 *
 * Usage:  node scripts/seed-digital-products.mjs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // ── Lookup artists ──────────────────────────────────────────────────────────
  const jayNova = await db.user.findFirst({ where: { name: "Jay Nova" } });
  const tylerR  = await db.user.findFirst({ where: { name: "Tyler Rhodes" } });

  if (!jayNova || !tylerR) {
    console.error("❌  Artists not found in DB.");
    process.exit(1);
  }

  // ── Fetch existing tracks ───────────────────────────────────────────────────
  const jayTracks   = await db.track.findMany({ where: { artistId: jayNova.id }, orderBy: { createdAt: "asc" } });
  const tylerTracks = await db.track.findMany({ where: { artistId: tylerR.id  }, orderBy: { createdAt: "asc" } });

  console.log(`  Jay Nova: ${jayTracks.length} tracks`);
  console.log(`  Tyler Rhodes: ${tylerTracks.length} tracks`);

  if (!jayTracks.length || !tylerTracks.length) {
    console.error("❌  No tracks found — run seed-extras.mjs first.");
    process.exit(1);
  }

  // ── Wipe existing digital products ─────────────────────────────────────────
  console.log("\n🗑️   Clearing existing DigitalProducts…");

  // Disconnect track relations first (many-to-many), then delete
  const existing = await db.digitalProduct.findMany({
    where: { userId: { in: [jayNova.id, tylerR.id] } },
    select: { id: true },
  });

  for (const dp of existing) {
    await db.digitalProduct.update({
      where: { id: dp.id },
      data:  { tracks: { set: [] } },
    });
  }

  await db.digitalProduct.deleteMany({
    where: { userId: { in: [jayNova.id, tylerR.id] } },
  });

  console.log(`  ✓ Deleted ${existing.length} existing products`);

  // ── Unsplash cover art per release ─────────────────────────────────────────
  const COVERS = {
    jayAlbum:   "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
    jayEP:      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80",
    jaySingle:  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
    tylerAlbum: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80",
    tylerEP:    "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&q=80",
    tylerSingle:"https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&q=80",
  };

  // ── Jay Nova ────────────────────────────────────────────────────────────────
  console.log("\n💿  Seeding Jay Nova digital products…");

  // Album — all available tracks (up to 5)
  const jayAlbumTracks = jayTracks.slice(0, 5);
  await db.digitalProduct.create({
    data: {
      userId:      jayNova.id,
      type:        "ALBUM",
      title:       "Elevation",
      price:       999,
      description: "Jay Nova's debut full-length. 5 tracks of cinematic trap, alt-R&B, and raw bars. Every record on this project was produced and written entirely by Jay Nova.",
      coverArtUrl: COVERS.jayAlbum,
      genre:       "Hip-Hop / R&B",
      releaseYear: 2025,
      producer:    "Jay Nova",
      songwriter:  "Jay Nova",
      explicit:    true,
      published:   true,
      tracks:      { connect: jayAlbumTracks.map(t => ({ id: t.id })) },
    },
  });
  console.log(`  ✓ Elevation (Album) — ${jayAlbumTracks.length} tracks @ $9.99`);

  // EP — first 3 tracks
  const jayEPTracks = jayTracks.slice(0, 3);
  await db.digitalProduct.create({
    data: {
      userId:      jayNova.id,
      type:        "EP",
      title:       "Echoes EP",
      price:       499,
      description: "A 3-track EP showcasing Jay Nova's melodic range. Stripped-back production, layered vocals, and honest lyricism.",
      coverArtUrl: COVERS.jayEP,
      genre:       "R&B / Alt-Trap",
      releaseYear: 2024,
      producer:    "Jay Nova, Nova Beats",
      songwriter:  "Jay Nova",
      explicit:    false,
      published:   true,
      tracks:      { connect: jayEPTracks.map(t => ({ id: t.id })) },
    },
  });
  console.log(`  ✓ Echoes EP — ${jayEPTracks.length} tracks @ $4.99`);

  // Single — 1 track
  if (jayTracks[0]) {
    await db.digitalProduct.create({
      data: {
        userId:      jayNova.id,
        type:        "SINGLE",
        title:       jayTracks[0].title,
        price:       149,
        description: `The lead single from Elevation. Stream it here or own it forever.`,
        coverArtUrl: jayTracks[0].coverArtUrl ?? COVERS.jaySingle,
        genre:       "Hip-Hop",
        releaseYear: 2025,
        producer:    "Jay Nova",
        songwriter:  "Jay Nova",
        explicit:    true,
        published:   true,
        tracks:      { connect: [{ id: jayTracks[0].id }] },
      },
    });
    console.log(`  ✓ ${jayTracks[0].title} (Single) — 1 track @ $1.49`);
  }

  // ── Tyler Rhodes ────────────────────────────────────────────────────────────
  console.log("\n💿  Seeding Tyler Rhodes digital products…");

  // Album — all available tracks (up to 5)
  const tylerAlbumTracks = tylerTracks.slice(0, 5);
  await db.digitalProduct.create({
    data: {
      userId:      tylerR.id,
      type:        "ALBUM",
      title:       "Midnight City",
      price:       1199,
      description: "Tyler Rhodes' breakthrough project. 5 tracks of Atlanta-bred hip-hop and R&B that blur the line between street and soul.",
      coverArtUrl: COVERS.tylerAlbum,
      genre:       "Hip-Hop / R&B",
      releaseYear: 2025,
      producer:    "Tyler Rhodes",
      songwriter:  "Tyler Rhodes",
      explicit:    true,
      published:   true,
      tracks:      { connect: tylerAlbumTracks.map(t => ({ id: t.id })) },
    },
  });
  console.log(`  ✓ Midnight City (Album) — ${tylerAlbumTracks.length} tracks @ $11.99`);

  // EP — first 3 tracks
  const tylerEPTracks = tylerTracks.slice(0, 3);
  await db.digitalProduct.create({
    data: {
      userId:      tylerR.id,
      type:        "EP",
      title:       "Golden Hour EP",
      price:       599,
      description: "3 records taped late night in Atlanta. Hazy production, smooth delivery, no features.",
      coverArtUrl: COVERS.tylerEP,
      genre:       "R&B / Hip-Hop",
      releaseYear: 2024,
      producer:    "Tyler Rhodes, South Side",
      songwriter:  "Tyler Rhodes",
      explicit:    false,
      published:   true,
      tracks:      { connect: tylerEPTracks.map(t => ({ id: t.id })) },
    },
  });
  console.log(`  ✓ Golden Hour EP — ${tylerEPTracks.length} tracks @ $5.99`);

  // Single — 1 track
  if (tylerTracks[0]) {
    await db.digitalProduct.create({
      data: {
        userId:      tylerR.id,
        type:        "SINGLE",
        title:       tylerTracks[0].title,
        price:       149,
        description: `Lead single from Midnight City. Own it.`,
        coverArtUrl: tylerTracks[0].coverArtUrl ?? COVERS.tylerSingle,
        genre:       "Hip-Hop",
        releaseYear: 2025,
        producer:    "Tyler Rhodes",
        songwriter:  "Tyler Rhodes",
        explicit:    true,
        published:   true,
        tracks:      { connect: [{ id: tylerTracks[0].id }] },
      },
    });
    console.log(`  ✓ ${tylerTracks[0].title} (Single) — 1 track @ $1.49`);
  }

  console.log("\n✅  Done. 6 digital products seeded.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
