import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/dashboard/dj/bookings — list inquiries for current DJ
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ inquiries: [] });

  const inquiries = await db.dJBookingInquiry.findMany({
    where: { djProfileId: djProfile.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      eventDate: true,
      venue: true,
      message: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ inquiries });
}
