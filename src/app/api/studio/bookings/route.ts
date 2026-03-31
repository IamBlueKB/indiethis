import { NextRequest, NextResponse } from "next/server";
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
      where: { studioId: studio.id },
      orderBy: { createdAt: "desc" },
      take: 100,
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
        photoUrl: true,
        bpmDetected: true,
        keyDetected: true,
        status: true,
        leadScore: true,
        createdAt: true,
        contact: { select: { name: true, email: true, phone: true } },
        intakeLink: { select: { sessionDate: true, sessionTime: true, endTime: true, hourlyRate: true, sessionHours: true } },
      },
    }),
  ]);

  return NextResponse.json({ bookings, requests, intakeSubmissions });
}

// POST /api/studio/bookings — create a walk-in / manual booking
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({ where: { ownerId: session.user.id } });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json() as {
    contactId?: string;
    name?: string;
    email?: string;
    phone?: string;
    dateTime: string;
    duration?: number;
    sessionType?: string;
    notes?: string;
  };

  if (!body.dateTime) {
    return NextResponse.json({ error: "Date and time are required." }, { status: 400 });
  }

  // Resolve or create contact
  let contactId = body.contactId;
  if (!contactId) {
    if (!body.name?.trim() && !body.email?.trim() && !body.phone?.trim()) {
      return NextResponse.json({ error: "Provide a contact or name/email/phone." }, { status: 400 });
    }
    const contact = await db.contact.create({
      data: {
        studioId: studio.id,
        name: body.name?.trim() || body.email?.trim() || "Walk-in",
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        source: "BOOKING",
      },
    });
    contactId = contact.id;
  }

  const booking = await db.bookingSession.create({
    data: {
      studioId:    studio.id,
      artistId:    null,
      contactId,
      dateTime:    new Date(body.dateTime),
      duration:    body.duration ?? null,
      sessionType: body.sessionType?.trim() || null,
      notes:       body.notes?.trim() || null,
      status:      "PENDING",
    },
    include: {
      artist:  { select: { name: true, email: true } },
      contact: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ booking }, { status: 201 });
}
