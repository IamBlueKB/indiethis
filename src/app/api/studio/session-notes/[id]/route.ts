import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

/**
 * PATCH /api/studio/session-notes/[id]
 * Update note title, body, status, isShared, or add/remove attachments.
 * Sharing a note for the first time triggers an artist notification.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "No studio found" }, { status: 404 });
  }

  const existing = await db.sessionNote.findFirst({
    where: { id, studioId: studio.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const body = await req.json() as {
    title?: string;
    body?: string;
    isShared?: boolean;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  };

  const wasShared = existing.isShared;
  const nowSharing = body.isShared === true && !wasShared;

  const updated = await db.sessionNote.update({
    where: { id },
    data: {
      ...(body.title !== undefined  && { title: body.title.trim()  }),
      ...(body.body !== undefined   && { body: body.body.trim()    }),
      ...(body.isShared !== undefined && { isShared: body.isShared }),
      ...(body.status !== undefined && { status: body.status      }),
    },
    include: { attachments: true },
  });

  // Notify artist the first time the note is shared
  if (nowSharing) {
    await createNotification({
      userId: existing.artistId,
      type: "SESSION_NOTE_ADDED",
      title: "Session notes from your studio",
      message: `New session notes available: "${updated.title}"`,
      link: "/dashboard/sessions",
    }).catch(console.error);
  }

  return NextResponse.json({ note: updated });
}

/**
 * DELETE /api/studio/session-notes/[id]
 * Delete a session note (studio admin only, must own the note).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) {
    return NextResponse.json({ error: "No studio found" }, { status: 404 });
  }

  const existing = await db.sessionNote.findFirst({
    where: { id, studioId: studio.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await db.sessionNote.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
