import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/dashboard/dj/events/[id] — update event
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const existing = await db.dJEvent.findUnique({ where: { id }, select: { djProfileId: true } });
  if (!existing || existing.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    name?: string;
    venue?: string;
    city?: string;
    date?: string;
    time?: string;
    ticketUrl?: string;
    description?: string;
  };

  const event = await db.dJEvent.update({
    where: { id },
    data: {
      ...(body.name?.trim() && { name: body.name.trim() }),
      ...(body.venue?.trim() && { venue: body.venue.trim() }),
      ...(body.city?.trim() && { city: body.city.trim() }),
      ...(body.date && { date: new Date(body.date) }),
      time: body.time?.trim() || null,
      ticketUrl: body.ticketUrl?.trim() || null,
      description: body.description?.trim() || null,
    },
  });

  return NextResponse.json({ event });
}

// DELETE /api/dashboard/dj/events/[id] — delete event (must own)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const existing = await db.dJEvent.findUnique({ where: { id }, select: { djProfileId: true } });
  if (!existing || existing.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.dJEvent.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
