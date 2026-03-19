/**
 * POST /api/public/presave-click
 *
 * Logs a pre-save button click.  No auth required — public endpoint.
 * Body: { campaignId: string; platform: "SPOTIFY" | "APPLE_MUSIC" }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { campaignId?: string; platform?: string };
    if (!body.campaignId) return NextResponse.json({ ok: false }, { status: 400 });

    const platform = body.platform === "APPLE_MUSIC" ? "APPLE_MUSIC" : "SPOTIFY";

    // Verify campaign exists
    const campaign = await db.preSaveCampaign.findUnique({
      where:  { id: body.campaignId },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ ok: false }, { status: 404 });

    await db.preSaveClick.create({
      data: { campaignId: body.campaignId, platform },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[presave-click]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
