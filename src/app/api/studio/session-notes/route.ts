import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSessionNoteEmail } from "@/lib/brevo/email";

/**
 * GET /api/studio/session-notes?sessionId=...
 * Returns all session notes for a given bookingSessionId.
 * Requires STUDIO_ADMIN role and ownership.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Verify this session belongs to the studio admin's studio
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "No studio found" }, { status: 404 });
  }

  const booking = await db.bookingSession.findFirst({
    where: { id: sessionId, studioId: studio.id },
    select: { id: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const notes = await db.sessionNote.findMany({
    where: { bookingSessionId: sessionId, studioId: studio.id },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}

/**
 * POST /api/studio/session-notes
 * Create a new session note. If isShared=true, notifies the artist.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    bookingSessionId: string;
    title: string;
    body: string;
    isShared?: boolean;
    attachments?: { fileUrl: string; fileName: string; fileSize?: number }[];
  };

  if (!body.bookingSessionId || !body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "bookingSessionId, title, and body are required" }, { status: 400 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "No studio found" }, { status: 404 });
  }

  const booking = await db.bookingSession.findFirst({
    where: { id: body.bookingSessionId, studioId: studio.id },
    select: { id: true, artistId: true, dateTime: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const note = await db.sessionNote.create({
    data: {
      bookingSessionId: body.bookingSessionId,
      studioId: studio.id,
      artistId: booking.artistId,
      title: body.title.trim(),
      body: body.body.trim(),
      status: "PUBLISHED",
      isShared: body.isShared ?? false,
      attachments: body.attachments?.length
        ? {
            create: body.attachments.map((a) => ({
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              fileSize: a.fileSize ?? null,
            })),
          }
        : undefined,
    },
    include: { attachments: true },
  });

  // Notify artist if note is shared
  if (note.isShared) {
    const artist = await db.user.findUnique({
      where: { id: booking.artistId },
      select: { email: true, name: true },
    });

    await createNotification({
      userId: booking.artistId,
      type: "SESSION_NOTE_ADDED",
      title: "Session notes from your studio",
      message: `${studio.name} added notes: "${note.title}"`,
      link: "/dashboard/sessions",
    }).catch(console.error);

    if (artist?.email) {
      const sessionDate = new Date(booking.dateTime).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });
      sendSessionNoteEmail({
        artistEmail: artist.email,
        artistName: artist.name ?? "Artist",
        studioName: studio.name,
        noteTitle: note.title,
        sessionDate,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com"}/dashboard/sessions`,
      }).catch(console.error);
    }
  }

  return NextResponse.json({ note }, { status: 201 });
}
