import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/studio/email — list email campaigns + recipient counts per segment
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

  const studioId = studio.id;

  const campaigns = await db.emailCampaign.findMany({
    where: { studioId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const [totalContacts, artistCount, producerCount, bookedCount, allContacts] =
    await Promise.all([
      db.contact.count({ where: { studioId } }),
      db.contact.count({ where: { studioId, tags: { has: "artist" } } }),
      db.contact.count({ where: { studioId, tags: { has: "producer" } } }),
      db.contact.count({ where: { studioId, sessions: { some: {} } } }),
      db.contact.findMany({ where: { studioId }, select: { tags: true } }),
    ]);

  const leadsCount = totalContacts - bookedCount;

  // Collect unique custom tags (excluding built-ins)
  const builtIn = new Set(["artist", "producer"]);
  const customTagCounts: Record<string, number> = {};
  for (const c of allContacts) {
    for (const t of c.tags) {
      if (!builtIn.has(t)) {
        customTagCounts[t] = (customTagCounts[t] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({
    campaigns,
    totalContacts,
    segmentCounts: {
      artist: artistCount,
      producer: producerCount,
      booked: bookedCount,
      leads: leadsCount,
    },
    customTagCounts,
  });
}

// POST /api/studio/email — create (and optionally send) campaign
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Comp/free-trial accounts cannot send email blasts
  const owner = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { isComped: true },
  });
  if (owner?.isComped) {
    return NextResponse.json(
      { error: "Email blasts are not included in comp or free-trial access. Upgrade to a paid plan to send campaigns." },
      { status: 403 },
    );
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const studioId = studio.id;
  const body = await req.json();
  const { subject, body: emailBody, sendNow, attachmentUrls, segment, customTag } = body;

  if (!subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  // Build where clause based on segment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recipientWhere: any = { studioId };

  if (segment === "artist") {
    recipientWhere = { studioId, tags: { has: "artist" } };
  } else if (segment === "producer") {
    recipientWhere = { studioId, tags: { has: "producer" } };
  } else if (segment === "booked") {
    recipientWhere = { studioId, sessions: { some: {} } };
  } else if (segment === "leads") {
    recipientWhere = { studioId, sessions: { none: {} } };
  } else if (segment === "custom" && customTag?.trim()) {
    recipientWhere = { studioId, tags: { has: customTag.trim().toLowerCase() } };
  }

  const recipientCount = await db.contact.count({ where: recipientWhere });

  const campaign = await db.emailCampaign.create({
    data: {
      studioId,
      subject: subject.trim(),
      body: emailBody.trim(),
      recipientFilter: segment ? { segment, customTag: customTag ?? null } : undefined,
      recipientCount,
      attachmentUrls: attachmentUrls ?? [],
      sentAt: sendNow ? new Date() : null,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
