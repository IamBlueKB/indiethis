import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ── PATCH — update promo code ─────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { isActive, maxRedemptions, notes, expiresAt, ambassadorId } = body;

  const existing = await db.promoCode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.promoCode.update({
    where: { id },
    data: {
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(maxRedemptions !== undefined ? { maxRedemptions: parseInt(maxRedemptions) } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(ambassadorId !== undefined ? { ambassadorId: ambassadorId || null } : {}),
    },
    include: {
      ambassador: { select: { id: true, name: true } },
      _count: { select: { redemptions: true } },
    },
  });

  return NextResponse.json(updated);
}

// ── DELETE — soft delete (deactivate) ─────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.promoCode.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.promoCode.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
