import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

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
          cashAppHandle: true, zelleHandle: true, paypalHandle: true, venmoHandle: true,
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
    name: link.name,
    email: link.email,
    phone: link.phone,
    sessionDate: link.sessionDate,
    sessionTime: link.sessionTime,
    endTime: link.endTime,
    studioName: link.studio.name,
    studioLogo: link.studio.logo,
    expiresAt: link.expiresAt,
    studio: {
      name: link.studio.name,
      instagram: link.studio.instagram,
      tiktok: link.studio.tiktok,
      youtube: link.studio.youtube,
      cashAppHandle: link.studio.cashAppHandle,
      zelleHandle: link.studio.zelleHandle,
      paypalHandle: link.studio.paypalHandle,
      venmoHandle: link.studio.venmoHandle,
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
    select: { ownerId: true, name: true },
  });
  if (studioOwner?.ownerId) {
    void createNotification({
      userId: studioOwner.ownerId,
      type: "INTAKE_SUBMISSION",
      title: "New intake form submitted",
      message: `${contactName}${artistName.trim() !== contactName ? ` (${artistName.trim()})` : ""} submitted an intake form`,
      link: "/studio/inbox",
    }).catch(() => {});
  }

  // Remove the matching booking request so it disappears from the studio's requests list
  if (contactEmail) {
    void db.contactSubmission.deleteMany({
      where: { studioId: link.studioId, email: contactEmail, source: "BOOKING_REQUEST" },
    }).catch(() => {});
  }

  // Analyze all submitted audio files after response is sent
  const submissionId = submission.id;
  const uploadedUrls: string[] = fileUrls ?? [];
  if (uploadedUrls.length > 0) {
    after(async () => {
      try {
        const { detectAudioFeaturesFromUrls } = await import("@/lib/audio-analysis");
        const { bpm, musicalKey } = await detectAudioFeaturesFromUrls(uploadedUrls);
        if (bpm !== null || musicalKey !== null) {
          await db.intakeSubmission.update({
            where: { id: submissionId },
            data: {
              ...(bpm        !== null && { bpmDetected: bpm }),
              ...(musicalKey !== null && { keyDetected: musicalKey }),
            },
          });
        }
      } catch { /* silent */ }
    });
  }

  return NextResponse.json({ submission }, { status: 201 });
}
