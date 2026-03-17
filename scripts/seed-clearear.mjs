import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function seed() {
  const studio = await db.studio.findFirst({ where: { slug: "clearearstudios" } });
  if (!studio) {
    console.log("Studio not found — make sure clearearstudios exists");
    await db.$disconnect();
    return;
  }

  await db.studio.update({
    where: { id: studio.id },
    data: {
      studioTier: "ELITE",
      template: "CUSTOM",
      isPublished: true,
      email: "clearearstudios@gmail.com",
      tagline: "Premium Recording, Mixing & Mastering",
      bio: "Clear Ear Studios is where serious sound gets made. Music production, recording, mixing, mastering, podcasts, voiceovers — whatever the project, we bring premium equipment, acoustically engineered rooms, and a team that delivers every time.",
      logoUrl: "/images/studio/logo.png",
      heroImage: "/images/studio/hero.jpg",
      galleryImages: [
        "/images/studio/gallery-1.jpg",
        "/images/studio/gallery-5.jpg",
        "/images/studio/gallery-3.jpg",
        "/images/studio/gallery-4.jpg",
        "/images/studio/gallery-7.jpg",
      ],
      streetAddress: "7411 S Stony Island Ave",
      city: "Chicago",
      state: "IL",
      zipCode: "60649",
      instagram: "clearearstudios",
      twitter: null,
      facebook: null,
      tiktok: "clearearstudios",
      youtube: null,
      studioHours: {
        monday:    { open: true, openTime: "10:00", closeTime: "21:00" },
        tuesday:   { open: true, openTime: "10:00", closeTime: "21:00" },
        wednesday: { open: true, openTime: "10:00", closeTime: "21:00" },
        thursday:  { open: true, openTime: "10:00", closeTime: "21:00" },
        friday:    { open: true, openTime: "10:00", closeTime: "21:00" },
        saturday:  { open: true, openTime: "11:00", closeTime: "20:00" },
        sunday:    { open: true, openTime: "11:00", closeTime: "20:00" },
      },
      hoursNote: "24-hour sessions available by appointment",
      paymentMethods: ["cashapp", "zelle", "paypal", "venmo"],
      featuredArtists: [],
    },
  });

  console.log("✅ Clear Ear Studios seeded — ELITE / CUSTOM / published");
  await db.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
