import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/brevo/email";
import { sendSMS } from "@/lib/brevo/sms";
import { toE164 } from "@/lib/formatPhone";
import { scoreLead } from "@/lib/agents/lead-scoring";

// GET /api/intake/[token] — fetch intake link details (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const link = await db.intakeLink.findUnique({
    where: { token },
    include: {
      studio: {
        select: {
          name: true, slug: true, logo: true,
          instagram: true, tiktok: true, youtube: true,
          zelleHandle: true, stripePaymentsEnabled: true,
        },
      },
    },
  });

  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  if (new Date() > link.expiresAt) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  if (link.usedAt) {
    return NextResponse.json({ error: "This form has already been submitted." }, { status: 410 });
  }

  return NextResponse.json({
    name:         link.name,
    email:        link.email,
    phone:        link.phone,
    sessionDate:  link.sessionDate,
    sessionTime:  link.sessionTime,
    endTime:      link.endTime,
    hourlyRate:   link.hourlyRate,
    sessionHours: link.sessionHours,
    studioName:   link.studio.name,
    studioLogo:   link.studio.logo,
    expiresAt:    link.expiresAt,
    studio: {
      name: link.studio.name,
      instagram: link.studio.instagram,
      tiktok: link.studio.tiktok,
      youtube: link.studio.youtube,
      zelleHandle: link.studio.zelleHandle,
      stripePaymentsEnabled: link.studio.stripePaymentsEnabled,
    },
  });
}

// POST /api/intake/[token] — submit intake form (public)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const link = await db.intakeLink.findUnique({
    where: { token },
    include: { studio: true },
  });

  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (new Date() > link.expiresAt) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }
  if (link.usedAt) {
    return NextResponse.json({ error: "Already submitted." }, { status: 410 });
  }

  const body = await req.json();
  const {
    firstName, lastName, fullName, artistName, email, phone,
    genre, projectDesc, youtubeLinks, fileUrls, photoUrl, notes,
    instagram, tiktok, youtubeHandle, paymentMethod, depositPaid, depositAmount, aiVideoRequested,
    bpmDetected, keyDetected,
  } = body as {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    artistName: string;
    email?: string;
    phone?: string;
    genre?: string;
    projectDesc?: string;
    youtubeLinks?: string[];
    fileUrls?: string[];
    photoUrl?: string;
    notes?: string;
    instagram?: string;
    tiktok?: string;
    youtubeHandle?: string;
    paymentMethod?: string;
    depositPaid?: boolean;
    depositAmount?: number;
    aiVideoRequested?: boolean;
    bpmDetected?: number;
    keyDetected?: string;
  };

  if (!artistName?.trim()) {
    return NextResponse.json({ error: "Artist name is required." }, { status: 400 });
  }

  // Resolve contact name: prefer firstName+lastName, then fullName, then artistName
  const computedName = firstName?.trim()
    ? `${firstName.trim()} ${lastName?.trim() ?? ""}`.trim()
    : fullName?.trim() || artistName.trim();
  const contactName = computedName;
  // Resolve contact email/phone: form-provided values override link values
  const contactEmail = email?.trim() || link.email || null;
  const contactPhone = phone?.trim() || link.phone || null;

  // Mark link as used
  await db.intakeLink.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  // Upsert contact — create if no contactId on link, update if one exists
  let contactId = link.contactId;

  if (contactId) {
    // Update existing contact with form data
    await db.contact.update({
      where: { id: contactId },
      data: {
        name:            contactName,
        firstName:       firstName?.trim() || undefined,
        lastName:        lastName?.trim() || undefined,
        email:           contactEmail ?? undefined,
        phone:           contactPhone ?? undefined,
        photoUrl:        photoUrl || undefined,
        instagramHandle: instagram?.trim() || undefined,
        genre:           genre?.trim() || undefined,
      },
    });
  } else {
    // Create new contact from intake submission
    const contact = await db.contact.create({
      data: {
        studioId:        link.studioId,
        name:            contactName,
        firstName:       firstName?.trim() || undefined,
        lastName:        lastName?.trim() || undefined,
        email:           contactEmail ?? undefined,
        phone:           contactPhone ?? undefined,
        photoUrl:        photoUrl || undefined,
        instagramHandle: instagram?.trim() || undefined,
        genre:           genre?.trim() || undefined,
        source:          "BOOKING",
      },
    });
    contactId = contact.id;

    // Link the contact back to this intake link
    await db.intakeLink.update({
      where: { token },
      data: { contactId: contact.id },
    });
  }

  const submission = await db.intakeSubmission.create({
    data: {
      intakeLinkId:  link.id,
      studioId:      link.studioId,
      contactId:     contactId ?? null,
      artistName:    artistName.trim(),
      genre:         genre?.trim() || null,
      projectDesc:   projectDesc?.trim() || null,
      youtubeLinks:  youtubeLinks ?? [],
      fileUrls:      fileUrls ?? [],
      photoUrl:      photoUrl || null,
      notes:         notes?.trim() || null,
      instagram:     instagram?.trim() || null,
      tiktok:        tiktok?.trim() || null,
      youtubeHandle: youtubeHandle?.trim() || null,
      paymentMethod: paymentMethod || null,
      depositPaid:       depositPaid === true,
      depositAmount:     depositAmount ? Number(depositAmount) : null,
      aiVideoRequested:  aiVideoRequested === true,
      bpmDetected:       bpmDetected   ? Number(bpmDetected)   : null,
      keyDetected:       keyDetected   || null,
    },
  });

  // Log activity
  if (contactId) {
    await db.activityLog.create({
      data: {
        contactId,
        studioId: link.studioId,
        type: "FORM_SUBMITTED",
        description: `Intake form submitted by ${contactName}${artistName.trim() !== contactName ? ` (${artistName.trim()})` : ""}`,
      },
    });

    // Log AI video upsell separately so it surfaces as its own event in CRM
    if (aiVideoRequested === true) {
      await db.activityLog.create({
        data: {
          contactId,
          studioId: link.studioId,
          type: "AI_VIDEO_REQUESTED",
          description: `AI Music Video requested — photo uploaded ($49)`,
          metadata: { amount: 49, photoUrl: photoUrl || null },
        },
      });
    }
  }

  // Notify studio owner of new intake submission
  const studioOwner = await db.studio.findUnique({
    where: { id: link.studioId },
    select: { ownerId: true, name: true, email: true, phone: true },
  });
  if (studioOwner?.ownerId) {
    void createNotification({
      userId: studioOwner.ownerId,
      type: "INTAKE_SUBMISSION",
      title: "New intake form submitted",
      message: `${contactName}${artistName.trim() !== contactName ? ` (${artistName.trim()})` : ""} submitted an intake form`,
      link: "/studio/inbox",
    }).catch(() => {});

    // Email studio owner
    const ownerUser = await db.user.findUnique({
      where: { id: studioOwner.ownerId },
      select: { email: true, name: true },
    }).catch(() => null);
    const ownerEmail = studioOwner.email || ownerUser?.email;
    if (ownerEmail) {
      const sessionLine = link.sessionDate
        ? `Session: ${new Date(link.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}${link.sessionTime ? ` at ${link.sessionTime}` : ""}`
        : null;
      void sendEmail({
        to: { email: ownerEmail, name: ownerUser?.name ?? studioOwner.name },
        subject: `New intake — ${artistName.trim()} @ ${studioOwner.name}`,
        htmlContent: [
          `<p><strong>${contactName}</strong>${artistName.trim() !== contactName ? ` (${artistName.trim()})` : ""} just submitted an intake form.</p>`,
          contactEmail ? `<p>Email: ${contactEmail}</p>` : "",
          contactPhone ? `<p>Phone: ${contactPhone}</p>` : "",
          genre ? `<p>Genre: ${genre}</p>` : "",
          sessionLine ? `<p>${sessionLine}</p>` : "",
          `<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/studio/inbox">View in your dashboard →</a></p>`,
        ].filter(Boolean).join(""),
      }).catch(() => {});
    }

    // SMS studio owner via studio phone
    const smsPhone = studioOwner.phone;
    if (smsPhone) {
      void sendSMS({
        to: toE164(smsPhone),
        content: `New intake from ${artistName.trim()}. Check your IndieThis dashboard.`,
      }).catch(() => {});
    }
  }

  // Remove the matching booking request so it disappears from the studio's requests list
  if (contactEmail) {
    void db.contactSubmission.deleteMany({
      where: { studioId: link.studioId, email: contactEmail, source: "BOOKING_REQUEST" },
    }).catch(() => {});
  }

  // Auto-create a draft invoice if pricing was set on the intake link and we have a contact
  let createdInvoiceId: string | null = null;
  if (link.hourlyRate && link.sessionHours && contactId) {
    try {
      const totalCost = link.hourlyRate * link.sessionHours;

      const lastInvoice = await db.invoice.findFirst({
        where:   { studioId: link.studioId },
        orderBy: { invoiceNumber: "desc" },
        select:  { invoiceNumber: true },
      });
      const invoiceNumber = (lastInvoice?.invoiceNumber ?? 0) + 1;

      const lineItems = [
        {
          description: `Recording Session — ${link.sessionHours} hr${link.sessionHours !== 1 ? "s" : ""} × $${link.hourlyRate}/hr`,
          quantity:    link.sessionHours,
          rate:        link.hourlyRate,
          total:       totalCost,
        },
      ];

      const notesArr: string[] = [];
      if (link.sessionDate) notesArr.push(`Session date: ${new Date(link.sessionDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`);

      const dueDate = link.sessionDate
        ? new Date(link.sessionDate)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const invoice = await db.invoice.create({
        data: {
          studioId:      link.studioId,
          contactId,
          invoiceNumber,
          lineItems,
          subtotal:      totalCost,
          tax:           0,
          taxRate:       0,
          total:         totalCost,
          dueDate,
          status:        "DRAFT",
          notes:         notesArr.join(" ") || null,
        },
      });
      createdInvoiceId = invoice.id;
    } catch {
      // Don't fail the submission if invoice creation fails
    }
  }

  // If Stripe deposit selected, create checkout session and return URL
  if (paymentMethod === "stripe" && depositAmount && Number(depositAmount) > 0) {
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    try {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3456");
      const studioSlug = link.studio.slug;
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: Math.round(Number(depositAmount) * 100),
              product_data: {
                name: `Session Deposit — ${link.studio.name}`,
                description: link.sessionDate
                  ? `Session on ${new Date(link.sessionDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                  : "Recording Session Deposit",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/${studioSlug}/intake/${token}?depositPaid=stripe`,
        cancel_url:  `${appUrl}/${studioSlug}/intake/${token}`,
        metadata: {
          type: "intake_deposit",
          submissionId: submission.id,
          studioId: link.studioId,
          ...(createdInvoiceId ? { invoiceId: createdInvoiceId } : {}),
        },
      });
      return NextResponse.json({ submission, checkoutUrl: checkoutSession.url }, { status: 201 });
    } catch {
      // Fall through if Stripe fails — still a successful submission
    }
  }

  // Score the lead in background
  void scoreLead(
    "INTAKE",
    submission.id,
    link.email ?? "",
    submission.notes ?? submission.projectDesc ?? "",
    {
      genre:         submission.genre,
      projectDesc:   submission.projectDesc,
      instagram:     submission.instagram,
      tiktok:        submission.tiktok,
      youtubeHandle: submission.youtubeHandle,
    },
    link.studioId,
  ).catch(() => {});

  return NextResponse.json({ submission }, { status: 201 });
}
