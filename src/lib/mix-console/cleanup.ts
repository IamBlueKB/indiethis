/**
 * src/lib/mix-console/cleanup.ts
 *
 * Nightly cleanup for expired guest mix jobs.
 * - Finds MixJob records where expiresAt < now and status != EXPIRED
 * - Deletes their files from Supabase storage
 * - Marks the job EXPIRED in the DB
 *
 * Files stored under: processed/mixing/{jobId}/
 */

import { db } from "@/lib/db";

const SUPABASE_URL         = process.env.SUPABASE_URL         ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

async function deleteSupabasePath(path: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/processed/${path}`,
      {
        method:  "DELETE",
        headers: {
          "apikey":        SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteJobFolder(jobId: string): Promise<void> {
  // List all objects under mixing/{jobId}/ and delete them
  try {
    const listRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/processed`,
      {
        method:  "POST",
        headers: {
          "apikey":        SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          prefix: `mixing/${jobId}/`,
          limit:  100,
        }),
      },
    );

    if (!listRes.ok) return;
    const files = await listRes.json() as { name: string }[];
    if (!Array.isArray(files) || files.length === 0) return;

    // Batch delete via storage API
    const paths = files.map((f) => `mixing/${jobId}/${f.name}`);
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/processed`,
      {
        method:  "DELETE",
        headers: {
          "apikey":        SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ prefixes: paths }),
      },
    );
  } catch {
    // Best-effort — job still gets marked EXPIRED even if file delete fails
  }
}

export async function cleanupExpiredMixJobs(): Promise<{
  checked: number;
  expired: number;
  errors:  number;
}> {
  const now = new Date();

  const expiredJobs = await db.mixJob.findMany({
    where: {
      expiresAt: { lt: now },
      status:    { not: "EXPIRED" },
    },
    select: {
      id:                  true,
      cleanFilePath:       true,
      polishedFilePath:    true,
      aggressiveFilePath:  true,
      mixFilePath:         true,
    },
    take: 50, // batch cap — runs every 24h so this is plenty
  });

  let expired = 0;
  let errors  = 0;

  for (const job of expiredJobs) {
    try {
      // Delete the whole mixing/{jobId}/ folder from Supabase
      await deleteJobFolder(job.id);

      // Mark expired + null out file paths
      await db.mixJob.update({
        where: { id: job.id },
        data: {
          status:              "EXPIRED",
          cleanFilePath:       null,
          polishedFilePath:    null,
          aggressiveFilePath:  null,
          mixFilePath:         null,
          previewFilePaths:    undefined,
        },
      });
      expired++;
    } catch (err) {
      console.error(`[mix-cleanup] Failed to expire job ${job.id}:`, err);
      errors++;
    }
  }

  return { checked: expiredJobs.length, expired, errors };
}
