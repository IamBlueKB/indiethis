import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ── PATCH — update a promo popup ──────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.promoPopup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaUrl?: string;
    imageUrl?: string;
    backgroundColor?: string;
    pages?: string[];
    priority?: number;
    frequency?: string;
    trigger?: string;
    triggerDelay?: number;
    active?: boolean;
    startDate?: string | null;
    endDate?: string | null;
  };

  const updated = await db.promoPopup.update({
    where: { id },
    data: {
      ...(body.title           !== undefined && { title:           body.title.trim() }),
      ...(body.subtitle        !== undefined && { subtitle:        body.subtitle?.trim() || null }),
      ...(body.ctaText         !== undefined && { ctaText:         body.ctaText?.trim()  || null }),
      ...(body.ctaUrl          !== undefined && { ctaUrl:          body.ctaUrl?.trim()   || null }),
      ...(body.imageUrl        !== undefined && { imageUrl:        body.imageUrl         || null }),
      ...(body.backgroundColor !== undefined && { backgroundColor: body.backgroundColor  || null }),
      ...(body.pages           !== undefined && { pages:           body.pages }),
      ...(body.priority        !== undefined && { priority:        body.priority }),
      ...(body.frequency       !== undefined && { frequency:       body.frequency }),
      ...(body.trigger         !== undefined && { trigger:         body.trigger }),
      ...(body.triggerDelay    !== undefined && { triggerDelay:    body.triggerDelay }),
      ...(body.active          !== undefined && { active:          body.active }),
      ...(body.startDate       !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate         !== undefined && { endDate:   body.endDate   ? new Date(body.endDate)   : null }),
    },
  });

  return NextResponse.json(updated);
}

// ── DELETE — remove a promo popup ─────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.promoPopup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.promoPopup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
