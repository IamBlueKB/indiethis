import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSplitSheetRejectedEmail } from "@/lib/brevo/email";

/**
 * POST /api/splits/review/[token]/reject
 * Public endpoint — non-IndieThis user rejects via their review token.
 * Body: { reason?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json() as { reason?: string };

  const split = await db.split.findUnique({
    where: { reviewToken: token },
    include: {
      splitSheet: {
        include: {
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
  if (split.rejectedAt) {
    return NextResponse.json({ error: "Already rejected" }, { status: 409 });
  }

  await db.split.update({
    where: { id: split.id },
    data: { rejectedAt: new Date(), rejectionReason: body.reason ?? null },
  });

  await db.splitSheet.update({ where: { id: split.splitSheetId }, data: { status: "DISPUTED" } });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";

  await createNotification({
    userId: split.splitSheet.createdById,
    type: "SPLIT_SHEET_REJECTED",
    title: `${split.name} rejected the split sheet`,
    message: `"${split.splitSheet.track.title}"${body.reason ? `: "${body.reason}"` : ""}`,
    link: `/dashboard/splits/${split.splitSheetId}`,
  }).catch(console.error);

  if (split.splitSheet.createdBy.email) {
    sendSplitSheetRejectedEmail({
      creatorEmail: split.splitSheet.createdBy.email,
      creatorName: split.splitSheet.createdBy.name ?? "Artist",
      contributorName: split.name,
      trackTitle: split.splitSheet.track.title,
      reason: body.reason,
      dashboardUrl: `${appUrl}/dashboard/splits/${split.splitSheetId}`,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
