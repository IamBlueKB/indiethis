import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/ai — list AI generations for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const generations = await db.aIGeneration.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const subscription = await db.subscription.findUnique({
    where: { userId: session.user.id },
    select: {
      tier: true,
      aiVideoCreditsUsed: true,
      aiVideoCreditsLimit: true,
    },
  });

  return NextResponse.json({ generations, subscription });
}

// POST /api/dashboard/ai — queue a new AI generation
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, inputData } = body;

  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const generation = await db.aIGeneration.create({
    data: {
      artistId: session.user.id,
      type,
      inputData: inputData ?? {},
      status: "QUEUED",
    },
  });

  return NextResponse.json({ generation }, { status: 201 });
}
