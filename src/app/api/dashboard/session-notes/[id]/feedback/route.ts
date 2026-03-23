import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendArtistSessionFeedbackEmail } from "@/lib/brevo/email";

/**
 * POST /api/dashboard/session-notes/[id]/feedback
 * Artist submits feedback on a shared session note.
 * Body: { feedback: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const note = await db.sessionNote.findFirst({
    where: { id, artistId: session.user.id, isShared: true },
    include: {
      studio: { select: { id: true, name: true, ownerId: true } },
    },
  });

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const body = await req.json() as { feedback: string };

  if (!body.feedback?.trim()) {
    return NextResponse.json({ error: "feedback is required" }, { status: 400 });
  }

  const updated = await db.sessionNote.update({
    where: { id },
    data: {
      artistFeedback: body.feedback.trim(),
      feedbackAt: new Date(),
    },
    include: { attachments: true },
  });

  // Notify studio owner about artist feedback
  await createNotification({
    userId: note.studio.ownerId,
    type: "ARTIST_SESSION_FEEDBACK",
    title: "Artist left feedback on session notes",
    message: `Feedback on "${note.title}": "${body.feedback.trim().slice(0, 80)}${body.feedback.trim().length > 80 ? "…" : ""}"`,
    link: "/studio/bookings",
  }).catch(console.error);

  // Send email to studio owner
  const studioOwner = await db.user.findUnique({
    where: { id: note.studio.ownerId },
    select: { email: true, name: true },
  });
  const artist = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });
  if (studioOwner?.email) {
    sendArtistSessionFeedbackEmail({
      studioEmail: studioOwner.email,
      studioName: note.studio.name,
      artistName: artist?.name ?? "Artist",
      noteTitle: note.title,
      feedback: body.feedback.trim(),
      bookingsUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/studio/bookings`,
    }).catch(console.error);
  }

  return NextResponse.json({ note: updated });
}
