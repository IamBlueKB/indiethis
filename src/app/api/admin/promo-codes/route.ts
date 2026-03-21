import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { PromoCodeType, SubscriptionTier } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/I/1
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── GET — list promo codes ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search       = searchParams.get("search")?.trim() ?? "";
  const type         = searchParams.get("type") ?? "";
  const statusFilter = searchParams.get("status") ?? "";       // "active" | "inactive"
  const ambassadorId = searchParams.get("ambassadorId") ?? "";
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit        = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50")));

  const where: Parameters<typeof db.promoCode.findMany>[0]["where"] = {};

  if (search) {
    where.code = { contains: search, mode: "insensitive" };
  }
  if (type) {
    where.type = type as PromoCodeType;
  }
  if (statusFilter === "active") {
    where.isActive = true;
  } else if (statusFilter === "inactive") {
    where.isActive = false;
  }
  if (ambassadorId) {
    where.ambassadorId = ambassadorId;
  }

  const [total, codes] = await Promise.all([
    db.promoCode.count({ where }),
    db.promoCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        ambassador: { select: { id: true, name: true, email: true } },
        _count: { select: { redemptions: true } },
      },
    }),
  ]);

  // Attach conversion counts
  const codeIds = codes.map((c) => c.id);
  const conversions = await db.promoRedemption.groupBy({
    by: ["promoCodeId"],
    where: { promoCodeId: { in: codeIds }, status: "CONVERTED" },
    _count: { id: true },
  });
  const convMap = Object.fromEntries(conversions.map((c) => [c.promoCodeId, c._count.id]));

  const result = codes.map((c) => ({
    ...c,
    conversionCount: convMap[c.id] ?? 0,
  }));

  return NextResponse.json({ codes: result, total, pages: Math.ceil(total / limit), page });
}

// ── POST — create promo code ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    code: rawCode,
    type,
    tier,
    value,
    durationDays,
    durationMonths,
    maxRedemptions = 1,
    expiresAt,
    notes,
    metadata,
    ambassadorId,
  } = body;

  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  // Type-specific validation
  if (type === "FREE_TRIAL" && (!durationDays || !tier)) {
    return NextResponse.json({ error: "FREE_TRIAL requires durationDays and tier" }, { status: 400 });
  }
  if (type === "DISCOUNT" && (!value || !durationMonths)) {
    return NextResponse.json({ error: "DISCOUNT requires value (percent) and durationMonths" }, { status: 400 });
  }
  if (type === "COMP" && !tier) {
    return NextResponse.json({ error: "COMP requires tier" }, { status: 400 });
  }
  if (type === "CREDIT" && !value) {
    return NextResponse.json({ error: "CREDIT requires value (dollar amount)" }, { status: 400 });
  }
  if (type === "AI_BUNDLE" && !metadata) {
    return NextResponse.json({ error: "AI_BUNDLE requires metadata (per-tool breakdown)" }, { status: 400 });
  }

  // Generate or validate code
  let code = rawCode ? String(rawCode).toUpperCase().trim() : generateCode();

  // Ensure uniqueness (retry up to 5 times)
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.promoCode.findUnique({ where: { code } });
    if (!existing) break;
    if (rawCode) {
      return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    }
    code = generateCode();
    attempts++;
  }

  if (ambassadorId) {
    const amb = await db.ambassador.findUnique({ where: { id: ambassadorId } });
    if (!amb) return NextResponse.json({ error: "Ambassador not found" }, { status: 404 });
  }

  const created = await db.promoCode.create({
    data: {
      code,
      type: type as PromoCodeType,
      tier: tier as SubscriptionTier | undefined,
      value: value ? parseFloat(value) : null,
      durationDays: durationDays ? parseInt(durationDays) : null,
      durationMonths: durationMonths ? parseInt(durationMonths) : null,
      maxRedemptions: parseInt(maxRedemptions),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes: notes?.trim() || null,
      metadata: metadata ?? null,
      ambassadorId: ambassadorId || null,
    },
    include: {
      ambassador: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(created, { status: 201 });
}
