import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/promo-popups?page=explore
// Returns active popups targeting the given page (or all if page="*")
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") ?? "";

  const now = new Date();

  const popups = await db.promoPopup.findMany({
    where: {
      active: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: {
      id:              true,
      title:           true,
      subtitle:        true,
      ctaText:         true,
      ctaUrl:          true,
      imageUrl:        true,
      backgroundColor: true,
      pages:           true,
      frequency:       true,
      trigger:         true,
      triggerDelay:    true,
    },
  });

  // Filter to popups that target this page (or "*" wildcard)
  const filtered = popups.filter((p) => {
    const pages = p.pages as string[];
    return pages.includes("*") || pages.includes(page);
  });

  return NextResponse.json({ popups: filtered });
}
