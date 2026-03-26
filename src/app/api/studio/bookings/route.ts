import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({ where: { ownerId: session.user.id } });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const [bookings, requests, intakeSubmissions] = await Promise.all([
    db.bookingSession.findMany({
      where: { studioId: studio.id },
      orderBy: { dateTime: "desc" },
      include: {
        artist: { select: { name: true, email: true } },
        contact: { select: { id: true, name: true } },
      },
    }),
    db.contactSubmission.findMany({
      where: { studioId: studio.id, source: "BOOKING_REQUEST" },
      orderBy: { createdAt: "desc" },
    }),
    db.intakeSubmission.findMany({
      where: { studioId: studio.id, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        artistName: true,
        genre: true,
        projectDesc: true,
        notes: true,
        depositPaid: true,
        depositAmount: true,
        paymentMethod: true,
        aiVideoRequested: true,
        youtubeLinks: true,
        fileUrls: true,
        status: true,
        createdAt: true,
        contact: { select: { name: true, email: true, phone: true } },
        intakeLink: { select: { sessionDate: true, sessionTime: true, endTime: true } },
      },
    }),
  ]);

  return NextResponse.json({ bookings, requests, intakeSubmissions });
}
