import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;

  const body = await req.json().catch(() => ({}));
  const { name, email, phone, message, website } = body;

  // 1. Validate fields
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  const trimmedMessage = message?.trim() ?? "";
  if (trimmedMessage.length < 10 || trimmedMessage.length > 1000) {
    return NextResponse.json(
      { error: "Message must be between 10 and 1000 characters." },
      { status: 400 }
    );
  }

  // 2. Honeypot — bots fill the hidden `website` field; return 200 silently
  if (website) {
    return NextResponse.json({ success: true });
  }

  // 3. Rate limit: max 3 submissions per email per studio per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await db.contactSubmission.count({
    where: {
      studioId,
      email: email.trim().toLowerCase(),
      createdAt: { gte: oneHourAgo },
    },
  });
  if (recentCount >= 3) {
    return NextResponse.json(
      { error: "Too many messages. Please try again later." },
      { status: 429 }
    );
  }

  // Verify studio exists and is published
  const studio = await db.studio.findUnique({
    where: { id: studioId },
    select: {
      id: true,
      name: true,
      slug: true,
      isPublished: true,
      owner: { select: { email: true } },
    },
  });
  if (!studio || !studio.isPublished) {
    return NextResponse.json({ error: "Studio not found." }, { status: 404 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const trimmedPhone = phone?.trim() || null;

  // 4. Create ContactSubmission record
  await db.contactSubmission.create({
    data: {
      studioId: studio.id,
      name: trimmedName,
      email: normalizedEmail,
      phone: trimmedPhone,
      message: trimmedMessage,
      source: "PUBLIC_PAGE",
    },
  });

  // 5. Check if Contact exists for this email + studio
  const existing = await db.contact.findFirst({
    where: { studioId: studio.id, email: normalizedEmail },
  });

  if (existing) {
    // Add WEBSITE_INQUIRY activity log (FORM_SUBMITTED is the closest enum value)
    await db.activityLog.create({
      data: {
        contactId: existing.id,
        studioId: studio.id,
        type: "FORM_SUBMITTED",
        description: `Website inquiry from ${trimmedName}`,
        metadata: { message: trimmedMessage, phone: trimmedPhone },
      },
    }).catch(() => {});
  } else {
    // Create new Contact with source INQUIRY (came through public studio page contact form)
    const newContact = await db.contact.create({
      data: {
        studioId: studio.id,
        name: trimmedName,
        email: normalizedEmail,
        phone: trimmedPhone,
        source: "INQUIRY",
      },
    }).catch(() => null);

    if (newContact) {
      await db.activityLog.create({
        data: {
          contactId: newContact.id,
          studioId: studio.id,
          type: "FORM_SUBMITTED",
          description: `First website inquiry from ${trimmedName}`,
          metadata: { message: trimmedMessage },
        },
      }).catch(() => {});
    }
  }

  // 6. Send email to studio owner via Brevo
  const ownerEmail = studio.owner?.email;
  if (ownerEmail) {
    const phoneLine = trimmedPhone
      ? `<p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#666">Phone</p>
         <p style="margin:0 0 24px">${trimmedPhone}</p>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0A0A0A">
        <div style="background:#D4A843;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:#0A0A0A;opacity:.6">New Contact</p>
          <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#0A0A0A">Website Inquiry</h1>
        </div>
        <div style="background:#f5f5f5;padding:32px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#666">From</p>
          <p style="margin:0 0 24px;font-size:18px;font-weight:700">${trimmedName}</p>
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#666">Email</p>
          <p style="margin:0 0 24px"><a href="mailto:${normalizedEmail}" style="color:#D4A843">${normalizedEmail}</a></p>
          ${phoneLine}
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#666">Message</p>
          <div style="background:#fff;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="margin:0;line-height:1.7;white-space:pre-wrap">${trimmedMessage}</p>
          </div>
          <a href="mailto:${normalizedEmail}?subject=Re: Your inquiry to ${encodeURIComponent(studio.name)}"
             style="display:inline-block;padding:14px 28px;background:#D4A843;color:#0A0A0A;font-weight:700;text-decoration:none;border-radius:8px">
            Reply to ${trimmedName} →
          </a>
        </div>
        <p style="text-align:center;margin-top:20px;font-size:12px;color:#999">
          Sent via your IndieThis studio page at indiethis.com/${studio.slug}
        </p>
      </div>
    `;

    await sendEmail({
      to: { email: ownerEmail },
      replyTo: { email: normalizedEmail, name: trimmedName },
      subject: `New inquiry from ${trimmedName} — IndieThis`,
      htmlContent: html,
      tags: ["studio-contact-form"],
    }).catch(() => {}); // fire-and-forget
  }

  // 7. Return success
  return NextResponse.json({ success: true });
}
