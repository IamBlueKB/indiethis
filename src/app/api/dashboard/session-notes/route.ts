import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/session-notes?sessionId=...
 * Returns session notes shared with the artist for a given bookingSessionId.
 * Optionally omit sessionId to get all shared notes across all sessions.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");

  const notes = await db.sessionNote.findMany({
    where: {
      artistId: session.user.id,
      isShared: true,
      ...(sessionId ? { bookingSessionId: sessionId } : {}),
    },
    include: {
      attachments: true,
      studio: { select: { id: true, name: true, logo: true } },
      bookingSession: {
        select: {
          id: true,
          dateTime: true,
          sessionType: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}
