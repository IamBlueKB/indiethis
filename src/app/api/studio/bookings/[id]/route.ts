import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelFollowUpByContactId } from "@/lib/email-sequence";
import { createNotification } from "@/lib/notifications";

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
    select: { id: true, name: true },
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

  // Fetch booking details for notification + follow-up cancellation
  const booking = await db.bookingSession.findFirst({
    where: { id, studioId: studio.id },
    select: {
      contactId: true,
      artistId: true,
      dateTime: true,
      contact: { select: { name: true } },
    },
  });

  // When a booking is confirmed or completed, cancel any pending follow-up
  // emails for that contact — they've re-engaged so the sequence is no longer needed.
  // Also mark the contact as converted (for lead ROI tracking).
  if ((status === "CONFIRMED" || status === "COMPLETED") && booking?.contactId) {
    void cancelFollowUpByContactId(studio.id, booking.contactId);
    void db.contact.updateMany({
      where: { id: booking.contactId, studioId: studio.id, convertedToBooking: false },
      data: { convertedToBooking: true, convertedAt: new Date() },
    }).catch(() => {});
  }

  // Notify the artist when booking status changes
  if (booking?.artistId && status) {
    const sessionDateStr = booking.dateTime
      ? new Date(booking.dateTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "your session";

    if (status === "CONFIRMED") {
      void createNotification({
        userId: booking.artistId,
        type: "BOOKING_CONFIRMED",
        title: "Booking confirmed!",
        message: `${studio.name} confirmed your booking for ${sessionDateStr}.`,
        link: "/dashboard/sessions",
      }).catch(() => {});
    } else if (status === "CANCELLED") {
      void createNotification({
        userId: booking.artistId,
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        message: `${studio.name} cancelled your ${sessionDateStr} booking.`,
        link: "/dashboard/sessions",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
