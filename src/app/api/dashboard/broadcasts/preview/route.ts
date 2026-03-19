/**
 * GET /api/dashboard/broadcasts/preview?segment=ALL
 *                                        ?segment=ZIP&zip=90210
 *
 * Returns the number of reachable phone recipients for a segment
 * without sending anything. Used to show "~N recipients" in the compose form.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveBroadcastRecipients } from "@/lib/brevo/broadcast-sms";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const artistId = session.user.id;

    const { searchParams } = new URL(req.url);
    const segType = (searchParams.get("segment") ?? "ALL").trim();
    const zip     = (searchParams.get("zip") ?? "").trim();

    // Build the full segment string
    const segment = segType === "ZIP" && zip ? `ZIP:${zip}` : segType;

    const phones = await resolveBroadcastRecipients(artistId, segment);

    return NextResponse.json({ count: phones.length, segment });
  } catch (err) {
    console.error("[broadcasts/preview]", err);
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}
