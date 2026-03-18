import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/studio/generation-log/latest
// Returns the most recent GenerationLog for the current studio owner.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ log: null });

  const log = await db.generationLog.findFirst({
    where: { studioId: studio.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, configSnapshot: true, createdAt: true },
  });

  return NextResponse.json({ log });
}
