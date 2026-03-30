import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const session = await getAdminSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicationId } = await params;
  const body = (await req.json()) as { action: "APPROVE" | "DENY"; note?: string };
  const { action, note } = body;

  if (action !== "APPROVE" && action !== "DENY")
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  // Load application with DJ profile + user
  const application = await db.dJVerificationApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      djProfileId: true,
      djProfile: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!application)
    return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const reviewedAt = new Date();
  const reviewedBy = session.name ?? session.email ?? "Admin";

  if (action === "APPROVE") {
    await db.$transaction([
      db.dJVerificationApplication.update({
        where: { id: applicationId },
        data: {
          status: "APPROVED",
          adminNote: note ?? null,
          reviewedAt,
          reviewedBy,
        },
      }),
      db.dJProfile.update({
        where: { id: application.djProfileId },
        data: {
          isVerified: true,
          verificationStatus: "APPROVED",
          verifiedAt: reviewedAt,
          verifiedBy: reviewedBy,
        },
      }),
    ]);

    await createNotification({
      userId: application.djProfile.userId,
      type: "ACCOUNT_COMPED",
      title: "Verification Approved!",
      message: "You are now a verified DJ on IndieThis. Your earnings are unlocked.",
      link: "/dashboard/dj/verification",
    });
  } else {
    await db.$transaction([
      db.dJVerificationApplication.update({
        where: { id: applicationId },
        data: {
          status: "DENIED",
          adminNote: note ?? null,
          reviewedAt,
          reviewedBy,
        },
      }),
      db.dJProfile.update({
        where: { id: application.djProfileId },
        data: {
          isVerified: false,
          verificationStatus: "DENIED",
        },
      }),
    ]);

    await createNotification({
      userId: application.djProfile.userId,
      type: "ACCOUNT_COMPED",
      title: "Verification Update",
      message: `Your verification application was not approved${note ? `: ${note}` : "."}`,
      link: "/dashboard/dj/verification",
    });
  }

  return NextResponse.json({ success: true });
}
