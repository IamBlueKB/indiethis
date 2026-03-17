import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({ where: { ownerId: session.user.id } });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const requests = await db.contactSubmission.findMany({
    where: { studioId: studio.id, source: "BOOKING_REQUEST" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
