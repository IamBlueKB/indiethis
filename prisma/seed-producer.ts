/**
 * Producer Integration & License Vault Seed
 *
 * Builds on top of seed-stream-leases.ts (run that first, or let this upsert safely).
 *
 * What gets created / updated:
 *   ProducerProfile:  test-artist → "Wave Factory"
 *   Beats:            6 beats owned by test-artist (varied BPM, key, pricing)
 *   BeatLeaseSettings: one per beat
 *   Stream Leases:    3 leases (producer1 + producer2 leasing Wave Factory beats)
 *   Plays:            realistic play distribution on those 3 leases
 *   Payments:         2 PAID payments showing $0.70/$0.30 split
 *   Beat Licenses:    2 one-time sales on 2 of the beats
 *   LicenseDocuments: 1 Splice license on a beat + 1 AI receipt auto-generated
 *   AIJob (COVER_ART): completed job to hang the AI receipt on
 *
 * Run with:
 *   npx tsx prisma/seed-producer.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto           from "crypto";
import bcrypt           from "bcryptjs";

const db = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ipHash(label: string, idx: number): string {
  return crypto
    .createHash("sha256")
    .update(`wave-factory-${label}-${idx}`)
    .digest("hex")
    .slice(0, 32);
}

function spreadDates(count: number, days = 30, offsetDays = 0): Date[] {
  const end   = Date.now() - offsetDays * 86_400_000;
  const range = days * 86_400_000;
  return Array.from({ length: count }, (_, i) => {
    const frac = count === 1 ? 0.5 : i / (count - 1);
    return new Date(end - range + Math.floor(frac * range));
  });
}

// ─── Beat definitions ─────────────────────────────────────────────────────────

const BEATS = [
  {
    id:          "wf-beat-dark-matter-001",
    title:       "Dark Matter",
    description: "Moody trap with distorted 808s, pitch-shifted vocal chops, and a cinematic string swell.",
    fileUrl:     "https://example.com/seed/wave-factory/dark-matter.mp3",
    coverArtUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
    price:       29.99,
    bpm:         90,
    musicalKey:  "D Minor",
  },
  {
    id:          "wf-beat-solar-funk-002",
    title:       "Solar Funk",
    description: "Smooth R&B groove with vintage soul samples, live bass, and warm Rhodes chords.",
    fileUrl:     "https://example.com/seed/wave-factory/solar-funk.mp3",
    coverArtUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
    price:       24.99,
    bpm:         98,
    musicalKey:  "Eb Major",
  },
  {
    id:          "wf-beat-glass-grid-003",
    title:       "Glass Grid",
    description: "High-energy electronic production with modular synths, hard-clipping drums, and arp leads.",
    fileUrl:     "https://example.com/seed/wave-factory/glass-grid.mp3",
    coverArtUrl: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&q=80",
    price:       39.99,
    bpm:         140,
    musicalKey:  "C# Minor",
  },
  {
    id:          "wf-beat-ocean-drive-004",
    title:       "Ocean Drive",
    description: "Laid-back pop/hip-hop hybrid with steel pan samples, clean guitar, and a driving four-on-the-floor kick.",
    fileUrl:     "https://example.com/seed/wave-factory/ocean-drive.mp3",
    coverArtUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80",
    price:       19.99,
    bpm:         120,
    musicalKey:  "G Major",
  },
  {
    id:          "wf-beat-night-market-005",
    title:       "Night Market",
    description: "Lo-fi hip-hop with cassette-warped samples, dusty drums, and atmospheric field recordings.",
    fileUrl:     "https://example.com/seed/wave-factory/night-market.mp3",
    coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80",
    price:       34.99,
    bpm:         82,
    musicalKey:  "F Minor",
  },
  {
    id:          "wf-beat-pulse-006",
    title:       "Pulse",
    description: "Festival-ready EDM anthem with supersaw leads, heavy sidechaining, and a massive drop.",
    fileUrl:     "https://example.com/seed/wave-factory/pulse.mp3",
    coverArtUrl: "https://images.unsplash.com/photo-1598387993441-a364f854cfbd?w=400&q=80",
    price:       44.99,
    bpm:         128,
    musicalKey:  "Ab Major",
  },
] as const;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  Seeding producer integration & license vault…\n");

  const pwHash = await bcrypt.hash("test1234", 10);
  const now    = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // ── Ensure base users exist ──────────────────────────────────────────────────

  const artist = await db.user.upsert({
    where:  { email: "test-artist@indiethis.dev" },
    update: {},
    create: {
      email:        "test-artist@indiethis.dev",
      name:         "Test Artist",
      artistName:   "TSTARTIST",
      artistSlug:   "tstartist",
      passwordHash: pwHash,
      role:         "ARTIST",
    },
  });

  const producer1 = await db.user.upsert({
    where:  { email: "producer1@indiethis.dev" },
    update: {},
    create: {
      email:        "producer1@indiethis.dev",
      name:         "DJ Nova",
      artistName:   "DJ Nova",
      artistSlug:   "djnova",
      passwordHash: pwHash,
      role:         "ARTIST",
    },
  });

  const producer2 = await db.user.upsert({
    where:  { email: "producer2@indiethis.dev" },
    update: {},
    create: {
      email:        "producer2@indiethis.dev",
      name:         "Sable Beats",
      artistName:   "Sable Beats",
      artistSlug:   "sablebeats",
      passwordHash: pwHash,
      role:         "ARTIST",
    },
  });

  // Ensure subscriptions exist (idempotent)
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

  console.log(`✓ Users: ${artist.name} (${artist.email}), ${producer1.name}, ${producer2.name}`);

  // ── ProducerProfile for test-artist (Wave Factory) ───────────────────────────

  await db.producerProfile.upsert({
    where:  { userId: artist.id },
    update: {
      displayName:              "Wave Factory",
      bio:                      "Wave Factory is an independent beat producer specialising in trap, R&B, and electronic music. Every beat is crafted to give artists a professional foundation — from first draft to final mix.",
      defaultLeasePrice:        1.00,
      defaultNonExclusivePrice: 29.99,
      defaultExclusivePrice:    149.99,
    },
    create: {
      userId:                   artist.id,
      displayName:              "Wave Factory",
      bio:                      "Wave Factory is an independent beat producer specialising in trap, R&B, and electronic music. Every beat is crafted to give artists a professional foundation — from first draft to final mix.",
      defaultLeasePrice:        1.00,
      defaultNonExclusivePrice: 29.99,
      defaultExclusivePrice:    149.99,
    },
  });

  console.log("✓ ProducerProfile: Wave Factory");

  // ── 6 Beats ──────────────────────────────────────────────────────────────────

  const beats = await Promise.all(
    BEATS.map((b) =>
      db.track.upsert({
        where:  { id: b.id },
        update: {},
        create: {
          id:          b.id,
          artistId:    artist.id,
          title:       b.title,
          description: b.description,
          fileUrl:     b.fileUrl,
          coverArtUrl: b.coverArtUrl,
          price:       b.price,
          status:      "PUBLISHED",
          bpm:         b.bpm,
          musicalKey:  b.musicalKey,
        },
      })
    )
  );

  console.log(`✓ Beats (6): ${beats.map((b) => `"${b.title}"`).join(", ")}`);

  // ── BeatLeaseSettings ────────────────────────────────────────────────────────

  await Promise.all(
    beats.map((beat, i) =>
      db.beatLeaseSettings.upsert({
        where:  { beatId: beat.id },
        update: {},
        create: {
          beatId:             beat.id,
          streamLeaseEnabled: true,
          maxStreamLeases:    i === 2 ? 5 : null, // "Glass Grid" is capped at 5
          creditFormat:       "Prod. Wave Factory",
          revocationPolicy:   i < 3 ? "A" : "B",
        },
      })
    )
  );

  console.log("✓ BeatLeaseSettings for all 6 beats");

  // ── Stream Leases (beats 0–2: Dark Matter, Solar Funk, Glass Grid) ───────────
  //    producer1 (DJ Nova) leases Dark Matter + Solar Funk
  //    producer2 (Sable Beats) leases Glass Grid

  const leaseConfigs = [
    {
      id:          "wf-lease-djnova-dark-matter-001",
      beatId:      beats[0].id,
      artistId:    producer1.id,
      title:       "Midnight Run",
      audioUrl:    "https://example.com/seed/wave-factory/midnight-run.mp3",
      coverUrl:    "https://images.unsplash.com/photo-1519683109079-d5f539e1542f?w=400&q=80",
      playCount:   320,
      daysAgo:     22,
    },
    {
      id:          "wf-lease-djnova-solar-funk-002",
      beatId:      beats[1].id,
      artistId:    producer1.id,
      title:       "Higher Ground",
      audioUrl:    "https://example.com/seed/wave-factory/higher-ground.mp3",
      coverUrl:    null,
      playCount:   185,
      daysAgo:     14,
    },
    {
      id:          "wf-lease-sable-glass-grid-003",
      beatId:      beats[2].id,
      artistId:    producer2.id,
      title:       "Voltage",
      audioUrl:    "https://example.com/seed/wave-factory/voltage.mp3",
      coverUrl:    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
      playCount:   95,
      daysAgo:     8,
    },
  ] as const;

  const leases: Array<{ id: string; title: string }> = [];

  for (const cfg of leaseConfigs) {
    const activatedAt = new Date(Date.now() - cfg.daysAgo * 86_400_000);

    const lease = await db.streamLease.upsert({
      where:  { id: cfg.id },
      update: {},
      create: {
        id:          cfg.id,
        artistId:    cfg.artistId,
        beatId:      cfg.beatId,
        producerId:  artist.id,          // Wave Factory is the producer
        trackTitle:  cfg.title,
        audioUrl:    cfg.audioUrl,
        coverUrl:    cfg.coverUrl ?? null,
        isActive:    true,
        activatedAt,
      },
    });

    await db.streamLeaseAgreement.upsert({
      where:  { streamLeaseId: lease.id },
      update: {},
      create: {
        streamLeaseId:    lease.id,
        agreementHtml:    `<p>Stream Lease Agreement for "${cfg.title}" — Wave Factory</p>`,
        producerTerms:    { streamLeaseEnabled: true, creditFormat: "Prod. Wave Factory", revocationPolicy: "A" },
        artistAcceptedAt: activatedAt,
      },
    });

    leases.push({ id: lease.id, title: cfg.title });
  }

  console.log(`✓ Stream leases (3): ${leases.map((l) => `"${l.title}"`).join(", ")}`);

  // ── Play records ─────────────────────────────────────────────────────────────

  for (let i = 0; i < leaseConfigs.length; i++) {
    const cfg   = leaseConfigs[i];
    const lease = leases[i];

    await db.streamLeasePlay.deleteMany({ where: { streamLeaseId: lease.id } });

    const dates = spreadDates(cfg.playCount, cfg.daysAgo);
    await db.streamLeasePlay.createMany({
      data: dates.map((playedAt, j) => ({
        streamLeaseId: lease.id,
        viewerIpHash:  ipHash(lease.id, j),
        playedAt,
      })),
    });

    console.log(`  ✓ ${cfg.playCount} plays → "${cfg.title}"`);
  }

  // ── Payments (leases 0 + 1 have paid invoices) ───────────────────────────────

  for (let i = 0; i < 2; i++) {
    const cfg     = leaseConfigs[i];
    const lease   = leases[i];
    const invoiceId = `in_wf_seed_${i + 1}`;

    const existing = await db.streamLeasePayment.findFirst({
      where: { streamLeaseId: lease.id, stripeInvoiceId: invoiceId },
    });

    if (!existing) {
      await db.streamLeasePayment.create({
        data: {
          streamLeaseId:   lease.id,
          artistId:        cfg.artistId,
          producerId:      artist.id,
          totalAmount:     1.00,
          producerAmount:  0.70,
          platformAmount:  0.30,
          stripeInvoiceId: invoiceId,
          status:          "PAID",
          paidAt:          new Date(Date.now() - (cfg.daysAgo - 2) * 86_400_000),
        },
      });
    }
  }

  console.log("✓ Payments: 2 PAID ($0.70 producer / $0.30 platform each)");

  // ── Beat Licenses (license sales on Ocean Drive + Night Market) ──────────────

  const licenseConfigs = [
    {
      beatIdx:     3, // Ocean Drive
      buyerId:     producer1.id,
      licenseType: "NON_EXCLUSIVE" as const,
      price:       29.99,
      createdDaysAgo: 18,
    },
    {
      beatIdx:     4, // Night Market
      buyerId:     producer2.id,
      licenseType: "EXCLUSIVE" as const,
      price:       149.99,
      createdDaysAgo: 7,
    },
  ];

  for (const lc of licenseConfigs) {
    const beat = beats[lc.beatIdx];
    const previewId = `wf-preview-${beat.id}`;
    const licenseId = `wf-license-${beat.id}`;

    // BeatPreview is required as the parent record for BeatLicense
    await db.beatPreview.upsert({
      where:  { id: previewId },
      update: {},
      create: {
        id:          previewId,
        producerId:  artist.id,
        artistId:    lc.buyerId,
        trackId:     beat.id,
        expiresAt:   new Date(Date.now() + 365 * 86_400_000), // expires 1 year out
        isDownloadable: false,
        status:      "PURCHASED",
        createdAt:   new Date(Date.now() - lc.createdDaysAgo * 86_400_000),
      },
    });

    // BeatLicense record
    const existingLicense = await db.beatLicense.findFirst({ where: { id: licenseId } });
    if (!existingLicense) {
      await db.beatLicense.create({
        data: {
          id:            licenseId,
          beatPreviewId: previewId,
          trackId:       beat.id,
          producerId:    artist.id,
          artistId:      lc.buyerId,
          licenseType:   lc.licenseType,
          price:         lc.price,
          status:        "ACTIVE",
          createdAt:     new Date(Date.now() - lc.createdDaysAgo * 86_400_000),
        },
      });
    }

    console.log(`  ✓ ${lc.licenseType} license on "${beat.title}" — $${lc.price}`);
  }

  console.log("✓ Beat licenses (2 sales)");

  // ── AIJob (COVER_ART, COMPLETE) for Wave Factory ─────────────────────────────
  // Used to hang an auto-generated AI receipt LicenseDocument on

  const aiJobId = "wf-aijob-cover-art-001";

  const aiJob = await db.aIJob.upsert({
    where:  { id: aiJobId },
    update: {},
    create: {
      id:            aiJobId,
      type:          "COVER_ART",
      status:        "COMPLETE",
      triggeredBy:   "ARTIST",
      triggeredById: artist.id,
      artistId:      artist.id,
      provider:      "openai",
      priceCharged:  0.25,
      completedAt:   new Date(Date.now() - 5 * 86_400_000),
      outputData:    {
        imageUrls:   ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=512&q=80"],
        selectedUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=512&q=80",
      },
    },
  });

  console.log(`✓ AIJob: COVER_ART (COMPLETE) — id: ${aiJob.id}`);

  // ── LicenseDocuments ─────────────────────────────────────────────────────────

  // 1. Splice license PDF attached to Dark Matter (beat 0)
  const spliceDocId = "wf-licensedoc-splice-dark-matter";
  await db.licenseDocument.upsert({
    where:  { id: spliceDocId },
    update: {},
    create: {
      id:       spliceDocId,
      userId:   artist.id,
      title:    "Splice – Drum Loop License (Dark Matter)",
      fileUrl:  "https://example.com/seed/wave-factory/splice-license.pdf",
      fileType: "application/pdf",
      source:   "SPLICE",
      notes:    "Royalty-free license for the drum loop used in the intro and breakdown sections.",
      trackId:  beats[0].id,
    },
  });

  // 2. AI receipt auto-generated for the COVER_ART job
  const aiReceiptDocId = "wf-licensedoc-ai-receipt-coverart";
  const aiReceiptUrl   = `/api/ai-jobs/${aiJob.id}/receipt`;

  await db.licenseDocument.upsert({
    where:  { id: aiReceiptDocId },
    update: {},
    create: {
      id:       aiReceiptDocId,
      userId:   artist.id,
      title:    "AI-Generated Cover Art Receipt",
      fileUrl:  aiReceiptUrl,
      fileType: "application/pdf",
      source:   "AI_GENERATION",
      notes:    "Auto-generated ownership receipt for IndieThis AI Cover Art tool.",
      aiJobId:  aiJob.id,
    },
  });

  console.log("✓ LicenseDocuments:");
  console.log(`  • Splice license on "Dark Matter" (${beats[0].id})`);
  console.log(`  • AI receipt for Cover Art job (${aiJob.id})`);

  // ─── Verification Summary ────────────────────────────────────────────────────

  console.log("\n" + "─".repeat(60));
  console.log("🔍  Verification\n");

  const profile     = await db.producerProfile.findUnique({ where: { userId: artist.id } });
  const beatCount   = await db.track.count({
    where: { artistId: artist.id, beatLeaseSettings: { isNot: null } },
  });
  const leaseCount  = await db.streamLease.count({ where: { producerId: artist.id, isActive: true } });
  const licCount    = await db.beatLicense.count({ where: { producerId: artist.id } });
  const docCount    = await db.licenseDocument.count({ where: { userId: artist.id } });
  const totalPlays  = await db.streamLeasePlay.count({
    where: { streamLease: { producerId: artist.id } },
  });

  console.log(`Producer profile:   ${profile?.displayName ?? "MISSING"}`);
  console.log(`Beats (with BLS):   ${beatCount}  (expected 6)`);
  console.log(`Active leases:      ${leaseCount}  (expected 3)`);
  console.log(`License sales:      ${licCount}  (expected 2)`);
  console.log(`License documents:  ${docCount}  (expected 2)`);
  console.log(`Total plays:        ${totalPlays}  (expected 600)`);

  console.log("\n" + "─".repeat(60));
  console.log("\n✅  Seed complete!\n");
  console.log("Login:  test-artist@indiethis.dev  /  test1234\n");
  console.log("Verification checklist:");
  console.log("  [ ] Producer sidebar section appears when logged in as test-artist");
  console.log("  [ ] My Beats page shows 6 beats with BPM, key, pricing, cover art");
  console.log("  [ ] Producer Analytics charts render with play/revenue data");
  console.log("  [ ] Producer Licensing page shows 2 sales ($29.99 + $149.99)");
  console.log("  [ ] Producer Earnings shows stream lease income ($1.40 earned)");
  console.log("  [ ] Stream Leases (producer) page shows 3 leases with play counts");
  console.log("  [ ] License Vault shows 2 documents (Splice + AI receipt)");
  console.log(`  [ ] AI receipt viewable at ${aiReceiptUrl}`);
  console.log("  [ ] Artist public page shows Beats section (Wave Factory)");
  console.log("  [ ] Admin /content page lists Wave Factory beats with license docs");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
