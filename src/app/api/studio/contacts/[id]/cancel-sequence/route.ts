import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelFollowUpByContactId } from "@/lib/email-sequence";

// POST /api/studio/contacts/[id]/cancel-sequence
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { id: contactId } = await params;

  // Verify the contact belongs to this studio
  const contact = await db.contact.findFirst({
    where: { id: contactId, studioId: studio.id },
    select: { id: true },
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const cancelled = await cancelFollowUpByContactId(studio.id, contactId);

  return NextResponse.json({ cancelled });
}
