import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({ where: { ownerId: session.user.id }, select: { id: true } });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const existing = await db.intakeSubmission.findFirst({ where: { id, studioId: studio.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.intakeSubmission.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
