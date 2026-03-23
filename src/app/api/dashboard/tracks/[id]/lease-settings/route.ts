import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/dashboard/tracks/[id]/lease-settings — upsert BeatLeaseSettings for a beat
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: beatId } = await params;

  // Verify the beat belongs to this user
  const beat = await db.track.findFirst({
    where: { id: beatId, artistId: session.user.id },
    select: { id: true },
  });
  if (!beat) return NextResponse.json({ error: "Beat not found" }, { status: 404 });

  const body = await req.json() as {
    streamLeaseEnabled?: boolean;
    maxStreamLeases?: number | null;
    creditFormat?: string;
    revocationPolicy?: string;
    contentRestrictions?: string[];
    customRestriction?: string | null;
  };

  const settings = await db.beatLeaseSettings.upsert({
    where:  { beatId },
    create: {
      beatId,
      streamLeaseEnabled:  body.streamLeaseEnabled  ?? true,
      maxStreamLeases:     body.maxStreamLeases      ?? null,
      creditFormat:        body.creditFormat         ?? "Prod. {producerName}",
      revocationPolicy:    body.revocationPolicy     ?? "A",
      contentRestrictions: body.contentRestrictions  ?? [],
      customRestriction:   body.customRestriction    ?? null,
    },
    update: {
      ...(body.streamLeaseEnabled  !== undefined && { streamLeaseEnabled:  body.streamLeaseEnabled }),
      ...(body.maxStreamLeases     !== undefined && { maxStreamLeases:     body.maxStreamLeases }),
      ...(body.creditFormat        !== undefined && { creditFormat:        body.creditFormat }),
      ...(body.revocationPolicy    !== undefined && { revocationPolicy:    body.revocationPolicy }),
      ...(body.contentRestrictions !== undefined && { contentRestrictions: body.contentRestrictions }),
      ...(body.customRestriction   !== undefined && { customRestriction:   body.customRestriction }),
    },
  });

  return NextResponse.json({ settings });
}
