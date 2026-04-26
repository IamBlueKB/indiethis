import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const track = await db.track.findFirst({
  where: { title: { contains: "Razor", mode: "insensitive" } },
  select: { id: true, title: true, fileUrl: true },
});

if (!track) {
  console.log("No track found with 'Razor' in title.");
  console.log("Listing all tracks:");
  const all = await db.track.findMany({
    select: { id: true, title: true, fileUrl: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(all, null, 2));
} else {
  console.log(JSON.stringify(track, null, 2));
}

await db.$disconnect();
