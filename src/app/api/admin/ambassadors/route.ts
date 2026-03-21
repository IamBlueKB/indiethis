import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { AmbassadorTier, RewardType } from "@prisma/client";

// ── GET — list ambassadors ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search       = searchParams.get("search")?.trim() ?? "";
  const tierFilter   = searchParams.get("tier") ?? "";
  const activeFilter = searchParams.get("active") ?? "";
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit        = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50")));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (tierFilter) where.tier = tierFilter as AmbassadorTier;
  if (activeFilter === "true") where.isActive = true;
  if (activeFilter === "false") where.isActive = false;

  const [total, ambassadors] = await Promise.all([
    db.ambassador.count({ where }),
    db.ambassador.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { promoCodes: true } },
        promoCodes: {
          select: {
            _count: { select: { redemptions: true } },
            redemptions: {
              select: { status: true },
            },
          },
        },
      },
    }),
  ]);

  // Compute per-ambassador redemption + conversion counts
  const ambassadorsWithStats = ambassadors.map((amb) => {
    let totalRedemptions = 0;
    let totalConversions = 0;
    for (const code of amb.promoCodes) {
      totalRedemptions += code._count.redemptions;
      totalConversions += code.redemptions.filter((r) => r.status === "CONVERTED").length;
    }
    const { promoCodes: _pc, ...rest } = amb;
    return { ...rest, totalRedemptions, totalConversions };
  });

  return NextResponse.json({
    ambassadors: ambassadorsWithStats,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}

// ── POST — create ambassador ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name,
    email,
    tier = "STANDARD",
    rewardType = "FLAT_PER_CONVERSION",
    rewardValue = 5.0,
    rewardDurationMonths,
    notes,
    userId,
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!email?.trim()) return NextResponse.json({ error: "email is required" }, { status: 400 });

  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const existing = await db.ambassador.findUnique({ where: { userId } });
    if (existing) return NextResponse.json({ error: "User already has an ambassador record" }, { status: 409 });
  }

  const ambassador = await db.ambassador.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      tier: tier as AmbassadorTier,
      rewardType: rewardType as RewardType,
      rewardValue: parseFloat(rewardValue),
      rewardDurationMonths: rewardDurationMonths ? parseInt(rewardDurationMonths) : null,
      notes: notes?.trim() || null,
      userId: userId || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  // ── Auto-create a linked promo code ─────────────────────────────────────────
  const promoCode = await autoCreatePromoCode(ambassador.id, name.trim());

  return NextResponse.json({ ...ambassador, promoCode }, { status: 201 });
}

// ── Helper: auto-create a promo code for a new ambassador ────────────────────

async function autoCreatePromoCode(ambassadorId: string, name: string) {
  const year = new Date().getFullYear().toString().slice(-2); // "25"
  const base = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4).padEnd(4, "X");

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0
      ? year
      : year + Math.random().toString(36).slice(2, 4).toUpperCase();
    const code = `${base}${suffix}`;

    const exists = await db.promoCode.findUnique({ where: { code } });
    if (exists) continue;

    try {
      return await db.promoCode.create({
        data: {
          code,
          type: "FREE_TRIAL",
          tier: "LAUNCH",
          durationDays: 14,
          maxRedemptions: 1000,
          ambassadorId,
        },
      });
    } catch {
      // Concurrent insert — retry
    }
  }
  return null; // Give up gracefully
}
