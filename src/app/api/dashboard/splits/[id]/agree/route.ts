import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSplitSheetAgreedEmail, sendSplitSheetActiveEmail } from "@/lib/brevo/email";

/**
 * POST /api/dashboard/splits/[id]/agree
 * Authenticated user agrees to their split on this sheet.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const sheet = await db.splitSheet.findFirst({
    where: { id, status: "PENDING" },
    include: {
      splits: true,
      track: { select: { title: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mySplit = sheet.splits.find((s) => s.userId === userId);
  if (!mySplit) return NextResponse.json({ error: "You are not a participant" }, { status: 403 });
  if (mySplit.agreedAt) return NextResponse.json({ error: "Already agreed" }, { status: 409 });

  await db.split.update({ where: { id: mySplit.id }, data: { agreedAt: new Date() } });

  // Re-fetch to check if all have agreed
  const allSplits = await db.split.findMany({ where: { splitSheetId: id } });
  const allAgreed = allSplits.every((s) => s.userId === userId ? true : !!s.agreedAt);

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });

  if (allAgreed) {
    // Mark sheet ACTIVE
    await db.splitSheet.update({ where: { id }, data: { status: "ACTIVE" } });

    // Notify all participants
    for (const split of allSplits) {
      if (split.userId) {
        await createNotification({
          userId: split.userId,
          type: "SPLIT_SHEET_ACTIVE",
          title: `Split sheet for "${sheet.track.title}" is now active`,
          message: "All contributors agreed. Earnings will be distributed automatically.",
          link: `/dashboard/splits/${id}`,
        }).catch(console.error);
      }
      sendSplitSheetActiveEmail({
        recipientEmail: split.email,
        recipientName: split.name,
        trackTitle: sheet.track.title,
        percentage: split.percentage,
        role: split.role,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/dashboard/splits/${id}`,
      }).catch(console.error);
    }
  } else {
    // Notify creator that someone agreed
    await createNotification({
      userId: sheet.createdById,
      type: "SPLIT_SHEET_AGREED",
      title: `${user?.name ?? "A contributor"} agreed to the split`,
      message: `"${sheet.track.title}" — ${allSplits.filter((s) => s.agreedAt).length} of ${allSplits.length} agreed`,
      link: `/dashboard/splits/${id}`,
    }).catch(console.error);
    if (sheet.createdBy.email) {
      sendSplitSheetAgreedEmail({
        creatorEmail: sheet.createdBy.email,
        creatorName: sheet.createdBy.name ?? "Artist",
        contributorName: user?.name ?? "A contributor",
        trackTitle: sheet.track.title,
        agreedCount: allSplits.filter((s) => !!s.agreedAt || s.userId === userId).length,
        totalCount: allSplits.length,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/dashboard/splits/${id}`,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, allAgreed });
}
