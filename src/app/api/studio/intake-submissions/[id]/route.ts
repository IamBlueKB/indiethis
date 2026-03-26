import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sendIntakeConfirmedEmail,
  sendIntakeCompletedEmail,
  sendIntakeCancelledEmail,
} from "@/lib/brevo/email";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
type IntakeStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { id } = await params;
  const body = await req.json();
  const { status, bpmDetected, keyDetected } = body as {
    status?: string;
    bpmDetected?: number | null;
    keyDetected?: string | null;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status as IntakeStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const submission = await db.intakeSubmission.findUnique({
    where: { id },
    include: {
      contact: { select: { name: true, email: true } },
      intakeLink: { select: { sessionDate: true, sessionTime: true, endTime: true } },
    },
  });

  if (!submission || submission.studioId !== studio.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (bpmDetected !== undefined) updateData.bpmDetected = bpmDetected;
  if (keyDetected !== undefined) updateData.keyDetected = keyDetected;

  const updated = await db.intakeSubmission.update({
    where: { id },
    data: updateData,
  });

  // Send email notification to client if they have an email
  const clientEmail = submission.contact?.email;
  const clientName = submission.contact?.name ?? submission.artistName;

  if (clientEmail) {
    const sessionDate = submission.intakeLink?.sessionDate
      ? new Date(submission.intakeLink.sessionDate).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

    if (status === "CONFIRMED") {
      await sendIntakeConfirmedEmail({
        email: clientEmail,
        name: clientName,
        studioName: studio.name,
        sessionDate,
        sessionTime: submission.intakeLink?.sessionTime ?? null,
        endTime: submission.intakeLink?.endTime ?? null,
      }).catch(() => {});
    } else if (status === "COMPLETED") {
      await sendIntakeCompletedEmail({
        email: clientEmail,
        name: clientName,
        studioName: studio.name,
      }).catch(() => {});
    } else if (status === "CANCELLED") {
      await sendIntakeCancelledEmail({
        email: clientEmail,
        name: clientName,
        studioName: studio.name,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ submission: updated });
}
