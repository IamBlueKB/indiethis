/**
 * Publish artist sites for seed users so their public pages
 * are accessible and links on the explore page don't 404.
 *
 * Run with:  npx tsx prisma/seed-artist-sites.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const SEED_ARTISTS = [
  {
    email:     "test-artist@indiethis.dev",
    slug:      "tstartist",
    name:      "TSTARTIST",
    bio:       "Chicago-based artist and producer. Making waves in trap and R&B.",
    genre:     "Hip-Hop",
    role:      "Artist & Producer",
    city:      "Chicago, IL",
  },
  {
    email:     "producer1@indiethis.dev",
    slug:      "djnova",
    name:      "DJ Nova",
    bio:       "Electronic producer and DJ. Lo-fi, house, and everything in between.",
    genre:     "Electronic",
    role:      "Producer / DJ",
    city:      "Atlanta, GA",
  },
  {
    email:     "producer2@indiethis.dev",
    slug:      "sablebeats",
    name:      "Sable Beats",
    bio:       "Crafting cinematic beats for artists ready to make a statement.",
    genre:     "R&B",
    role:      "Producer",
    city:      "Los Angeles, CA",
  },
];

async function main() {
  console.log("\n🌱  Publishing seed artist sites…\n");

  for (const a of SEED_ARTISTS) {
    const user = await db.user.findUnique({ where: { email: a.email } });
    if (!user) {
      console.log(`  ⚠️  User not found: ${a.email} — skipping`);
      continue;
    }

    await db.artistSite.upsert({
      where:  { artistId: user.id },
      update: {
        isPublished: true,
        draftMode:   false,
        bioContent:  a.bio,
        genre:       a.genre,
        role:        a.role,
        city:        a.city,
      },
      create: {
        artistId:    user.id,
        isPublished: true,
        draftMode:   false,
        bioContent:  a.bio,
        genre:       a.genre,
        role:        a.role,
        city:        a.city,
        showMusic:   true,
        showVideos:  false,
        showMerch:   false,
      },
    });

    console.log(`  ✅  ${a.slug} (${a.name}) — site published`);
  }

  console.log("\nDone.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
