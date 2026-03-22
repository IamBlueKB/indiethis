import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

// GET /api/cron/stream-lease-cleanup
// Deletes audio files for stream leases cancelled more than 30 days ago.
// Called by Vercel Cron — add to vercel.json:
//   { "crons": [{ "path": "/api/cron/stream-lease-cleanup", "schedule": "0 3 * * *" }] }
// Protected by CRON_SECRET env var.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find all leases cancelled >30 days ago that still have an audioUrl
  const expiredLeases = await db.streamLease.findMany({
    where: {
      isActive:    false,
      cancelledAt: { lt: thirtyDaysAgo },
      audioUrl:    { not: "" },
    },
    select: { id: true, audioUrl: true, trackTitle: true },
  });

  if (expiredLeases.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No expired leases to clean up." });
  }

  const results: { id: string; status: "deleted" | "error"; error?: string }[] = [];

  for (const lease of expiredLeases) {
    try {
      // Extract UploadThing file key from the URL
      // UploadThing URLs look like: https://utfs.io/f/[fileKey]
      const url = lease.audioUrl!;
      const fileKey = url.split("/f/")[1]?.split("?")[0];

      if (fileKey) {
        await utapi.deleteFiles([fileKey]);
      }

      // Clear the audioUrl so we don't attempt deletion again
      await db.streamLease.update({
        where: { id: lease.id },
        data:  { audioUrl: "" },  // empty string signals file was purged
      });

      results.push({ id: lease.id, status: "deleted" });
    } catch (err) {
      console.error(`[stream-lease-cleanup] Failed to delete file for lease ${lease.id}:`, err);
      results.push({ id: lease.id, status: "error", error: String(err) });
    }
  }

  const deletedCount = results.filter((r) => r.status === "deleted").length;
  const errorCount   = results.filter((r) => r.status === "error").length;

  console.log(`[stream-lease-cleanup] Processed ${expiredLeases.length} leases: ${deletedCount} deleted, ${errorCount} errors`);

  return NextResponse.json({ deleted: deletedCount, errors: errorCount, results });
}
