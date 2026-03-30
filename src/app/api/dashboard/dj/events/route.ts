import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/dashboard/dj/events — list events for current user's DJ profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ events: [] });

  const events = await db.dJEvent.findMany({
    where: { djProfileId: djProfile.id },
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      venue: true,
      city: true,
      date: true,
      time: true,
      ticketUrl: true,
      description: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}

// POST /api/dashboard/dj/events — create event
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found. Enable DJ Mode first." }, { status: 400 });

  const body = await req.json() as {
    name?: string;
    venue?: string;
    city?: string;
    date?: string;
    time?: string;
    ticketUrl?: string;
    description?: string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: "Event name is required" }, { status: 400 });
  if (!body.venue?.trim()) return NextResponse.json({ error: "Venue is required" }, { status: 400 });
  if (!body.city?.trim()) return NextResponse.json({ error: "City is required" }, { status: 400 });
  if (!body.date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  const event = await db.dJEvent.create({
    data: {
      djProfileId: djProfile.id,
      name: body.name.trim(),
      venue: body.venue.trim(),
      city: body.city.trim(),
      date: new Date(body.date),
      time: body.time?.trim() || null,
      ticketUrl: body.ticketUrl?.trim() || null,
      description: body.description?.trim() || null,
    },
  });

  return NextResponse.json({ event });
}
