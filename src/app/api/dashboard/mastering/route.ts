import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await db.aIGeneration.findMany({
    where: { artistId: session.user.id, type: "MASTERING" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs });
}

// Mastering is now handled by the unified AI job queue at POST /api/dashboard/ai/[toolType].
// This legacy endpoint is no longer active.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Use POST /api/dashboard/ai/mastering for mastering jobs." },
    { status: 410 }
  );
}
