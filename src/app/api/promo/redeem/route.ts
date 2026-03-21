import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redeemPromoCode } from "@/lib/promo-redeem";

/**
 * POST /api/promo/redeem
 *
 * Authenticated route — redeems a promo code for the current user.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = body?.code?.toString().trim();

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const result = await redeemPromoCode(session.user.id as string, code);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    redemptionId: result.redemptionId,
    benefitDescription: result.benefitDescription,
  });
}
