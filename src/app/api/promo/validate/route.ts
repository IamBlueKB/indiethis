import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validatePromoCode } from "@/lib/promo-redeem";

/**
 * POST /api/promo/validate
 *
 * Public route — validates a promo code and returns what benefit it provides.
 * Does NOT redeem the code.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = body?.code?.toString().trim();

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  // Optionally pass userId to check if already redeemed
  const session = await auth();
  const userId = session?.user?.id as string | undefined;

  const result = await validatePromoCode(code, userId);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ promoCode: result.promoCode });
}
