import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/studio/email — list email campaigns
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

  const campaigns = await db.emailCampaign.findMany({
    where: { studioId: studio.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Count contacts per source for segmentation UI
  const [totalContacts, sourceCounts] = await Promise.all([
    db.contact.count({ where: { studioId: studio.id } }),
    db.contact.groupBy({
      by: ["source"],
      where: { studioId: studio.id },
      _count: { id: true },
    }),
  ]);

  const countBySource = Object.fromEntries(
    sourceCounts.map((r) => [r.source, r._count.id])
  );

  return NextResponse.json({ campaigns, totalContacts, countBySource });
}

// POST /api/studio/email — create (and optionally send) campaign
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();
  const { subject, body: emailBody, sendNow, attachmentUrls, sourceFilter } = body;

  if (!subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  const recipientWhere = {
    studioId: studio.id,
    ...(sourceFilter ? { source: sourceFilter as import("@prisma/client").ContactSource } : {}),
  };
  const recipientCount = await db.contact.count({ where: recipientWhere });

  const campaign = await db.emailCampaign.create({
    data: {
      studioId: studio.id,
      subject: subject.trim(),
      body: emailBody.trim(),
      recipientFilter: sourceFilter ? { source: sourceFilter } : undefined,
      recipientCount,
      attachmentUrls: attachmentUrls ?? [],
      sentAt: sendNow ? new Date() : null,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
