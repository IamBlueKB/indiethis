/**
 * Stream Lease Seed + Verification Script
 *
 * Creates test users, beats, leases, plays, and payments.
 * Run with:  npx tsx prisma/seed-stream-leases.ts
 *
 * What gets created:
 *   Users:    test-artist, producer-1, producer-2
 *   Beats:    3 beats (2 from prod-1, 1 from prod-2)
 *   Leases:   3 leases from test-artist on those 3 beats
 *   Plays:    50 / 150 / 500 plays per lease (700 total)
 *   Payments: 1 PAID payment showing $1.00 → $0.70 + $0.30 split
 *   Settings: BeatLeaseSettings for each beat
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ipHash(leaseNum: number, playIdx: number): string {
  return crypto
    .createHash("sha256")
    .update(`seed-lease-${leaseNum}-play-${playIdx}`)
    .digest("hex")
    .slice(0, 32);
}

/** Spread N play timestamps over the past `days` days */
function spreadDates(count: number, days = 30): Date[] {
  const now   = Date.now();
  const range = days * 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, i) => {
    const offset = Math.floor((i / count) * range);
    return new Date(now - range + offset);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  Seeding stream leases…\n");

  const pwHash = await bcrypt.hash("test1234", 10);
  const now    = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // ── Users ──────────────────────────────────────────────────────────────────

  const artist = await db.user.upsert({
    where:  { email: "test-artist@indiethis.dev" },
    update: {},
    create: {
      email:      "test-artist@indiethis.dev",
      name:       "Test Artist",
      artistName: "TSTARTIST",
      artistSlug: "tstartist",
      passwordHash: pwHash,
      role:       "ARTIST",
    },
  });

  const producer1 = await db.user.upsert({
    where:  { email: "producer1@indiethis.dev" },
    update: {},
    create: {
      email:      "producer1@indiethis.dev",
      name:       "DJ Nova",
      artistName: "DJ Nova",
      artistSlug: "djnova",
      passwordHash: pwHash,
      role:       "ARTIST",
    },
  });

  const producer2 = await db.user.upsert({
    where:  { email: "producer2@indiethis.dev" },
    update: {},
    create: {
      email:      "producer2@indiethis.dev",
      name:       "Sable Beats",
      artistName: "Sable Beats",
      artistSlug: "sablebeats",
      passwordHash: pwHash,
      role:       "ARTIST",
    },
  });

  console.log(`✓ Users: ${artist.name}, ${producer1.name}, ${producer2.name}`);

  // ── Subscriptions (needed for $1/mo billing context) ─────────────────────

  await db.subscription.upsert({
    where:  { userId: artist.id },
    update: {},
    create: {
      userId:              artist.id,
      tier:                "PUSH",
      status:              "ACTIVE",
      stripeSubscriptionId: "sub_seed_artist_001",
      currentPeriodStart:  now,
      currentPeriodEnd:    monthEnd,
      aiVideoCreditsLimit:  5,
      aiArtCreditsLimit:    20,
      aiMasterCreditsLimit: 10,
      lyricVideoCreditsLimit: 5,
      aarReportCreditsLimit:  3,
      pressKitCreditsLimit:   2,
    },
  });

  for (const p of [producer1, producer2]) {
    await db.subscription.upsert({
      where:  { userId: p.id },
      update: {},
      create: {
        userId:              p.id,
        tier:                "LAUNCH",
        status:              "ACTIVE",
        currentPeriodStart:  now,
        currentPeriodEnd:    monthEnd,
        aiVideoCreditsLimit:  1,
        aiArtCreditsLimit:    5,
        aiMasterCreditsLimit: 3,
        lyricVideoCreditsLimit: 1,
        aarReportCreditsLimit:  1,
        pressKitCreditsLimit:   1,
      },
    });
  }

  console.log("✓ Subscriptions created");

  // ── Beats (Tracks) ─────────────────────────────────────────────────────────

  const beat1 = await db.track.upsert({
    where:  { id: "seed-beat-midnight-trap-001" },
    update: {},
    create: {
      id:          "seed-beat-midnight-trap-001",
      artistId:    producer1.id,
      title:       "Midnight Trap Vol. 1",
      description: "Hard-hitting trap beat with 808s and dark melodies.",
      fileUrl:     "https://example.com/seed/midnight-trap.mp3",
      coverArtUrl: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&q=80",
      price:       29.99,
      status:      "PUBLISHED",
      bpm:         140,
      musicalKey:  "F# Minor",
    },
  });

  const beat2 = await db.track.upsert({
    where:  { id: "seed-beat-chill-rnb-002" },
    update: {},
    create: {
      id:          "seed-beat-chill-rnb-002",
      artistId:    producer1.id,
      title:       "Chill R&B Vibes",
      description: "Smooth R&B with vintage soul chops.",
      fileUrl:     "https://example.com/seed/chill-rnb.mp3",
      coverArtUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
      price:       24.99,
      status:      "PUBLISHED",
      bpm:         88,
      musicalKey:  "A Major",
    },
  });

  const beat3 = await db.track.upsert({
    where:  { id: "seed-beat-summer-bounce-003" },
    update: {},
    create: {
      id:          "seed-beat-summer-bounce-003",
      artistId:    producer2.id,
      title:       "Summer Bounce",
      description: "Energetic summer banger with catchy hooks.",
      fileUrl:     "https://example.com/seed/summer-bounce.mp3",
      coverArtUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80",
      price:       34.99,
      status:      "PUBLISHED",
      bpm:         118,
      musicalKey:  "C Major",
    },
  });

  console.log(`✓ Beats: "${beat1.title}", "${beat2.title}", "${beat3.title}"`);

  // ── BeatLeaseSettings ──────────────────────────────────────────────────────

  for (const beat of [beat1, beat2, beat3]) {
    await db.beatLeaseSettings.upsert({
      where:  { beatId: beat.id },
      update: {},
      create: {
        beatId:             beat.id,
        streamLeaseEnabled: true,
        maxStreamLeases:    beat.id === beat3.id ? 10 : null, // beat3 has a cap of 10
      },
    });
  }

  console.log("✓ BeatLeaseSettings created");

  // ── Stream Leases ──────────────────────────────────────────────────────────

  const leaseData = [
    {
      id:          "seed-lease-late-nights-001",
      beatId:      beat1.id,
      producerId:  producer1.id,
      trackTitle:  "Late Nights",
      audioUrl:    "https://example.com/seed/late-nights.mp3",
      coverUrl:    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80",
      playTarget:  500,
      activatedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    },
    {
      id:          "seed-lease-feelings-002",
      beatId:      beat2.id,
      producerId:  producer1.id,
      trackTitle:  "Feelings",
      audioUrl:    "https://example.com/seed/feelings.mp3",
      coverUrl:    null,
      playTarget:  150,
      activatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    },
    {
      id:          "seed-lease-good-times-003",
      beatId:      beat3.id,
      producerId:  producer2.id,
      trackTitle:  "Good Times",
      audioUrl:    "https://example.com/seed/good-times.mp3",
      coverUrl:    null,
      playTarget:  50,
      activatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),  // 5 days ago
    },
  ] as const;

  const leases: Array<{ id: string; trackTitle: string; beatTitle: string }> = [];

  for (const l of leaseData) {
    const lease = await db.streamLease.upsert({
      where:  { id: l.id },
      update: {},
      create: {
        id:         l.id,
        artistId:   artist.id,
        beatId:     l.beatId,
        producerId: l.producerId,
        trackTitle: l.trackTitle,
        audioUrl:   l.audioUrl,
        coverUrl:   l.coverUrl,
        isActive:   true,
        activatedAt: l.activatedAt,
      },
    });

    // Agreement record (minimal snapshot)
    await db.streamLeaseAgreement.upsert({
      where:  { streamLeaseId: lease.id },
      update: {},
      create: {
        streamLeaseId:    lease.id,
        agreementHtml:    `<p>Stream Lease Agreement for "${l.trackTitle}" — seed record</p>`,
        producerTerms:    { streamLeaseEnabled: true, creditFormat: "Prod. {producerName}", revocationPolicy: "A" },
        artistAcceptedAt: l.activatedAt,
      },
    });

    leases.push({ id: lease.id, trackTitle: l.trackTitle, beatTitle: "" });
  }

  console.log(`✓ Stream leases: ${leases.map((l) => `"${l.trackTitle}"`).join(", ")}`);

  // ── Play Records ───────────────────────────────────────────────────────────
  // Delete existing seed plays first so re-runs don't double-count
  for (let i = 0; i < leaseData.length; i++) {
    const leaseId = leaseData[i].id;
    await db.streamLeasePlay.deleteMany({ where: { streamLeaseId: leaseId } });

    const playCount = leaseData[i].playTarget;
    const dates     = spreadDates(playCount);

    await db.streamLeasePlay.createMany({
      data: Array.from({ length: playCount }, (_, j) => ({
        streamLeaseId: leaseId,
        viewerIpHash:  ipHash(i + 1, j),
        playedAt:      dates[j],
      })),
    });

    console.log(`  ✓ ${playCount} plays → "${leaseData[i].trackTitle}"`);
  }

  // ── Payment Record ─────────────────────────────────────────────────────────
  // 1 PAID payment for Lease 1 ("Late Nights") showing the $0.70/$0.30 split
  const existingPayment = await db.streamLeasePayment.findFirst({
    where: { streamLeaseId: leaseData[0].id, stripeInvoiceId: "in_seed_test_lease_001" },
  });

  if (!existingPayment) {
    await db.streamLeasePayment.create({
      data: {
        streamLeaseId:   leaseData[0].id,
        artistId:        artist.id,
        producerId:      producer1.id,
        totalAmount:     1.00,
        producerAmount:  0.70,
        platformAmount:  0.30,
        stripeInvoiceId: "in_seed_test_lease_001",
        status:          "PAID",
        paidAt:          new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("✓ Payment record: $1.00 total → $0.70 producer + $0.30 platform");
  } else {
    console.log("✓ Payment record already exists");
  }

  // ── Verification Summary ───────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("🔍  Verification\n");

  const totalLeases  = await db.streamLease.count({ where: { isActive: true } });
  const totalPlays   = await db.streamLeasePlay.count();
  const totalPayments = await db.streamLeasePayment.count({ where: { status: "PAID" } });

  console.log(`Active stream leases:  ${totalLeases}`);
  console.log(`Total play records:    ${totalPlays}`);
  console.log(`Paid payments:         ${totalPayments}`);

  // Per-lease play counts
  console.log("\nPlay counts per lease:");
  for (const ld of leaseData) {
    const count = await db.streamLeasePlay.count({ where: { streamLeaseId: ld.id } });
    const target = ld.playTarget;
    const status = count === target ? "✓" : "✗";
    console.log(`  ${status} "${ld.trackTitle}": ${count} / ${target} expected`);
  }

  // Producer earnings check
  console.log("\nProducer earnings:");
  const p1Payments = await db.streamLeasePayment.aggregate({
    where: { producerId: producer1.id, status: "PAID" },
    _sum:  { producerAmount: true },
  });
  const p2Payments = await db.streamLeasePayment.aggregate({
    where: { producerId: producer2.id, status: "PAID" },
    _sum:  { producerAmount: true },
  });
  console.log(`  DJ Nova (producer1):    $${(p1Payments._sum.producerAmount ?? 0).toFixed(2)} earned`);
  console.log(`  Sable Beats (producer2): $${(p2Payments._sum.producerAmount ?? 0).toFixed(2)} earned`);

  // Admin metrics
  const activeLeasePlatform = await db.streamLease.count({ where: { isActive: true } });
  const uniqueBeats = await db.streamLease.groupBy({ by: ["beatId"], where: { isActive: true } });
  console.log(`\nAdmin metrics:`);
  console.log(`  Active leases platform-wide: ${activeLeasePlatform}`);
  console.log(`  Platform revenue/mo:         $${(activeLeasePlatform * 0.30).toFixed(2)}`);
  console.log(`  Unique beats leased:         ${uniqueBeats.length}`);
  console.log(`  Total plays platform-wide:   ${totalPlays}`);

  console.log("\n" + "─".repeat(60));
  console.log("\n✅  Seed complete!\n");
  console.log("Login credentials (all users):");
  console.log("  test-artist@indiethis.dev  /  test1234");
  console.log("  producer1@indiethis.dev    /  test1234");
  console.log("  producer2@indiethis.dev    /  test1234\n");
  console.log("Verification checklist:");
  console.log("  [ ] /dashboard/stream-leases shows 3 active leases with play counts");
  console.log("  [ ] Upgrade prompt visible on 'Late Nights' (500 plays) and 'Feelings' (150)");
  console.log("  [ ] Create Stream Lease modal loads beat list (3 beats)");
  console.log("  [ ] /dashboard/marketplace?upgrade=seed-beat-midnight-trap-001 opens license modal");
  console.log("  [ ] /dashboard/earnings shows Stream Lease Income for producers");
  console.log("  [ ] /admin shows stream lease stats row (≥3 active, ≥700 plays)");
  console.log("  [ ] Cancel button marks lease inactive (does not delete)");
  console.log("  [ ] Reactivate restores within 30-day window");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
