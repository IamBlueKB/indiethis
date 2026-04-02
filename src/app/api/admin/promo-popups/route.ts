import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ── GET — list all promo popups ───────────────────────────────────────────────
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const popups = await db.promoPopup.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ popups });
}

// ── POST — create a promo popup ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    startDate?: string;
    endDate?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json({ error: "pages must be a non-empty array" }, { status: 400 });
  }

  const popup = await db.promoPopup.create({
    data: {
      title:           body.title.trim(),
      subtitle:        body.subtitle?.trim() || null,
      ctaText:         body.ctaText?.trim()  || null,
      ctaUrl:          body.ctaUrl?.trim()   || null,
      imageUrl:        body.imageUrl         || null,
      backgroundColor: body.backgroundColor  || null,
      pages:           body.pages,
      priority:        body.priority         ?? 0,
      frequency:       body.frequency        ?? "ONCE_PER_SESSION",
      trigger:         body.trigger          ?? "ON_LOAD",
      triggerDelay:    body.triggerDelay      ?? null,
      active:          body.active           ?? false,
      startDate:       body.startDate ? new Date(body.startDate) : null,
      endDate:         body.endDate   ? new Date(body.endDate)   : null,
    },
  });

  return NextResponse.json(popup, { status: 201 });
}
