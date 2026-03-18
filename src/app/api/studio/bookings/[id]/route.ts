import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelFollowUpByContactId } from "@/lib/email-sequence";

// PATCH /api/studio/bookings/[id]
// Updates status, paymentStatus, and/or engineerNotes on a booking.
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
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { id } = await params;
  const body = await req.json();
  const { status, paymentStatus, engineerNotes, notes } = body as {
    status?: string;
    paymentStatus?: string;
    engineerNotes?: string;
    notes?: string;
  };

  const updated = await db.bookingSession.updateMany({
    where: { id, studioId: studio.id },
    data: {
      ...(status && { status: status as never }),
      ...(paymentStatus && { paymentStatus: paymentStatus as never }),
      ...(engineerNotes !== undefined && { engineerNotes: engineerNotes || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // When a booking is confirmed or completed, cancel any pending follow-up
  // emails for that contact — they've re-engaged so the sequence is no longer needed.
  if ((status === "CONFIRMED" || status === "COMPLETED")) {
    const booking = await db.bookingSession.findFirst({
      where: { id, studioId: studio.id },
      select: { contactId: true },
    });
    if (booking?.contactId) {
      void cancelFollowUpByContactId(studio.id, booking.contactId);
    }
  }

  return NextResponse.json({ success: true });
}
