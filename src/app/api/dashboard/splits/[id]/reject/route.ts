import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSplitSheetRejectedEmail } from "@/lib/brevo/email";

/**
 * POST /api/dashboard/splits/[id]/reject
 * Body: { reason?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;
  const body = await req.json() as { reason?: string };

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

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });

  await db.split.update({
    where: { id: mySplit.id },
    data: { rejectedAt: new Date(), rejectionReason: body.reason ?? null },
  });

  // Mark sheet DISPUTED
  await db.splitSheet.update({ where: { id }, data: { status: "DISPUTED" } });

  // Notify creator
  await createNotification({
    userId: sheet.createdById,
    type: "SPLIT_SHEET_REJECTED",
    title: `${user?.name ?? "A contributor"} rejected the split sheet`,
    message: `"${sheet.track.title}"${body.reason ? `: "${body.reason}"` : ""}`,
    link: `/dashboard/splits/${id}`,
  }).catch(console.error);

  if (sheet.createdBy.email) {
    sendSplitSheetRejectedEmail({
      creatorEmail: sheet.createdBy.email,
      creatorName: sheet.createdBy.name ?? "Artist",
      contributorName: user?.name ?? "A contributor",
      trackTitle: sheet.track.title,
      reason: body.reason,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/dashboard/splits/${id}`,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
