import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/brevo/email";

const INQUIRY_TYPES = ["Booking", "Feature", "Press", "Management", "Other"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  try {
    const { artistSlug } = await params;
    const body = await req.json() as {
      name:        string;
      email:       string;
      inquiryType: string;
      message:     string;
    };

    const { name, email, inquiryType, message } = body;

    // Validate
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }
    if (!INQUIRY_TYPES.includes(inquiryType as typeof INQUIRY_TYPES[number])) {
      return NextResponse.json({ error: "Invalid inquiry type." }, { status: 400 });
    }
    if (!message?.trim() || message.trim().length < 10) {
      return NextResponse.json({ error: "Please include a message (min 10 chars)." }, { status: 400 });
    }

    // Look up artist
    const artist = await db.user.findUnique({
      where:  { artistSlug },
      select: {
        id:         true,
        name:       true,
        artistName: true,
        email:      true,
        artistSite: { select: { isPublished: true } },
      },
    });

    if (!artist || !artist.artistSite?.isPublished) {
      return NextResponse.json({ error: "Artist not found." }, { status: 404 });
    }

    const displayName = artist.artistName || artist.name;

    // Store inquiry
    await db.artistBookingInquiry.create({
      data: {
        artistId:    artist.id,
        name:        name.trim(),
        email:       email.toLowerCase().trim(),
        inquiryType,
        message:     message.trim(),
      },
    });

    // Email the artist (best-effort — don't fail if email fails)
    if (artist.email) {
      try {
        const htmlContent = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111;background:#fff">
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
    <tr>
      <td style="width:40px;height:40px;background:#D4A843;border-radius:8px;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#0A0A0A">
        ${(displayName?.[0] ?? "A").toUpperCase()}
      </td>
      <td style="padding-left:12px;vertical-align:middle">
        <div style="font-size:14px;font-weight:700;color:#111">New Booking Inquiry</div>
        <div style="font-size:11px;color:#888">via IndieThis</div>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 8px;font-size:14px;color:#111"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
  <p style="margin:0 0 8px;font-size:14px;color:#111"><strong>Type:</strong> ${inquiryType}</p>
  <p style="margin:0 0 20px;font-size:14px;color:#111"><strong>Message:</strong></p>
  <div style="background:#f5f5f5;border-radius:8px;padding:16px;font-size:14px;color:#333;line-height:1.6;margin-bottom:24px">
    ${message.trim().replace(/\n/g, "<br/>")}
  </div>

  <a href="mailto:${email}?subject=Re: Your ${inquiryType} Inquiry" style="display:inline-block;background:#E85D4A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600">
    Reply to ${name}
  </a>

  <hr style="margin:32px 0 16px;border:none;border-top:1px solid #eee"/>
  <p style="margin:0;font-size:11px;color:#aaa;line-height:1.5">
    This inquiry was submitted via your IndieThis artist page.
  </p>
</body>
</html>`;

        await sendEmail({
          to:      { email: artist.email, name: displayName ?? undefined },
          subject: `New ${inquiryType} inquiry from ${name}`,
          htmlContent,
          replyTo: { email: email.toLowerCase().trim(), name: name.trim() },
          tags:    ["booking-inquiry"],
        });
      } catch (emailErr) {
        console.error("[booking-inquiry] email send failed:", emailErr);
        // Don't fail the request — inquiry is stored
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[booking-inquiry]", err);
    return NextResponse.json({ error: "Failed to submit." }, { status: 500 });
  }
}
