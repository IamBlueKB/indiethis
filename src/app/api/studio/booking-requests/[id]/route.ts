import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const studio = await db.studio.findFirst({ where: { ownerId: session.user.id } });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  await db.contactSubmission.deleteMany({
    where: { id, studioId: studio.id, source: "BOOKING_REQUEST" },
  });

  return NextResponse.json({ ok: true });
}
