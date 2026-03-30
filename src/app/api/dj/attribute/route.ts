import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { djProfileId, sourceType, sourceId } = (await req.json()) as {
    djProfileId: string;
    sourceType: string; // CRATE, MIX, PROFILE
    sourceId: string;
  };

  if (!djProfileId || !sourceType || !sourceId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const fanSessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const attribution = await db.dJAttribution.create({
    data: {
      djProfileId,
      fanSessionId,
      sourceType,
      sourceId,
      artistId: djProfileId, // placeholder — overwritten on actual purchase
      expiresAt,
    },
  });

  const res = NextResponse.json({ ok: true, fanSessionId });
  res.cookies.set(`dj_attribution_${djProfileId}`, attribution.id, {
    expires: expiresAt,
    httpOnly: false, // needs to be readable client-side for checkout
    sameSite: "lax",
    path: "/",
  });

  return res;
}
