import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";

const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, phone, sessionType, requestedDate, requestedTime, notes } = body;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const studio = await db.studio.findUnique({
    where: { id: studioId },
    select: { id: true, name: true, email: true, isPublished: true, slug: true, owner: { select: { email: true } } },
  });

  if (!studio || !studio.isPublished) {
    return NextResponse.json({ error: "Studio not found." }, { status: 404 });
  }

  const lines: string[] = [];
  if (sessionType) lines.push(`Session type: ${sessionType}`);
  if (requestedDate) lines.push(`Requested date: ${requestedDate}`);
  if (requestedTime) lines.push(`Requested time: ${requestedTime}`);
  if (notes?.trim()) lines.push(`Notes: ${notes.trim()}`);
  const message = `[BOOKING REQUEST]\n${lines.join("\n")}`;

  await db.contactSubmission.create({
    data: {
      studioId: studio.id,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      message,
      source: "BOOKING_REQUEST",
    },
  });

  // Upsert contact
  const existing = await db.contact.findFirst({
    where: { studioId: studio.id, email: email.trim() },
  });
  if (!existing) {
    await db.contact.create({
      data: {
        studioId: studio.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        source: "INTAKE_FORM",
      },
    }).catch(() => {});
  }

  // Notify studio — use studio email or fall back to owner email
  const notifyEmail = studio.email || studio.owner?.email;
  if (notifyEmail) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0A0A0A;">
        <div style="background: #D4A843; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #0A0A0A; opacity: 0.6;">New Booking Request</p>
          <h1 style="margin: 8px 0 0; font-size: 24px; font-weight: 800; color: #0A0A0A;">Session Request</h1>
        </div>
        <div style="background: #f5f5f5; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #666;">From</p>
          <p style="margin: 0 0 24px; font-size: 18px; font-weight: 700;">${name.trim()}</p>
          <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #666;">Contact</p>
          <p style="margin: 0 0 4px;"><a href="mailto:${email.trim()}" style="color: #D4A843;">${email.trim()}</a></p>
          ${phone?.trim() ? `<p style="margin: 0 0 24px;">${phone.trim()}</p>` : `<p style="margin: 0 0 24px; color: #999;">No phone provided</p>`}
          ${sessionType ? `
          <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #666;">Session Type</p>
          <p style="margin: 0 0 24px; font-weight: 600;">${sessionType}</p>` : ""}
          ${requestedDate || requestedTime ? `
          <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #666;">Requested Time</p>
          <p style="margin: 0 0 24px; font-weight: 600;">${[requestedDate, requestedTime].filter(Boolean).join(" at ")}</p>` : ""}
          ${notes?.trim() ? `
          <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #666;">Notes</p>
          <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; line-height: 1.7; white-space: pre-wrap;">${notes.trim()}</p>
          </div>` : ""}
          <p style="margin: 0 0 16px; font-size: 13px; color: #666; font-style: italic;">
            This is a booking request — not a confirmed session. Contact the artist to check availability and send them an intake form to confirm.
          </p>
          <a href="mailto:${email.trim()}?subject=Re: Your booking request at ${encodeURIComponent(studio.name)}"
            style="display: inline-block; padding: 14px 28px; background: #D4A843; color: #0A0A0A; font-weight: 700; text-decoration: none; border-radius: 8px;">
            Reply to ${name.trim()} →
          </a>
        </div>
        <p style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          Sent via your IndieThis studio page at indiethis.com/${studio.slug}
        </p>
      </div>
    `;
    await sendEmail({
      to: { email: notifyEmail, name: studio.name },
      replyTo: { email: email.trim(), name: name.trim() },
      subject: `Booking request from ${name.trim()} — ${studio.name}`,
      htmlContent: html,
      tags: ["studio-booking-request"],
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
