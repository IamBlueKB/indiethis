import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/promo-popups/[id]/analytics
// Body: { event: "impression" | "dismissal" | "ctaClick" }
// No auth required — public analytics tracking endpoint
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { event?: string };
  const event = body.event;

  if (!["impression", "dismissal", "ctaClick"].includes(event ?? "")) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  // Fire-and-forget — don't block on missing popup
  const fieldMap: Record<string, object> = {
    impression: { impressions: { increment: 1 } },
    dismissal:  { dismissals:  { increment: 1 } },
    ctaClick:   { ctaClicks:   { increment: 1 } },
  };

  try {
    await db.promoPopup.update({
      where: { id },
      data: fieldMap[event!],
    });
  } catch {
    // Silently ignore — popup may have been deleted
  }

  return NextResponse.json({ ok: true });
}
