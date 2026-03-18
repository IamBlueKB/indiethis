import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/affiliates/[id]/commission
 *
 * Updates commissionRate and/or commissionDurationMonths for an affiliate.
 * Body: { commissionRate?: number (0–1), commissionDurationMonths?: number }
 *
 * Note: existing AffiliateReferral records retain their snapshotted commission rate.
 * Only future referrals (created after this update) will use the new rate.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { commissionRate?: number; commissionDurationMonths?: number };

  const { commissionRate, commissionDurationMonths } = body;

  // Validate
  if (commissionRate !== undefined) {
    if (typeof commissionRate !== "number" || commissionRate < 0 || commissionRate > 1) {
      return NextResponse.json(
        { error: "commissionRate must be a number between 0 and 1." },
        { status: 400 }
      );
    }
  }
  if (commissionDurationMonths !== undefined) {
    if (!Number.isInteger(commissionDurationMonths) || commissionDurationMonths < 1 || commissionDurationMonths > 60) {
      return NextResponse.json(
        { error: "commissionDurationMonths must be an integer between 1 and 60." },
        { status: 400 }
      );
    }
  }

  const affiliate = await db.affiliate.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
  }

  const data: { commissionRate?: number; commissionDurationMonths?: number } = {};
  if (commissionRate !== undefined)         data.commissionRate = commissionRate;
  if (commissionDurationMonths !== undefined) data.commissionDurationMonths = commissionDurationMonths;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await db.affiliate.update({
    where: { id },
    data,
    select: { id: true, commissionRate: true, commissionDurationMonths: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
