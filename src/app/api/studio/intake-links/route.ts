import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendIntakeLinkEmail } from "@/lib/brevo/email";
import { sendIntakeLinkSMS } from "@/lib/brevo/sms";
import { toE164 } from "@/lib/formatPhone";

// POST /api/studio/intake-links — generate a new intake form link
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
  const { name, email, phone, contactId, sessionDate, sessionTime, endTime, hourlyRate, sessionHours } = body as {
    name?: string;
    email?: string;
    phone?: string;
    contactId?: string;
    sessionDate?: string;
    sessionTime?: string;
    endTime?: string;
    hourlyRate?: number;
    sessionHours?: number;
  };

  // At least one contact method is required
  if (!name?.trim() && !email?.trim() && !phone?.trim()) {
    return NextResponse.json({ error: "Provide a name, email, or phone number." }, { status: 400 });
  }

  // Server-side: reject past session date/time
  if (sessionDate && sessionTime) {
    if (new Date(`${sessionDate}T${sessionTime}`) < new Date()) {
      return NextResponse.json({ error: "Session date and time cannot be in the past." }, { status: 400 });
    }
  }

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  // Create contact if not provided
  let resolvedContactId = contactId;
  if (!resolvedContactId && (name?.trim() || email?.trim())) {
    const contact = await db.contact.create({
      data: {
        studioId: studio.id,
        name: name?.trim() || email?.trim() || "Unknown",
        email: email?.toLowerCase().trim() || null,
        phone: phone?.trim() || null,
        source: "INTAKE_FORM",
      },
    });
    resolvedContactId = contact.id;
  }

  const link = await db.intakeLink.create({
    data: {
      studioId: studio.id,
      contactId: resolvedContactId ?? null,
      token,
      name: name?.trim() ?? null,
      email: email?.toLowerCase().trim() ?? null,
      phone: phone?.trim() ?? null,
      sessionDate:  sessionDate ? new Date(sessionDate) : null,
      sessionTime:  sessionTime ?? null,
      endTime:      endTime ?? null,
      hourlyRate:   hourlyRate   ? Number(hourlyRate)   : null,
      sessionHours: sessionHours ? Number(sessionHours) : null,
      expiresAt,
    },
  });

  // Log activity
  if (resolvedContactId) {
    await db.activityLog.create({
      data: {
        contactId: resolvedContactId,
        studioId: studio.id,
        type: "BOOKING_LINK_SENT",
        description: `Intake form link sent${email ? ` to ${email}` : phone ? ` to ${phone}` : ""}`,
      },
    }).catch(() => {});
  }

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const intakeUrl = `${appUrl}/${studio.slug}/intake/${token}`;

  // Send intake link via email and/or SMS — don't fail the request if delivery fails
  if (email?.trim()) {
    await sendIntakeLinkEmail({
      email:        email.trim(),
      name:         name?.trim() ?? "Artist",
      studioName:   studio.name,
      intakeUrl,
      sessionDate:  link.sessionDate?.toISOString() ?? null,
      sessionTime:  link.sessionTime ?? null,
      endTime:      link.endTime ?? null,
      hourlyRate:   link.hourlyRate ?? null,
      sessionHours: link.sessionHours ?? null,
    }).catch(() => {});
  }
  if (phone?.trim()) {
    sendIntakeLinkSMS({
      phone: toE164(phone.trim()),
      name: name?.trim() ?? "Artist",
      studioName: studio.name,
      intakeUrl,
    }).catch(() => {});
  }

  return NextResponse.json({ link, intakeUrl }, { status: 201 });
}

// GET /api/studio/intake-links — list recent links
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

  const links = await db.intakeLink.findMany({
    where: { studioId: studio.id },
    include: { submission: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ links });
}
