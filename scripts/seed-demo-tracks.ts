import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const artistId = "cmmvf72ew0000l4lkfio6onp4"; // Test Artist

  // Update existing demo tracks to use local WAV files
  const updates = [
    { title: "Midnight Drive", fileUrl: "/demo/midnight-drive.wav" },
    { title: "Golden Hour",    fileUrl: "/demo/golden-hour.wav" },
    { title: "Neon Nights",    fileUrl: "/demo/neon-nights.wav" },
  ];

  for (const { title, fileUrl } of updates) {
    const updated = await db.track.updateMany({
      where: { title, artistId },
      data: { fileUrl },
    });
    console.log(`✓ Updated: ${title} → ${fileUrl} (${updated.count} row)`);
  }

  console.log("\nDone.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
