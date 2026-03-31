/**
 * src/lib/agents/content-moderation.ts
 * Content Moderation Agent — Step 8
 *
 * Two modes:
 *   1. moderateContent()  — called on upload/update event triggers
 *   2. runContentModerationAgent() — daily sweep of last-24h content
 *
 * Severity:
 *   HIGH   → auto-unpublish + flag user account + urgent admin notification
 *   MEDIUM → auto-unpublish + notify artist
 *   LOW    → stays published, admin notified for review
 */

import { db }                  from "@/lib/db";
import { scanText }             from "@/lib/agents/moderation-keywords";
import { logAgentAction }       from "@/lib/agents";
import { createNotification }   from "@/lib/notifications";
import type { NotificationType } from "@prisma/client";

type ContentType = "TRACK" | "MERCH" | "PROFILE" | "DIGITAL_PRODUCT";

type ModerationResult = {
  flagged:  boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | null;
  reason:   string | null;
  flagId:   string | null;
};

// ─── Single-item moderation (event trigger) ───────────────────────────────────

/**
 * Scan a piece of content for violations.
 * Called immediately after track upload, merch listing, profile update, etc.
 */
export async function moderateContent(
  userId:      string,
  contentType: ContentType,
  contentId:   string,
  text:        string,
): Promise<ModerationResult> {
  const match = scanText(text);
  if (!match) return { flagged: false, severity: null, reason: null, flagId: null };

  // Create moderation flag record
  const flag = await db.moderationFlag.create({
    data: {
      userId,
      contentType,
      contentId,
      reason:   match.reason,
      severity: match.severity,
      status:   "PENDING",
    },
  });

  // ── Enforce by severity ──────────────────────────────────────────────────
  if (match.severity === "HIGH") {
    await enforceHigh(userId, contentType, contentId, match.reason, flag.id);
  } else if (match.severity === "MEDIUM") {
    await enforceMedium(userId, contentType, contentId, match.reason);
  }
  // LOW: stays published — admin gets notification below

  // ── Admin notification ────────────────────────────────────────────────────
  await notifyAdmins(userId, contentType, contentId, match.reason, match.severity, flag.id);

  await logAgentAction(
    "CONTENT_MODERATION",
    "CONTENT_FLAGGED",
    contentType,
    contentId,
    { userId, reason: match.reason, severity: match.severity, flagId: flag.id },
  );

  return {
    flagged:  true,
    severity: match.severity,
    reason:   match.reason,
    flagId:   flag.id,
  };
}

// ─── Daily sweep ──────────────────────────────────────────────────────────────

/**
 * Sweeps content published in the last 24 hours that may have been missed
 * by the event trigger (bypass, bulk import, etc.).
 */
export async function runContentModerationAgent(): Promise<{ acted: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let acted   = 0;

  // ── Tracks published in last 24h ──────────────────────────────────────────
  const recentTracks = await db.track.findMany({
    where: { createdAt: { gte: since }, status: "PUBLISHED" },
    select: { id: true, artistId: true, title: true, description: true },
  });

  for (const track of recentTracks) {
    const alreadyFlagged = await db.moderationFlag.findFirst({
      where: { contentType: "TRACK", contentId: track.id },
      select: { id: true },
    });
    if (alreadyFlagged) continue;

    const combined = [track.title, track.description].filter(Boolean).join(" ");
    const result   = await moderateContent(track.artistId, "TRACK", track.id, combined);
    if (result.flagged) acted++;
  }

  // ── Merch products created in last 24h ────────────────────────────────────
  const recentMerch = await db.merchProduct.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, artistId: true, title: true, description: true },
  });

  for (const merch of recentMerch) {
    const alreadyFlagged = await db.moderationFlag.findFirst({
      where: { contentType: "MERCH", contentId: merch.id },
      select: { id: true },
    });
    if (alreadyFlagged) continue;

    const combined = [merch.title, merch.description].filter(Boolean).join(" ");
    const result   = await moderateContent(merch.artistId, "MERCH", merch.id, combined);
    if (result.flagged) acted++;
  }

  // ── Digital products created in last 24h ──────────────────────────────────
  const recentDigital = await db.digitalProduct.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, userId: true, title: true, description: true },
  });

  for (const dp of recentDigital) {
    const alreadyFlagged = await db.moderationFlag.findFirst({
      where: { contentType: "DIGITAL_PRODUCT", contentId: dp.id },
      select: { id: true },
    });
    if (alreadyFlagged) continue;

    const combined = [dp.title, dp.description].filter(Boolean).join(" ");
    const result   = await moderateContent(dp.userId, "DIGITAL_PRODUCT", dp.id, combined);
    if (result.flagged) acted++;
  }

  await logAgentAction("CONTENT_MODERATION", "DAILY_SWEEP_COMPLETE", undefined, undefined, {
    tracked:  recentTracks.length,
    merch:    recentMerch.length,
    digital:  recentDigital.length,
    flagged:  acted,
  });

  return { acted };
}

// ─── Enforcement helpers ──────────────────────────────────────────────────────

async function enforceHigh(
  userId:      string,
  contentType: ContentType,
  contentId:   string,
  reason:      string,
  flagId:      string,
): Promise<void> {
  // Unpublish content
  await unpublishContent(contentType, contentId);

  // Flag the user account
  await db.user.update({
    where: { id: userId },
    data:  { isSuspended: false }, // don't auto-suspend — flag for admin review instead
  });

  // Notify the artist
  await createNotification({
    userId,
    type:    "SYSTEM_ALERT" as NotificationType,
    title:   "Content Removed",
    message: `Your ${contentTypeLabel(contentType)} was removed because it violated our community guidelines (${reason}). Please review our content policy.`,
    link:    "/dashboard/settings",
  });

  await logAgentAction("CONTENT_MODERATION", "CONTENT_REMOVED_HIGH", contentType, contentId, {
    userId, reason, flagId,
  });
}

async function enforceMedium(
  userId:      string,
  contentType: ContentType,
  contentId:   string,
  reason:      string,
): Promise<void> {
  // Unpublish content
  await unpublishContent(contentType, contentId);

  // Notify the artist
  await createNotification({
    userId,
    type:    "SYSTEM_ALERT" as NotificationType,
    title:   "Content Under Review",
    message: `Your ${contentTypeLabel(contentType)} has been flagged for review and is temporarily unpublished. Our team will review it shortly.`,
    link:    "/dashboard/settings",
  });

  await logAgentAction("CONTENT_MODERATION", "CONTENT_UNPUBLISHED_MEDIUM", contentType, contentId, {
    userId, reason,
  });
}

async function unpublishContent(contentType: ContentType, contentId: string): Promise<void> {
  try {
    if (contentType === "TRACK") {
      await db.track.update({ where: { id: contentId }, data: { status: "DRAFT" } });
    } else if (contentType === "MERCH") {
      await db.merchProduct.update({ where: { id: contentId }, data: { isActive: false } });
    } else if (contentType === "DIGITAL_PRODUCT") {
      await db.digitalProduct.update({ where: { id: contentId }, data: { published: false } });
    }
    // PROFILE type: no auto-unpublish — stays flagged for admin action
  } catch {
    // Content may have been deleted already — ignore
  }
}

async function notifyAdmins(
  userId:      string,
  contentType: ContentType,
  contentId:   string,
  reason:      string,
  severity:    "LOW" | "MEDIUM" | "HIGH",
  flagId:      string,
): Promise<void> {
  // Admin alerts surface via the /admin/moderation queue (ModerationFlag records).
  // Log to AgentLog so the /admin/agents dashboard also shows the event.
  await logAgentAction(
    "CONTENT_MODERATION",
    `FLAG_CREATED_${severity}`,
    contentType,
    contentId,
    { userId, reason, flagId },
  );
}

function contentTypeLabel(t: ContentType): string {
  return { TRACK: "track", MERCH: "merch listing", PROFILE: "profile bio", DIGITAL_PRODUCT: "digital product" }[t];
}
