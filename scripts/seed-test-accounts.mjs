/**
 * Seed test accounts for IndieThis development.
 * Creates: studio owner + full studio, artist, producer — all with demo data.
 *
 * Run: node scripts/seed-test-accounts.mjs
 * Idempotent — safe to run multiple times.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  LOGINS (password: "password" for all)                  │
 * │  Studio:   studio@indiethis.dev   → /studio dashboard   │
 * │  Artist:   artist@indiethis.dev   → /dashboard          │
 * │  Producer: producer@indiethis.dev → /dashboard          │
 * └─────────────────────────────────────────────────────────┘
 */

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient();

// ── helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) { return new Date(Date.now() - n * 86400_000); }
function future(n)  { return new Date(Date.now() + n * 86400_000); }
function hoursAgo(n){ return new Date(Date.now() - n * 3_600_000); }
function ipHash(s)  { return createHash("sha256").update(s).digest("hex").slice(0, 16); }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

// Pre-computed bcrypt hash of "password" (rounds=10)
const PW = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";

// ── constants ─────────────────────────────────────────────────────────────────

const STUDIO_EMAIL    = "studio@indiethis.dev";
const STUDIO_SLUG     = "clearear-test";
const ARTIST_EMAIL    = "artist@indiethis.dev";
const ARTIST_SLUG     = "jay-nova";
const PRODUCER_EMAIL  = "producer@indiethis.dev";
const PRODUCER_SLUG   = "nova-beats";

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding test accounts…\n");

  // ══════════════════════════════════════════════════════════════════════════
  // 1. STUDIO OWNER + STUDIO
  // ══════════════════════════════════════════════════════════════════════════

  console.log("🎙️  Studio account…");

  const studioOwner = await db.user.upsert({
    where:  { email: STUDIO_EMAIL },
    create: {
      email:        STUDIO_EMAIL,
      passwordHash: PW,
      name:         "Clear Ear Admin",
      role:         "STUDIO_ADMIN",
      lastLoginAt:  hoursAgo(1),
    },
    update: { lastLoginAt: hoursAgo(1) },
  });
  console.log("  ✓ Studio owner user:", studioOwner.email);

  // Studio record
  let studio = await db.studio.findUnique({ where: { slug: STUDIO_SLUG } });
  if (!studio) {
    studio = await db.studio.create({
      data: {
        ownerId:      studioOwner.id,
        name:         "Clear Ear Studios (Test)",
        slug:         STUDIO_SLUG,
        studioTier:   "ELITE",
        template:     "CUSTOM",
        isPublished:  true,
        email:        "clearearstudios@gmail.com",
        phone:        "+17733810000",
        tagline:      "Premium Recording, Mixing & Mastering",
        bio:          "Clear Ear Studios is where serious sound gets made. Music production, recording, mixing, mastering, podcasts, voiceovers — whatever the project, we bring premium equipment, acoustically engineered rooms, and a team that delivers every time.",
        heroImage:    "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1600&q=80",
        galleryImages: [
          "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
          "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80",
          "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80",
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
          "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
          "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
        ],
        streetAddress: "7411 S Stony Island Ave",
        city:          "Chicago",
        state:         "IL",
        zipCode:       "60649",
        instagram:     "clearearstudios",
        tiktok:        "clearearstudios",
        studioHours: {
          monday:    { open: true, openTime: "10:00", closeTime: "22:00" },
          tuesday:   { open: true, openTime: "10:00", closeTime: "22:00" },
          wednesday: { open: true, openTime: "10:00", closeTime: "22:00" },
          thursday:  { open: true, openTime: "10:00", closeTime: "22:00" },
          friday:    { open: true, openTime: "10:00", closeTime: "22:00" },
          saturday:  { open: true, openTime: "11:00", closeTime: "20:00" },
          sunday:    { open: true, openTime: "12:00", closeTime: "18:00" },
        },
        hoursNote:      "24-hour sessions available by appointment",
        paymentMethods: ["cashapp", "zelle", "paypal", "venmo"],
        cashAppHandle:  "$clearearstudios",
        zelleHandle:    "clearearstudios@gmail.com",
        paypalHandle:   "clearearstudios",
        venmoHandle:    "@clearearstudios",
        services: ["Recording", "Mixing", "Mastering", "Podcast Production", "Voiceover"],
        servicesJson: JSON.stringify([
          { name: "Recording Session",  rate: 100, rateType: "hourly",   description: "Full tracking session — vocals, instruments, or full band." },
          { name: "Mix Session",        rate: 150, rateType: "hourly",   description: "In-room mixing with engineer on SSL 4000." },
          { name: "Mastering",          rate: 75,  rateType: "per_track", description: "Streaming-ready master with analog chain." },
          { name: "Podcast Production", rate: 250, rateType: "flat",     description: "Record, edit, and deliver a full podcast episode." },
        ]),
        averageSessionRate: 125,
        onboardingCompleted: true,
      },
    });
    console.log("  ✓ Studio created:", studio.slug);
  } else {
    console.log("  – Studio already exists:", studio.slug);
  }

  // Studio engineers
  const seCount = await db.studioEngineer.count({ where: { studioId: studio.id } });
  if (seCount === 0) {
    await db.studioEngineer.createMany({
      data: [
        { studioId: studio.id, name: "Chris Palmer",  role: "Head Engineer",      photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300", specialties: ["Mixing", "Mastering", "Hip-Hop", "R&B"], bio: "15 years in the industry. Gold and platinum credits.",  sortOrder: 0 },
        { studioId: studio.id, name: "Kayla Simms",   role: "Mix Engineer",       photoUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300", specialties: ["Mixing", "Trap", "Vocal Production"],     bio: "Vocal-forward hip-hop and trap specialist.",           sortOrder: 1 },
        { studioId: studio.id, name: "Devon West",    role: "Mastering Engineer", photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300", specialties: ["Mastering", "Analog", "Pop", "Electronic"], bio: "Analog mastering — loudness-competitive streaming masters.", sortOrder: 2 },
      ],
    });
    console.log("  ✓ Engineers: 3");
  }

  // Studio equipment
  const eqCount = await db.studioEquipment.count({ where: { studioId: studio.id } });
  if (eqCount === 0) {
    await db.studioEquipment.createMany({
      data: [
        { studioId: studio.id, category: "CONSOLE",     name: "SSL 4000 G+",                  sortOrder: 0 },
        { studioId: studio.id, category: "CONSOLE",     name: "Neve 8078 (Vintage)",           sortOrder: 1 },
        { studioId: studio.id, category: "MONITORS",    name: "Yamaha NS-10M Studio",          sortOrder: 0 },
        { studioId: studio.id, category: "MONITORS",    name: "Genelec 8351B",                 sortOrder: 1 },
        { studioId: studio.id, category: "MICROPHONES", name: "Neumann U87 Ai",               sortOrder: 0 },
        { studioId: studio.id, category: "MICROPHONES", name: "AKG C414 XLII",                sortOrder: 1 },
        { studioId: studio.id, category: "MICROPHONES", name: "Shure SM7B",                   sortOrder: 2 },
        { studioId: studio.id, category: "OUTBOARD",    name: "API 2500 Bus Compressor",      sortOrder: 0 },
        { studioId: studio.id, category: "OUTBOARD",    name: "Universal Audio LA-2A",        sortOrder: 1 },
        { studioId: studio.id, category: "OUTBOARD",    name: "Neve 1073 DPA Preamp",         sortOrder: 2 },
        { studioId: studio.id, category: "DAW",         name: "Pro Tools Ultimate (v2024)",   sortOrder: 0 },
        { studioId: studio.id, category: "DAW",         name: "Ableton Live 12 Suite",        sortOrder: 1 },
        { studioId: studio.id, category: "DAW",         name: "Logic Pro X",                  sortOrder: 2 },
      ],
    });
    console.log("  ✓ Equipment: 13");
  }

  // Portfolio tracks
  const sptCount = await db.studioPortfolioTrack.count({ where: { studioId: studio.id } });
  if (sptCount === 0) {
    await db.studioPortfolioTrack.createMany({
      data: [
        { studioId: studio.id, title: "After Hours",     artistName: "Jay Nova",    audioUrl: "/demo/midnight-drive.wav", coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400", description: "Mixed & mastered at Clear Ear",       artistSlug: ARTIST_SLUG, sortOrder: 0 },
        { studioId: studio.id, title: "Smoke & Mirrors", artistName: "Jade Monroe", audioUrl: "/demo/golden-hour.wav",   coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400", description: "Produced, mixed & mastered in-house", artistSlug: null,        sortOrder: 1 },
        { studioId: studio.id, title: "North Star",      artistName: "Marcus Bell", audioUrl: "/demo/neon-nights.wav",   coverUrl: "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=400", description: "Full production — tracking through master", artistSlug: null, sortOrder: 2 },
        { studioId: studio.id, title: "Wavelength",      artistName: "Drea Vox",    audioUrl: "/demo/midnight-drive.wav",coverUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400", description: "R&B mix session",                    artistSlug: null,        sortOrder: 3 },
      ],
    });
    console.log("  ✓ Portfolio tracks: 4");
  }

  // Studio credits
  const scCount = await db.studioCredit.count({ where: { studioId: studio.id } });
  if (scCount === 0) {
    await db.studioCredit.createMany({
      data: [
        { studioId: studio.id, artistName: "Jay Nova",    artistPhotoUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200", projectName: "Elevation",      artistSlug: ARTIST_SLUG, sortOrder: 0 },
        { studioId: studio.id, artistName: "Jade Monroe", artistPhotoUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200", projectName: "Smoke & Mirrors", artistSlug: null, sortOrder: 1 },
        { studioId: studio.id, artistName: "Marcus Bell", artistPhotoUrl: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200", projectName: "North Star",      artistSlug: null, sortOrder: 2 },
        { studioId: studio.id, artistName: "Drea Vox",   artistPhotoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200", projectName: "Wavelength",      artistSlug: null, sortOrder: 3 },
        { studioId: studio.id, artistName: "K-Flow",     artistPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200", projectName: "Pressure EP",     artistSlug: null, sortOrder: 4 },
        { studioId: studio.id, artistName: "SunRise",    artistPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200", projectName: "Golden Era",      artistSlug: null, sortOrder: 5 },
      ],
    });
    console.log("  ✓ Credits: 6");
  }

  // Studio contacts
  const contactCount = await db.contact.count({ where: { studioId: studio.id } });
  let contacts = [];
  if (contactCount < 3) {
    contacts = await Promise.all([
      db.contact.create({ data: { studioId: studio.id, name: "Jay Nova",    email: ARTIST_EMAIL,                phone: "+17735550001", genre: "Hip-Hop",  source: "BOOKING",     totalSpent: 1450, instagramHandle: "jaynova",        tags: ["Artist"],           lastSessionDate: daysAgo(3) } }),
      db.contact.create({ data: { studioId: studio.id, name: "Marcus Bell", email: "marcus.bell@outlook.com",  phone: "+17735550002", genre: "R&B",      source: "INTAKE_FORM", totalSpent: 800,  instagramHandle: "marcusbellmusic", tags: ["Artist"],           lastSessionDate: daysAgo(14) } }),
      db.contact.create({ data: { studioId: studio.id, name: "Jade Monroe", email: "jade.monroe@gmail.com",    phone: "+17735550003", genre: "Pop",      source: "REFERRAL",    totalSpent: 650,  instagramHandle: "jademonroe",      tags: ["Artist"] } }),
      db.contact.create({ data: { studioId: studio.id, name: "K-Flow",      email: "kflow99@gmail.com",        phone: "+17735550004", genre: "Trap",     source: "WALK_IN",     totalSpent: 400,  tags: ["Artist"] } }),
      db.contact.create({ data: { studioId: studio.id, name: "Nova Beats",  email: PRODUCER_EMAIL,             phone: "+17735550005", genre: "Trap/R&B", source: "REFERRAL",    totalSpent: 0,    instagramHandle: "novabeats",       tags: ["Producer"] } }),
      db.contact.create({ data: { studioId: studio.id, name: "Drea Vox",    email: "drea.vox@gmail.com",       phone: "+17735550006", genre: "R&B/Soul", source: "BOOKING",     totalSpent: 1100, instagramHandle: "dreavox",         tags: ["Artist"] } }),
    ]);
    console.log("  ✓ Contacts:", contacts.length);

    // Activity log for first contact
    await db.activityLog.createMany({
      data: [
        { contactId: contacts[0].id, studioId: studio.id, type: "BOOKING_LINK_SENT", description: "Intake link sent via email",                                    createdAt: daysAgo(20) },
        { contactId: contacts[0].id, studioId: studio.id, type: "FORM_SUBMITTED",    description: "Intake form submitted — Elevation mix session",                  createdAt: daysAgo(19) },
        { contactId: contacts[0].id, studioId: studio.id, type: "PAYMENT_RECEIVED",  description: "Deposit received — $250 via Cash App", metadata: { amount: 250, method: "cashapp" }, createdAt: daysAgo(18) },
        { contactId: contacts[0].id, studioId: studio.id, type: "SESSION_COMPLETED", description: "Mix session completed — 8 hours",                               createdAt: daysAgo(3) },
        { contactId: contacts[0].id, studioId: studio.id, type: "FILES_DELIVERED",   description: "3 mix files delivered via download link",                       createdAt: daysAgo(3) },
      ],
    });
  } else {
    contacts = await db.contact.findMany({ where: { studioId: studio.id }, take: 6 });
    console.log("  – Contacts: already seeded");
  }

  // Bookings
  const bkCount = await db.bookingSession.count({ where: { studioId: studio.id } });
  if (bkCount === 0 && contacts.length >= 3) {
    const bookings = await Promise.all([
      db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[0].id, dateTime: daysAgo(3),  duration: 480, sessionType: "Mix Session",   status: "COMPLETED", paymentStatus: "PAID",    notes: "Full Elevation album mix — 10 tracks. Great session.",     engineerNotes: "Pushed mids on tracks 3–6. Stem bounce needed for track 8.", createdAt: daysAgo(7) } }),
      db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[1].id, dateTime: future(2),  duration: 240, sessionType: "Recording",      status: "CONFIRMED", paymentStatus: "DEPOSIT", notes: "Tracking vocals for Smoke & Mirrors EP. Bring reference tracks.",     createdAt: daysAgo(5) } }),
      db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[2].id, dateTime: future(5),  duration: 120, sessionType: "Mastering",      status: "PENDING",   paymentStatus: "UNPAID",  notes: "6-track EP mastering. Wants loud and competitive.",                  createdAt: daysAgo(2) } }),
      db.bookingSession.create({ data: { studioId: studio.id, artistId: studioOwner.id, contactId: contacts[3].id, dateTime: future(10), duration: 180, sessionType: "Recording",      status: "PENDING",   paymentStatus: "UNPAID",  notes: "New trap EP session. 3-hr tracking block.",                          createdAt: daysAgo(1) } }),
    ]);
    console.log("  ✓ Bookings: 4");

    // Delivered files
    await db.deliveredFile.createMany({
      data: [
        { sessionId: bookings[0].id, artistId: studioOwner.id, studioId: studio.id, contactId: contacts[0].id, fileName: "Elevation_MixMastered_v3.wav", fileUrl: "/demo/midnight-drive.wav", notes: "Final approved mix — 24-bit 48kHz WAV",   notificationSent: true, deliveredAt: daysAgo(3) },
        { sessionId: bookings[0].id, artistId: studioOwner.id, studioId: studio.id, contactId: contacts[0].id, fileName: "AfterHours_Mix_v2.wav",         fileUrl: "/demo/golden-hour.wav",    notes: "Second revision",                         notificationSent: true, deliveredAt: daysAgo(3) },
        { sessionId: bookings[0].id, artistId: studioOwner.id, studioId: studio.id, contactId: contacts[0].id, fileName: "NorthStar_FinalMix.wav",        fileUrl: "/demo/neon-nights.wav",    notes: "Approved — ready for distribution",       notificationSent: true, deliveredAt: daysAgo(3) },
      ],
    });
    console.log("  ✓ Delivered files: 3");
  }

  // Invoices
  const invCount = await db.invoice.count({ where: { studioId: studio.id } });
  if (invCount === 0 && contacts.length >= 2) {
    await db.invoice.createMany({
      data: [
        { studioId: studio.id, contactId: contacts[0].id, invoiceNumber: 1001, lineItems: [{ description: "Mix Session — 8 hrs @ $100/hr", quantity: 8, rate: 100, total: 800 }, { description: "Mastering — 10 tracks @ $75", quantity: 10, rate: 75, total: 750 }], subtotal: 1550, tax: 0, taxRate: 0, total: 1550, dueDate: future(7),  status: "PAID",  paidAt: daysAgo(3),  createdAt: daysAgo(10) },
        { studioId: studio.id, contactId: contacts[1].id, invoiceNumber: 1002, lineItems: [{ description: "Recording Session — 4 hrs @ $100/hr", quantity: 4, rate: 100, total: 400 }], subtotal: 400, tax: 0, taxRate: 0, total: 400, dueDate: future(14), status: "SENT",  createdAt: daysAgo(2) },
        { studioId: studio.id, contactId: contacts[2].id, invoiceNumber: 1003, lineItems: [{ description: "EP Mastering — 6 tracks", quantity: 6, rate: 75, total: 450 }], subtotal: 450, tax: 0, taxRate: 0, total: 450, dueDate: future(21), status: "DRAFT", createdAt: daysAgo(1) },
      ],
    });
    console.log("  ✓ Invoices: 3");
  }

  // Intake links + submissions
  const ilCount = await db.intakeLink.count({ where: { studioId: studio.id } });
  if (ilCount === 0 && contacts.length >= 3) {
    const il1 = await db.intakeLink.create({ data: { studioId: studio.id, contactId: contacts[0].id, token: "test-intake-001", name: "Jay Nova",    email: ARTIST_EMAIL,                expiresAt: future(30), usedAt: daysAgo(14) } });
    const il2 = await db.intakeLink.create({ data: { studioId: studio.id, contactId: contacts[1].id, token: "test-intake-002", name: "Marcus Bell", email: "marcus.bell@outlook.com",  expiresAt: future(30), usedAt: daysAgo(7) } });
    const il3 = await db.intakeLink.create({ data: { studioId: studio.id, contactId: contacts[2].id, token: "test-intake-003", name: "Jade Monroe", email: "jade.monroe@gmail.com",    expiresAt: future(30), usedAt: daysAgo(2) } });

    await db.intakeSubmission.createMany({
      data: [
        { intakeLinkId: il1.id, studioId: studio.id, contactId: contacts[0].id, artistName: "Jay Nova",    genre: "Hip-Hop", projectDesc: "Full album mix & master — 10 tracks, aggressive low-end, punchy snares, clear vocals.", youtubeLinks: ["https://youtube.com/watch?v=dQw4w9WgXcQ"], fileUrls: ["/demo/midnight-drive.wav"], bpmDetected: 132, keyDetected: "Am",  instagram: "jaynova",      paymentMethod: "cashapp", depositPaid: true, depositAmount: 250, aiVideoRequested: false, createdAt: daysAgo(14) },
        { intakeLinkId: il2.id, studioId: studio.id, contactId: contacts[1].id, artistName: "Marcus Bell", genre: "R&B",    projectDesc: "4-track EP recording. Full production stems ready — just need to track vocals.", youtubeLinks: [], fileUrls: [], bpmDetected: 92, keyDetected: "C#m", instagram: "marcusbellmusic", paymentMethod: "zelle", depositPaid: false, aiVideoRequested: false, createdAt: daysAgo(7) },
        { intakeLinkId: il3.id, studioId: studio.id, contactId: contacts[2].id, artistName: "Jade Monroe", genre: "Pop",    projectDesc: "Single mastering — streaming-ready, loud. Reference: Olivia Rodrigo 'drivers license'.", youtubeLinks: ["https://youtube.com/watch?v=9bZkp7q19f0"], fileUrls: [], bpmDetected: 75, keyDetected: "Dm",  instagram: "jademonroe",   paymentMethod: "paypal", depositPaid: false, aiVideoRequested: false, createdAt: daysAgo(2) },
      ],
    });
    console.log("  ✓ Intake submissions: 3");
  }

  // Email campaigns
  const ecCount = await db.emailCampaign.count({ where: { studioId: studio.id } });
  if (ecCount === 0) {
    await db.emailCampaign.createMany({
      data: [
        { studioId: studio.id, subject: "🎉 Spring Rate Card — Book Now",              body: "We've updated our Spring rate card. Mix sessions start at $100/hr with full equipment access. Book this week for a complimentary stem bounce.", recipientCount: 148, openCount: 62, sentAt: daysAgo(14), createdAt: daysAgo(15) },
        { studioId: studio.id, subject: "New Vocal Booth + Neve Outboard Now Live",     body: "We've added an isolated vocal booth and the Neve 1073 DPA preamp to Studio A. Now accepting tracking session bookings.", recipientCount: 203, openCount: 91, sentAt: daysAgo(3), createdAt: daysAgo(4) },
      ],
    });
    console.log("  ✓ Email campaigns: 2");
  }

  // Contact submissions (public page inquiries)
  const csCount = await db.contactSubmission.count({ where: { studioId: studio.id } });
  if (csCount === 0) {
    await db.contactSubmission.createMany({
      data: [
        { studioId: studio.id, name: "Alex Rivera",  email: "alexrivera@gmail.com",    phone: "+17735552001", message: "Interested in a full-day session for my debut EP. Can we schedule a studio tour?", isRead: true,  createdAt: daysAgo(4)  },
        { studioId: studio.id, name: "Priya Sharma", email: "priya.s.music@gmail.com", phone: null,           message: "R&B vocalist looking for a mixing engineer for my single. Budget $400–600.",        isRead: false, createdAt: daysAgo(1)  },
        { studioId: studio.id, name: "Jason Wu",     email: "jasonwubeats@outlook.com",phone: "+17735552003", message: "Do you have availability for a 3-hour tracking session next Friday? Trap/hip-hop.",   isRead: false, createdAt: hoursAgo(3) },
      ],
    });
    console.log("  ✓ Contact submissions: 3");
  }

  // Studio page views (analytics)
  const spvCount = await db.pageView.count({ where: { studioId: studio.id } });
  if (spvCount === 0) {
    const rows = [];
    for (let i = 89; i >= 0; i--) {
      const n = i < 30 ? rand(20, 60) : i < 60 ? rand(10, 35) : rand(5, 20);
      for (let j = 0; j < n; j++) rows.push({ studioId: studio.id, ipHash: ipHash(`studio-pv-${i}-${j}`), viewedAt: daysAgo(i) });
    }
    await db.pageView.createMany({ data: rows });
    console.log(`  ✓ Studio page views: ${rows.length}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ARTIST — Jay Nova
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n🎤  Artist account…");

  const artist = await db.user.upsert({
    where:  { email: ARTIST_EMAIL },
    create: {
      email:           ARTIST_EMAIL,
      passwordHash:    PW,
      name:            "Jay Nova",
      artistName:      "Jay Nova",
      artistSlug:      ARTIST_SLUG,
      role:            "ARTIST",
      bio:             "Genre-defying recording artist from Chicago blending hip-hop, R&B, and alt-trap. Debut album 'Elevation' drops this spring.",
      photo:           "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
      instagramHandle: "jaynova",
      tiktokHandle:    "jaynova",
      spotifyUrl:      "https://open.spotify.com/artist/demo",
      appleMusicUrl:   "https://music.apple.com/artist/demo",
      lastLoginAt:     hoursAgo(2),
    },
    update: { lastLoginAt: hoursAgo(2) },
  });
  console.log("  ✓ Artist user:", artist.email);

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
  console.log("  ✓ Subscription: REIGN");

  // Artist site
  const siteCount = await db.artistSite.count({ where: { artistId: artist.id } });
  if (siteCount === 0) {
    await db.artistSite.create({
      data: {
        artistId:       artist.id,
        template:       "TEMPLATE_1",
        isPublished:    true,
        draftMode:      false,
        heroImage:      "https://images.unsplash.com/photo-1501386761578-ecd87563d930?w=1200",
        bioContent:     "Genre-defying recording artist from Chicago. Known for sharp lyricism and cinematic production.",
        showMusic:      true,
        showVideos:     true,
        showMerch:      true,
        showContact:    true,
        pwywEnabled:    true,
        genre:          "Hip-Hop / R&B",
        role:           "Artist & Producer",
        city:           "Chicago, IL",
        pinnedMessage:  "🔥 Debut album 'Elevation' dropping this spring — pre-save now!",
        pinnedActionText: "Pre-Save",
        pinnedActionUrl:  "https://distrokid.com/hyperfollow/jaynova/elevation",
        activityTickerEnabled: true,
        credentials:    ["2× Chicago Music Award Nominee", "BET Hip-Hop Award: Best New Artist 2024"],
        bookingRate:    1500,
      },
    });
    console.log("  ✓ Artist site created");
  }

  // Tracks
  const trackDefs = [
    { title: "Elevate",      bpm: 132, musicalKey: "Am",  plays: 5200, downloads: 218, price: 2.99, coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400", fileUrl: "/demo/midnight-drive.wav", status: "PUBLISHED", projectName: "Elevation" },
    { title: "Cold Summer",  bpm: 98,  musicalKey: "C#m", plays: 3400, downloads: 162, price: 1.99, coverArtUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400", fileUrl: "/demo/golden-hour.wav",    status: "PUBLISHED", projectName: "Elevation" },
    { title: "Neon Dreams",  bpm: 142, musicalKey: "Em",  plays: 2180, downloads: 91,  price: 0.99, coverArtUrl: "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=400", fileUrl: "/demo/neon-nights.wav",    status: "PUBLISHED", projectName: "Elevation" },
    { title: "City Pulse",   bpm: 112, musicalKey: "Gm",  plays: 1620, downloads: 67,  price: 1.49, coverArtUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400", fileUrl: "/demo/city-lights.wav",    status: "PUBLISHED", projectName: "Echoes EP" },
    { title: "Midnight Run",  bpm: 82, musicalKey: "F#m", plays: 1050, downloads: 31,  price: 1.99, coverArtUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400", fileUrl: "/demo/ocean-waves.wav",    status: "PUBLISHED", projectName: "Echoes EP" },
  ];

  const createdTracks = [];
  for (const t of trackDefs) {
    const existing = await db.track.findFirst({ where: { artistId: artist.id, title: t.title } });
    const track = existing
      ? await db.track.update({ where: { id: existing.id }, data: { plays: t.plays, downloads: t.downloads } })
      : await db.track.create({ data: { ...t, artistId: artist.id, earnings: t.downloads * t.price * 0.7 } });
    createdTracks.push(track);
  }
  console.log("  ✓ Tracks:", createdTracks.length);

  // Releases
  const relCount = await db.artistRelease.count({ where: { artistId: artist.id } });
  if (relCount === 0) {
    const album = await db.artistRelease.create({ data: { artistId: artist.id, title: "Elevation", type: "ALBUM", releaseDate: future(12), coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400", sortOrder: 0 } });
    const ep    = await db.artistRelease.create({ data: { artistId: artist.id, title: "Echoes EP", type: "EP",    releaseDate: daysAgo(40), coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400", sortOrder: 1 } });
    await db.track.updateMany({ where: { artistId: artist.id, projectName: "Elevation" }, data: { releaseId: album.id } });
    await db.track.updateMany({ where: { artistId: artist.id, projectName: "Echoes EP" }, data: { releaseId: ep.id } });
    console.log("  ✓ Releases: 2");
  }

  // Pre-save campaign
  const psCount = await db.preSaveCampaign.count({ where: { artistId: artist.id } });
  if (psCount === 0) {
    const campaign = await db.preSaveCampaign.create({
      data: {
        artistId:     artist.id,
        title:        "Elevation — Pre-Save",
        artUrl:       "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600",
        releaseDate:  future(12),
        spotifyUrl:   "https://open.spotify.com/album/demo",
        appleMusicUrl:"https://music.apple.com/album/demo",
        isActive:     true,
      },
    });
    const clicks = [];
    for (let i = 14; i >= 0; i--) {
      const n = rand(6, 28);
      for (let j = 0; j < n; j++) clicks.push({ campaignId: campaign.id, platform: j % 3 === 0 ? "APPLE_MUSIC" : "SPOTIFY", clickedAt: daysAgo(i) });
    }
    await db.preSaveClick.createMany({ data: clicks });
    console.log("  ✓ Pre-save campaign:", clicks.length, "clicks");
  }

  // Merch
  const mCount = await db.merchProduct.count({ where: { artistId: artist.id } });
  if (mCount === 0) {
    const products = await Promise.all([
      db.merchProduct.create({ data: { artistId: artist.id, title: "Elevation Tee",     description: "Official album tee — premium heavyweight cotton.", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", basePrice: 14.50, artistMarkup: 15.50, productType: "TSHIRT", isActive: true } }),
      db.merchProduct.create({ data: { artistId: artist.id, title: "Chicago Hoodie",    description: "Embroidered hoodie — limited run.", imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400", basePrice: 28.00, artistMarkup: 22.00, productType: "HOODIE", isActive: true } }),
      db.merchProduct.create({ data: { artistId: artist.id, title: "Neon Dreams Poster", description: "Glossy fine-art print, numbered.", imageUrl: "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=400", basePrice: 7.00, artistMarkup: 18.00, productType: "POSTER", isActive: true } }),
    ]);
    const orderRows = [
      { pi: 0, email: "jayla.m@gmail.com",       qty: 1, status: "DELIVERED", days: 14 },
      { pi: 0, email: "marcus.bell@outlook.com", qty: 2, status: "SHIPPED",   days: 7  },
      { pi: 1, email: "drea.vox@gmail.com",       qty: 1, status: "DELIVERED", days: 21 },
      { pi: 2, email: "sunrise.music@gmail.com",  qty: 3, status: "DELIVERED", days: 30 },
    ];
    for (const o of orderRows) {
      const p = products[o.pi];
      const total = p.basePrice + p.artistMarkup;
      await db.merchOrder.create({ data: { merchProductId: p.id, artistId: artist.id, buyerEmail: o.email, quantity: o.qty, totalPrice: total * o.qty, platformCut: total * o.qty * 0.10, artistEarnings: p.artistMarkup * o.qty, fulfillmentStatus: o.status, createdAt: daysAgo(o.days) } });
    }
    console.log("  ✓ Merch: 3 products, 4 orders");
  }

  // Fan contacts
  const fcCount = await db.fanContact.count({ where: { artistId: artist.id } });
  if (fcCount === 0) {
    await db.fanContact.createMany({
      data: [
        { artistId: artist.id, email: "jayla.m@gmail.com",      phone: "+17735550101", zip: "60601", source: "RELEASE_NOTIFY", createdAt: daysAgo(45) },
        { artistId: artist.id, email: "marcus.bell@outlook.com",phone: "+17735550102", zip: "60603", source: "RELEASE_NOTIFY", createdAt: daysAgo(30) },
        { artistId: artist.id, email: "drea.vox@gmail.com",     phone: "+17735550103", zip: "60605", source: "SHOW_NOTIFY",    createdAt: daysAgo(21) },
        { artistId: artist.id, email: "kflow99@gmail.com",      phone: "+17735550104", zip: "60607", source: "SHOW_NOTIFY",    createdAt: daysAgo(14) },
        { artistId: artist.id, email: "sunrise.music@gmail.com",phone: "+17735550105", zip: "60609", source: "RELEASE_NOTIFY", createdAt: daysAgo(7)  },
        { artistId: artist.id, email: "mia.luxe@gmail.com",     phone: "+17735550106", zip: "60611", source: "RELEASE_NOTIFY", createdAt: daysAgo(3)  },
      ],
    });
    console.log("  ✓ Fan contacts: 6");
  }

  // Shows
  const showCount = await db.artistShow.count({ where: { artistId: artist.id } });
  if (showCount === 0) {
    await db.artistShow.createMany({
      data: [
        { artistId: artist.id, venueName: "Thalia Hall",      city: "Chicago, IL",   date: future(18), ticketUrl: "https://axs.com/demo",           isSoldOut: false },
        { artistId: artist.id, venueName: "The Fillmore",     city: "Detroit, MI",   date: future(32), ticketUrl: "https://ticketmaster.com/demo",   isSoldOut: false },
        { artistId: artist.id, venueName: "House of Blues",   city: "Houston, TX",   date: future(48), ticketUrl: "https://houseofblues.com/demo",   isSoldOut: false },
      ],
    });
    console.log("  ✓ Shows: 3");
  }

  // Videos
  const vidCount = await db.artistVideo.count({ where: { artistId: artist.id } });
  if (vidCount === 0) {
    await db.artistVideo.createMany({
      data: [
        { artistId: artist.id, videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", youtubeVideoId: "dQw4w9WgXcQ", thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg", title: "Elevate (Official Video)",   type: "YOUTUBE", sortOrder: 0 },
        { artistId: artist.id, videoUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0", youtubeVideoId: "9bZkp7q19f0", thumbnailUrl: "https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg", title: "Cold Summer (Lyric Video)", type: "YOUTUBE", sortOrder: 1 },
      ],
    });
    console.log("  ✓ Videos: 2");
  }

  // Photos
  const photoCount = await db.artistPhoto.count({ where: { artistId: artist.id } });
  if (photoCount === 0) {
    await db.artistPhoto.createMany({
      data: [
        { artistId: artist.id, imageUrl: "https://images.unsplash.com/photo-1501386761578-ecd87563d930?w=600", caption: "Sold-out show at Thalia Hall",  sortOrder: 0 },
        { artistId: artist.id, imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600", caption: "Studio session — Elevation",    sortOrder: 1 },
        { artistId: artist.id, imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600", caption: "Behind the boards",             sortOrder: 2 },
      ],
    });
    console.log("  ✓ Photos: 3");
  }

  // Testimonials
  const testCount = await db.artistTestimonial.count({ where: { artistId: artist.id } });
  if (testCount === 0) {
    await db.artistTestimonial.createMany({
      data: [
        { artistId: artist.id, quote: "Jay Nova's ear for melody is unmatched. 'Elevate' is a stone-cold classic.",     attribution: "DJ Akademiks",   sortOrder: 0 },
        { artistId: artist.id, quote: "The most authentic voice to come out of Chicago in years. Real artistry.",        attribution: "HipHopDX Editor", sortOrder: 1 },
        { artistId: artist.id, quote: "I played 'Cold Summer' at three sold-out events. Crowd goes crazy every time.", attribution: "DJ Khaled",      sortOrder: 2 },
      ],
    });
    console.log("  ✓ Testimonials: 3");
  }

  // Press items
  const pressCount = await db.artistPressItem.count({ where: { artistId: artist.id } });
  if (pressCount === 0) {
    await db.artistPressItem.createMany({
      data: [
        { artistId: artist.id, source: "Rolling Stone", title: "10 Artists to Watch in 2026",             url: "https://rollingstone.com/demo", sortOrder: 0 },
        { artistId: artist.id, source: "Complex",       title: "Jay Nova Is Redefining Chicago Hip-Hop", url: "https://complex.com/demo",      sortOrder: 1 },
        { artistId: artist.id, source: "XXL",           title: "XXL Freshman Class 2024",                url: "https://xxlmag.com/demo",       sortOrder: 2 },
      ],
    });
    console.log("  ✓ Press items: 3");
  }

  // AI jobs for artist
  const aiCount = await db.aIJob.count({ where: { artistId: artist.id } });
  if (aiCount === 0) {
    await db.aIJob.createMany({
      data: [
        { type: "VIDEO",     status: "COMPLETE", triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: "runway",    costToUs: 0.40, priceCharged: 4.99, inputData: { trackTitle: "Elevate", style: "cinematic" }, outputData: { videoUrl: "https://example.com/video/elevate.mp4" },    createdAt: daysAgo(5), completedAt: daysAgo(5) },
        { type: "COVER_ART", status: "COMPLETE", triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: "openai",    costToUs: 0.08, priceCharged: 2.99, inputData: { prompt: "dark moody cityscape" }, outputData: { imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600" }, createdAt: daysAgo(12), completedAt: daysAgo(12) },
        { type: "PRESS_KIT", status: "COMPLETE", triggeredBy: "ARTIST", triggeredById: artist.id, artistId: artist.id, provider: "anthropic", costToUs: 0.05, priceCharged: 1.99, inputData: { artistName: "Jay Nova" }, outputData: { text: "Jay Nova is a genre-defying artist..." }, createdAt: daysAgo(20), completedAt: daysAgo(20) },
      ],
    });
    console.log("  ✓ AI jobs: 3");
  }

  // Tips
  const tipCount = await db.artistSupport.count({ where: { artistId: artist.id } });
  if (tipCount === 0) {
    await db.artistSupport.createMany({
      data: [
        { artistId: artist.id, supporterEmail: "jayla.m@gmail.com",     amount: 25.00, message: "Keep making fire 🔥",            createdAt: daysAgo(5)  },
        { artistId: artist.id, supporterEmail: "jayla.m@gmail.com",     amount: 10.00, message: "Elevate is my anthem",           createdAt: daysAgo(12) },
        { artistId: artist.id, supporterEmail: "sunrise.music@gmail.com", amount: 5.00, message: "Appreciate the music",          createdAt: daysAgo(8)  },
      ],
    });
    console.log("  ✓ Tips: 3");
  }

  // Receipts
  const rcCount = await db.receipt.count({ where: { userId: artist.id } });
  if (rcCount === 0) {
    await db.receipt.createMany({
      data: [
        { userId: artist.id, type: "SUBSCRIPTION", description: "REIGN Plan — February 2026", amount: 39.99, createdAt: daysAgo(45) },
        { userId: artist.id, type: "SUBSCRIPTION", description: "REIGN Plan — March 2026",    amount: 39.99, createdAt: daysAgo(15) },
        { userId: artist.id, type: "AI_TOOL",      description: "AI Video Generation",        amount: 4.99,  createdAt: daysAgo(5)  },
        { userId: artist.id, type: "AI_TOOL",      description: "AI Cover Art",               amount: 2.99,  createdAt: daysAgo(12) },
        { userId: artist.id, type: "MERCH_SALE",   description: "Merch payout — March",       amount: 92.00, createdAt: daysAgo(30) },
        { userId: artist.id, type: "SUPPORT_TIP",  description: "Fan tips — March",           amount: 40.00, createdAt: daysAgo(25) },
      ],
    });
    console.log("  ✓ Receipts: 6");
  }

  // Artist page views (analytics)
  const pvCount = await db.pageView.count({ where: { artistId: artist.id } });
  if (pvCount === 0) {
    const pvRows = [];
    for (let i = 89; i >= 0; i--) {
      const n = i < 30 ? rand(80, 180) : i < 60 ? rand(50, 110) : rand(30, 70);
      for (let j = 0; j < n; j++) pvRows.push({ artistId: artist.id, ipHash: ipHash(`artist-pv-${i}-${j}`), viewedAt: daysAgo(i), referrer: j % 8 === 0 ? "qr" : j % 4 === 0 ? "instagram" : null });
    }
    await db.pageView.createMany({ data: pvRows });
    console.log(`  ✓ Artist page views: ${pvRows.length}`);
  }

  // Track plays
  const tpCount = await db.trackPlay.count({ where: { artistId: artist.id } });
  if (tpCount === 0) {
    const tpRows = [];
    for (let i = 29; i >= 0; i--) {
      for (const t of createdTracks) {
        const n = rand(5, 25);
        for (let j = 0; j < n; j++) tpRows.push({ trackId: t.id, artistId: artist.id, ipHash: ipHash(`tp-${t.id}-${i}-${j}`), playedAt: daysAgo(i) });
      }
    }
    await db.trackPlay.createMany({ data: tpRows });
    console.log(`  ✓ Track plays: ${tpRows.length}`);
  }

  // Link clicks
  const lcCount = await db.linkClick.count({ where: { artistId: artist.id } });
  if (lcCount === 0) {
    const platforms = ["spotify", "apple_music", "instagram", "youtube", "tiktok"];
    const lcRows = [];
    for (let i = 29; i >= 0; i--) {
      platforms.forEach((p) => {
        const n = rand(2, 12);
        for (let j = 0; j < n; j++) lcRows.push({ artistId: artist.id, platform: p, clickedAt: daysAgo(i) });
      });
    }
    await db.linkClick.createMany({ data: lcRows });
    console.log(`  ✓ Link clicks: ${lcRows.length}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. PRODUCER — Nova Beats
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n🎹  Producer account…");

  const producer = await db.user.upsert({
    where:  { email: PRODUCER_EMAIL },
    create: {
      email:           PRODUCER_EMAIL,
      passwordHash:    PW,
      name:            "Nova Beats",
      artistName:      "Nova Beats",
      artistSlug:      PRODUCER_SLUG,
      role:            "ARTIST",
      bio:             "Atlanta-based beat producer specializing in trap, R&B, and melodic hip-hop. 3× Gold placements. Available for exclusives and custom production.",
      photo:           "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=300",
      instagramHandle: "novabeats",
      lastLoginAt:     daysAgo(1),
    },
    update: {},
  });
  console.log("  ✓ Producer user:", producer.email);

  // Subscription
  await db.subscription.upsert({
    where:  { userId: producer.id },
    create: {
      userId:               producer.id,
      tier:                 "PUSH",
      status:               "ACTIVE",
      currentPeriodStart:   daysAgo(10),
      currentPeriodEnd:     future(20),
      aiVideoCreditsUsed:   0,
      aiVideoCreditsLimit:  3,
      aiArtCreditsUsed:     1,
      aiArtCreditsLimit:    5,
      aiMasterCreditsUsed:  0,
      aiMasterCreditsLimit: 3,
      lyricVideoCreditsUsed:  0,
      lyricVideoCreditsLimit: 1,
      aarReportCreditsUsed:   0,
      aarReportCreditsLimit:  1,
      pressKitCreditsUsed:    0,
      pressKitCreditsLimit:   1,
    },
    update: {},
  });
  console.log("  ✓ Subscription: PUSH");

  // Producer profile
  await db.producerProfile.upsert({
    where:  { userId: producer.id },
    create: {
      userId:                  producer.id,
      displayName:             "Nova Beats",
      bio:                     "Atlanta trap producer. Hard 808s, melodic leads, and clean mixes. 3× Gold placements.",
      defaultLeasePrice:       34.99,
      defaultNonExclusivePrice: 49.99,
      defaultExclusivePrice:   299.99,
    },
    update: {},
  });
  console.log("  ✓ Producer profile created");

  // Producer artist site
  const prodSiteCount = await db.artistSite.count({ where: { artistId: producer.id } });
  if (prodSiteCount === 0) {
    await db.artistSite.create({
      data: {
        artistId:     producer.id,
        template:     "TEMPLATE_2",
        isPublished:  true,
        draftMode:    false,
        heroImage:    "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=1200",
        bioContent:   "Atlanta trap producer. Hard 808s, melodic leads, and clean mixes. 3× Gold placements.",
        showMusic:    true,
        showVideos:   false,
        showMerch:    false,
        showContact:  true,
        genre:        "Trap / Hip-Hop / R&B",
        role:         "Producer",
        city:         "Atlanta, GA",
      },
    });
    console.log("  ✓ Producer artist site created");
  }

  // Producer beats
  const beatDefs = [
    { title: "808 Vibez",   bpm: 135, musicalKey: "Am",  price: 29.99, coverArtUrl: "https://images.unsplash.com/photo-1519117785-5e63d2011f6d?w=400",  description: "Hard-hitting 808 trap with hypnotic melody." },
    { title: "Trap Wave",   bpm: 145, musicalKey: "F#m", price: 34.99, coverArtUrl: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=400",  description: "Dark and atmospheric trap production." },
    { title: "Night Ride",  bpm: 90,  musicalKey: "Gm",  price: 24.99, coverArtUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400",  description: "Moody night-drive vibes. Slow-rolling 808s." },
    { title: "Soul Flip",   bpm: 88,  musicalKey: "Cm",  price: 29.99, coverArtUrl: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400",  description: "Classic soul sample flip with vinyl texture." },
    { title: "R&B Groove",  bpm: 75,  musicalKey: "Dm",  price: 19.99, coverArtUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",  description: "Smooth R&B production for melodic vocal records." },
  ];
  const beatTracks = [];
  for (const b of beatDefs) {
    const existing = await db.track.findFirst({ where: { artistId: producer.id, title: b.title } });
    const beat = existing ?? await db.track.create({ data: { ...b, artistId: producer.id, fileUrl: "/demo/midnight-drive.wav", status: "PUBLISHED", plays: rand(80, 500), downloads: rand(8, 60), earnings: 0 } });
    beatTracks.push(beat);
  }
  console.log("  ✓ Beats:", beatTracks.length);

  // Beat previews — sent to the artist account
  const bpCount = await db.beatPreview.count({ where: { artistId: artist.id } });
  if (bpCount === 0) {
    for (let i = 0; i < beatTracks.length; i++) {
      const bt = beatTracks[i];
      const preview = await db.beatPreview.create({
        data: {
          producerId:     producer.id,
          artistId:       artist.id,
          trackId:        bt.id,
          expiresAt:      future(14),
          isDownloadable: false,
          status:         i === 0 ? "PURCHASED" : i < 3 ? "LISTENED" : "PENDING",
          createdAt:      daysAgo(i * 3),
        },
      });
      if (i === 0) {
        await db.beatLicense.create({
          data: { beatPreviewId: preview.id, trackId: bt.id, producerId: producer.id, artistId: artist.id, licenseType: "LEASE", price: bt.price ?? 29.99, status: "ACTIVE", createdAt: daysAgo(10) },
        });
      }
    }
    console.log("  ✓ Beat previews:", beatTracks.length, "(1 licensed)");
  }

  // Producer receipts
  const prodRcCount = await db.receipt.count({ where: { userId: producer.id } });
  if (prodRcCount === 0) {
    await db.receipt.createMany({
      data: [
        { userId: producer.id, type: "SUBSCRIPTION", description: "PUSH Plan — February 2026", amount: 24.99, createdAt: daysAgo(45) },
        { userId: producer.id, type: "SUBSCRIPTION", description: "PUSH Plan — March 2026",    amount: 24.99, createdAt: daysAgo(15) },
        { userId: producer.id, type: "BEAT_PURCHASE", description: "Beat license: 808 Vibez",  amount: 29.99, createdAt: daysAgo(10) },
      ],
    });
    console.log("  ✓ Producer receipts: 3");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DONE
  // ══════════════════════════════════════════════════════════════════════════

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              TEST ACCOUNT LOGINS (password: password)       ║
╠══════════════════════════════════════════════════════════════╣
║  STUDIO OWNER                                               ║
║    Email:    studio@indiethis.dev                           ║
║    Password: password                                       ║
║    URL:      /studio/bookings  (ELITE tier)                 ║
║    Slug:     /clearear-test                                 ║
╠══════════════════════════════════════════════════════════════╣
║  ARTIST                                                     ║
║    Email:    artist@indiethis.dev                           ║
║    Password: password                                       ║
║    URL:      /dashboard  (REIGN plan)                       ║
║    Slug:     /jay-nova                                      ║
╠══════════════════════════════════════════════════════════════╣
║  PRODUCER                                                   ║
║    Email:    producer@indiethis.dev                         ║
║    Password: password                                       ║
║    URL:      /dashboard  (PUSH plan)                        ║
║    Slug:     /nova-beats                                    ║
╚══════════════════════════════════════════════════════════════╝
`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error("❌  Seed error:", e.message);
    db.$disconnect();
    process.exit(1);
  });
