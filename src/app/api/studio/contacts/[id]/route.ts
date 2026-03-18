import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/studio/contacts/[id] — contact detail with full history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const contact = await db.contact.findFirst({
    where: { id, studioId: studio.id },
    include: {
      sessions: {
        orderBy: { dateTime: "desc" },
        take: 20,
      },
      deliveredFiles: {
        orderBy: { deliveredAt: "desc" },
        take: 20,
      },
      activityLog: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Fetch YouTube references if contact has a linked artist account
  let youtubeReferences: object[] = [];
  if (contact.email) {
    const artistUser = await db.user.findUnique({
      where: { email: contact.email },
      include: {
        youtubeReferences: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });
    if (artistUser) youtubeReferences = artistUser.youtubeReferences;
  }

  // Count pending follow-up emails for this contact
  const pendingEmailCount = await db.scheduledEmail.count({
    where: {
      studioId: studio.id,
      contactId: id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ contact, youtubeReferences, pendingEmailCount });
}

// PATCH /api/studio/contacts/[id] — update contact
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const existing = await db.contact.findFirst({ where: { id, studioId: studio.id } });
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await req.json();
  const contact = await db.contact.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? existing.name,
      email: body.email?.trim() ?? existing.email,
      phone: body.phone?.trim() ?? existing.phone,
      instagramHandle: body.instagramHandle?.trim() ?? existing.instagramHandle,
      genre: body.genre?.trim() ?? existing.genre,
      notes: body.notes?.trim() ?? existing.notes,
    },
  });

  return NextResponse.json({ contact });
}

// DELETE /api/studio/contacts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const existing = await db.contact.findFirst({ where: { id, studioId: studio.id } });
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  await db.contact.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
