import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";
import { scoreLead } from "@/lib/agents/lead-scoring";

// POST /api/dj/[djSlug]/book — public, creates DJBookingInquiry record
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ djSlug: string }> }
) {
  const { djSlug } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { slug: djSlug },
    select: { id: true, userId: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ not found" }, { status: 404 });

  const body = await req.json() as {
    name?: string;
    email?: string;
    phone?: string;
    eventDate?: string;
    venue?: string;
    message?: string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.email?.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  if (!body.message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const inquiry = await db.dJBookingInquiry.create({
    data: {
      djProfileId: djProfile.id,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim() || null,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      venue: body.venue?.trim() || null,
      message: body.message.trim(),
    },
  });

  // Notify the DJ
  void createNotification({
    userId: djProfile.userId,
    type: "DJ_BOOKING_INQUIRY",
    title: "New booking inquiry",
    message: `${body.name.trim()} sent a booking inquiry.`,
    link: "/dashboard/dj/bookings",
  }).catch(() => {});

  // Score the lead in background — don't block response
  void scoreLead(
    "DJ_BOOKING",
    inquiry.id,
    body.email!.trim(),
    body.message!.trim(),
    {
      phone:     body.phone?.trim() || null,
      venue:     body.venue?.trim() || null,
      eventDate: body.eventDate || null,
    },
  ).catch(() => {});

  return NextResponse.json({ success: true, id: inquiry.id });
}
