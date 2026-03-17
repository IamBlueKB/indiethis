import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LicenseType } from "@prisma/client";

// POST /api/beats/licenses — create a beat license agreement
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { beatPreviewId, licenseType, customTerms, price } = body as {
    beatPreviewId: string;
    licenseType: LicenseType;
    customTerms?: string;
    price: number;
  };

  if (!beatPreviewId || !licenseType || price == null) {
    return NextResponse.json({ error: "Preview, license type, and price are required." }, { status: 400 });
  }

  const preview = await db.beatPreview.findUnique({
    where: { id: beatPreviewId },
    include: { track: true },
  });
  if (!preview) return NextResponse.json({ error: "Preview not found" }, { status: 404 });

  // Only the producer (or artist purchasing) can create a license
  const isProducer = preview.producerId === session.user.id;
  const isArtist = preview.artistId === session.user.id;
  if (!isProducer && !isArtist) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const license = await db.beatLicense.create({
    data: {
      beatPreviewId,
      trackId: preview.trackId,
      producerId: preview.producerId,
      artistId: preview.artistId ?? session.user.id,
      licenseType,
      customTerms: customTerms?.trim() || null,
      price,
    },
  });

  // Mark preview as purchased
  await db.beatPreview.update({
    where: { id: beatPreviewId },
    data: { status: "PURCHASED" },
  });

  return NextResponse.json({ license }, { status: 201 });
}
