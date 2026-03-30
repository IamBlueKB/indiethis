import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["PENDING", "RESPONDED", "BOOKED", "DECLINED"];

// PATCH /api/dashboard/dj/bookings/[id] — update inquiry status
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

  const existing = await db.dJBookingInquiry.findUnique({
    where: { id },
    select: { djProfileId: true },
  });

  if (!existing || existing.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as { status?: string };

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status. Must be one of: " + VALID_STATUSES.join(", ") }, { status: 400 });
  }

  const inquiry = await db.dJBookingInquiry.update({
    where: { id },
    data: { status: body.status },
  });

  return NextResponse.json({ inquiry });
}
