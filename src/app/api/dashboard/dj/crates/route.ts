import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Crate limits per tier
const CRATE_LIMITS: Record<string, number> = {
  LAUNCH: 5,
  PUSH: 15,
  REIGN: 0, // unlimited
};

// GET /api/dashboard/dj/crates — list crates for current user's DJ profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const [djProfile, subscription, userFlags] = await Promise.all([
    db.dJProfile.findUnique({ where: { userId }, select: { id: true } }),
    db.subscription.findUnique({ where: { userId }, select: { tier: true } }),
    db.user.findUnique({ where: { id: userId }, select: { djMode: true } }),
  ]);

  if (!djProfile || !userFlags?.djMode) {
    return NextResponse.json({ crates: [], tier: subscription?.tier ?? "LAUNCH" });
  }

  const crates = await db.crate.findMany({
    where: { djProfileId: djProfile.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      coverArtUrl: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({ crates, tier: subscription?.tier ?? "LAUNCH" });
}

// POST /api/dashboard/dj/crates — create crate
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found. Enable DJ Mode first." }, { status: 400 });

  // Check tier limit
  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { tier: true },
  });

  const tier = subscription?.tier ?? "LAUNCH";
  const limit = CRATE_LIMITS[tier] ?? 5;

  if (limit > 0) {
    const count = await db.crate.count({ where: { djProfileId: djProfile.id } });
    if (count >= limit) {
      return NextResponse.json({
        error: `Crate limit reached (${limit} on your plan). Upgrade to create more.`,
        limit,
        count,
      }, { status: 403 });
    }
  }

  const body = await req.json() as { name?: string; description?: string; isPublic?: boolean };
  if (!body.name?.trim()) return NextResponse.json({ error: "Crate name is required" }, { status: 400 });

  const crate = await db.crate.create({
    data: {
      djProfileId: djProfile.id,
      name: body.name.trim(),
      description: body.description ?? null,
      isPublic: body.isPublic ?? true,
    },
  });

  return NextResponse.json({ crate });
}
