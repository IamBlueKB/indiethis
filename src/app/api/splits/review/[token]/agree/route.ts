import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSplitSheetAgreedEmail, sendSplitSheetActiveEmail } from "@/lib/brevo/email";

/**
 * POST /api/splits/review/[token]/agree
 * Public endpoint — non-IndieThis user agrees via their review token.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const split = await db.split.findUnique({
    where: { reviewToken: token },
    include: {
      splitSheet: {
        include: {
          splits: true,
          track: { select: { title: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!split) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (split.splitSheet.status !== "PENDING") {
    return NextResponse.json({ error: "Split sheet is no longer pending" }, { status: 409 });
  }
  if (split.agreedAt) {
    return NextResponse.json({ error: "Already agreed" }, { status: 409 });
  }

  await db.split.update({ where: { id: split.id }, data: { agreedAt: new Date() } });

  // Re-fetch all splits to check if everyone agreed
  const allSplits = await db.split.findMany({ where: { splitSheetId: split.splitSheetId } });
  const allAgreed = allSplits.every((s) => s.id === split.id ? true : !!s.agreedAt);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  if (allAgreed) {
    await db.splitSheet.update({ where: { id: split.splitSheetId }, data: { status: "ACTIVE" } });

    for (const s of allSplits) {
      if (s.userId) {
        await createNotification({
          userId: s.userId,
          type: "SPLIT_SHEET_ACTIVE",
          title: `Split sheet for "${split.splitSheet.track.title}" is now active`,
          message: "All contributors agreed. Earnings will be distributed automatically.",
          link: `/dashboard/splits/${split.splitSheetId}`,
        }).catch(console.error);
      }
      sendSplitSheetActiveEmail({
        recipientEmail: s.email,
        recipientName: s.name,
        trackTitle: split.splitSheet.track.title,
        percentage: s.percentage,
        role: s.role,
        dashboardUrl: s.userId
          ? `${appUrl}/dashboard/splits/${split.splitSheetId}`
          : `${appUrl}/splits/review/${s.reviewToken}`,
      }).catch(console.error);
    }
  } else {
    // Notify creator
    const agreedCount = allSplits.filter((s) => s.id === split.id || !!s.agreedAt).length;
    await createNotification({
      userId: split.splitSheet.createdById,
      type: "SPLIT_SHEET_AGREED",
      title: `${split.name} agreed to the split`,
      message: `"${split.splitSheet.track.title}" — ${agreedCount} of ${allSplits.length} agreed`,
      link: `/dashboard/splits/${split.splitSheetId}`,
    }).catch(console.error);

    if (split.splitSheet.createdBy.email) {
      sendSplitSheetAgreedEmail({
        creatorEmail: split.splitSheet.createdBy.email,
        creatorName: split.splitSheet.createdBy.name ?? "Artist",
        contributorName: split.name,
        trackTitle: split.splitSheet.track.title,
        agreedCount,
        totalCount: allSplits.length,
        dashboardUrl: `${appUrl}/dashboard/splits/${split.splitSheetId}`,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, allAgreed });
}
