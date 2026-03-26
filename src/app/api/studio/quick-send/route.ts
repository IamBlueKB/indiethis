import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scheduleFollowUpSequence } from "@/lib/email-sequence";
import { sendQuickSendEmail } from "@/lib/brevo/email";

const APP_URL = () => process.env.NEXTAUTH_URL ?? "https://indiethis.com";

// POST /api/studio/quick-send — create a quick-send delivery link
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where:  { ownerId: session.user.id },
    select: { id: true, name: true, emailSequenceEnabled: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();
  const {
    recipientEmail,
    recipientPhone,
    fileUrls,
    message,
    contactId,
    senderName,
    sendFollowUpSequence,
    emailSteps,
  } = body as {
    recipientEmail:      string;
    recipientPhone?:     string;
    fileUrls:            string[];
    message?:            string;
    contactId?:          string;
    senderName?:         string;
    sendFollowUpSequence?: boolean;
    /** Pre-written steps from the delivery form — subject + body fully composed by studio. */
    emailSteps?: { dayKey: string; subject: string; body: string }[];
  };

  if (!recipientEmail?.trim() || !fileUrls?.length) {
    return NextResponse.json(
      { error: "Recipient email and files are required." },
      { status: 400 }
    );
  }

  const token     = randomBytes(20).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const hasSteps  = sendFollowUpSequence && Array.isArray(emailSteps) && emailSteps.length > 0;

  const quickSend = await db.quickSend.create({
    data: {
      studioId:            studio.id,
      contactId:           contactId || null,
      senderName:          senderName?.trim() || studio.name,
      recipientEmail:      recipientEmail.toLowerCase().trim(),
      recipientPhone:      recipientPhone?.trim() || null,
      fileUrls,
      message:             message?.trim() || null,
      token,
      expiresAt,
      sendFollowUpSequence: hasSteps === true,
    },
  });

  // Log activity on contact
  if (contactId) {
    await db.activityLog.create({
      data: {
        contactId,
        studioId:    studio.id,
        type:        "FILES_DELIVERED",
        description: `Quick send delivery to ${recipientEmail} (${fileUrls.length} file${fileUrls.length === 1 ? "" : "s"})`,
      },
    });
  }

  // Schedule follow-up emails if requested and studio has the feature enabled
  if (hasSteps && studio.emailSequenceEnabled && emailSteps) {
    const downloadLink = `${APP_URL()}/dl/${token}`;

    // Resolve {downloadLink} placeholder in every body — messages are otherwise fully written
    const resolvedSteps = emailSteps.map((step) => ({
      ...step,
      body: step.body.replace(/\{downloadLink\}/g, downloadLink),
    }));

    await scheduleFollowUpSequence({
      studioId:     studio.id,
      contactId:    contactId ?? null,
      contactEmail: recipientEmail.toLowerCase().trim(),
      quickSendId:  quickSend.id,
      deliveredAt:  quickSend.createdAt,
      steps:        resolvedSteps,
    });
  }

  const downloadUrl = `${APP_URL()}/dl/${token}`;

  // Send delivery email to recipient
  sendQuickSendEmail({
    recipientEmail: quickSend.recipientEmail,
    senderName:     quickSend.senderName,
    message:        quickSend.message ?? undefined,
    downloadUrl,
    fileCount:      fileUrls.length,
  }).catch(() => {});

  return NextResponse.json({ send: quickSend, downloadUrl }, { status: 201 });
}

// GET /api/studio/quick-send — list recent quick sends
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where:  { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const sends = await db.quickSend.findMany({
    where:   { studioId: studio.id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  return NextResponse.json({ sends });
}
