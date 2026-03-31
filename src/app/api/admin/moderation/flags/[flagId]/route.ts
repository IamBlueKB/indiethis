/**
 * POST /api/admin/moderation/flags/[flagId]
 * Body: { action: "approve" | "remove", reviewedBy: string }
 *
 * approve → status = APPROVED, content stays published
 * remove  → status = REMOVED, content unpublished, artist notified
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess }        from "@/lib/require-admin-access";
import { db }                        from "@/lib/db";
import { createNotification }        from "@/lib/notifications";
import type { NotificationType }     from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ flagId: string }> },
) {
  await requireAdminAccess("moderation");

  const { flagId }              = await params;
  const { action, reviewedBy }  = await req.json() as { action: string; reviewedBy?: string };

  const flag = await db.moderationFlag.findUnique({
    where:  { id: flagId },
    select: { id: true, userId: true, contentType: true, contentId: true, reason: true },
  });
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.moderationFlag.update({
    where: { id: flagId },
    data:  {
      status:     action === "approve" ? "APPROVED" : "REMOVED",
      reviewedBy: reviewedBy ?? null,
      reviewedAt: new Date(),
    },
  });

  if (action === "remove") {
    // Unpublish the content
    await unpublishContent(flag.contentType, flag.contentId);

    // Notify the artist
    await createNotification({
      userId:  flag.userId,
      type:    "SYSTEM_ALERT" as NotificationType,
      title:   "Content Removed",
      message: `Your ${contentTypeLabel(flag.contentType)} has been removed for violating our community guidelines (${flag.reason}). Contact support if you believe this is an error.`,
      link:    "/dashboard/settings",
    });
  }

  return NextResponse.json({ ok: true });
}

async function unpublishContent(contentType: string, contentId: string): Promise<void> {
  try {
    if (contentType === "TRACK") {
      await db.track.update({ where: { id: contentId }, data: { status: "DRAFT" } });
    } else if (contentType === "MERCH") {
      await db.merchProduct.update({ where: { id: contentId }, data: { isActive: false } });
    } else if (contentType === "DIGITAL_PRODUCT") {
      await db.digitalProduct.update({ where: { id: contentId }, data: { published: false } });
    }
  } catch {
    // content may already be gone
  }
}

function contentTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    TRACK: "track", MERCH: "merch listing", PROFILE: "profile bio", DIGITAL_PRODUCT: "digital product",
  };
  return labels[t] ?? "content";
}
