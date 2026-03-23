/**
 * ai-receipt.ts
 *
 * Auto-creates a LicenseDocument receipt for completed AI jobs.
 * Called fire-and-forget from the job polling endpoint.
 */

import { db } from "@/lib/db";

const TOOL_NAMES: Record<string, string> = {
  COVER_ART:   "IndieThis AI Cover Art",
  VIDEO:       "IndieThis AI Music Video",
  MASTERING:   "IndieThis AI Mastering",
  LYRIC_VIDEO: "IndieThis AI Lyric Video",
  AR_REPORT:   "IndieThis A&R Report",
  PRESS_KIT:   "IndieThis Press Kit",
};

/**
 * Idempotently ensures a LicenseDocument receipt exists for a completed AI job.
 * Safe to call on every poll — exits early if the receipt already exists.
 */
export async function ensureAIReceipt(
  jobId:  string,
  userId: string,
  jobType: string,
  completedAt: Date | null,
): Promise<void> {
  // Check if receipt already exists
  const existing = await db.licenseDocument.findFirst({
    where: { aiJobId: jobId },
    select: { id: true },
  });
  if (existing) return;

  const toolName = TOOL_NAMES[jobType] ?? `IndieThis AI — ${jobType}`;
  const date     = (completedAt ?? new Date()).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const title    = `${toolName} — ${date}`;

  // fileUrl points to the on-demand PDF generation route
  const fileUrl = `/api/ai-jobs/${jobId}/receipt`;

  await db.licenseDocument.create({
    data: {
      userId,
      title,
      fileUrl,
      fileType:  "pdf",
      source:    "AI_GENERATION",
      notes:     `Auto-generated receipt for ${toolName}. Job ID: ${jobId}`,
      aiJobId:   jobId,
    },
  });
}
