import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/studio/quick-send — create a quick-send delivery link
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();
  const { recipientEmail, recipientPhone, fileUrls, message, contactId, senderName, sendFollowUpSequence } = body as {
    recipientEmail: string;
    recipientPhone?: string;
    fileUrls: string[];
    message?: string;
    contactId?: string;
    senderName?: string;
    sendFollowUpSequence?: boolean;
  };

  if (!recipientEmail?.trim() || !fileUrls?.length) {
    return NextResponse.json({ error: "Recipient email and files are required." }, { status: 400 });
  }

  const token = randomBytes(20).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const quickSend = await db.quickSend.create({
    data: {
      studioId: studio.id,
      contactId: contactId || null,
      senderName: senderName?.trim() || studio.name,
      recipientEmail: recipientEmail.toLowerCase().trim(),
      recipientPhone: recipientPhone?.trim() || null,
      fileUrls,
      message: message?.trim() || null,
      token,
      expiresAt,
      sendFollowUpSequence: sendFollowUpSequence === true,
    },
  });

  // Log activity on contact
  if (contactId) {
    await db.activityLog.create({
      data: {
        contactId,
        studioId: studio.id,
        type: "FILES_DELIVERED",
        description: `Quick send delivery to ${recipientEmail} (${fileUrls.length} file${fileUrls.length === 1 ? "" : "s"})`,
      },
    });
  }

  const downloadUrl = `${process.env.NEXTAUTH_URL ?? ""}/dl/${token}`;

  return NextResponse.json({ send: quickSend, downloadUrl }, { status: 201 });
}

// GET /api/studio/quick-send — list recent quick sends
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const sends = await db.quickSend.findMany({
    where: { studioId: studio.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sends });
}
