/**
 * POST /api/mastering/preview — REMOVED
 *
 * Free 30-second preview was removed. No audio processing happens before payment.
 * Artists pay first, then all 4 mastered versions are generated and compared.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Free preview has been removed. Pay to master and compare all 4 versions." },
    { status: 410 }
  );
}
