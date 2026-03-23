import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/producer/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, leaseSettings] = await Promise.all([
    db.producerProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        defaultLeasePrice: true,
        defaultNonExclusivePrice: true,
        defaultExclusivePrice: true,
        separatePayoutEnabled: true,
        producerStripeConnectId: true,
      },
    }),
    db.producerLeaseSettings.findUnique({
      where: { producerId: session.user.id },
      select: {
        id: true,
        streamLeaseEnabled: true,
        revocationPolicy: true,
        contentRestrictions: true,
        creditFormat: true,
      },
    }),
  ]);

  return NextResponse.json({ profile, leaseSettings });
}

// PATCH /api/dashboard/producer/settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only users with a ProducerProfile can update producer settings
  const existing = await db.producerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "No producer profile found." }, { status: 404 });
  }

  const body = await req.json() as {
    // Profile fields
    displayName?: string;
    bio?: string;
    defaultLeasePrice?: number | null;
    defaultNonExclusivePrice?: number | null;
    defaultExclusivePrice?: number | null;
    separatePayoutEnabled?: boolean;
    // Lease settings fields
    streamLeaseEnabled?: boolean;
    revocationPolicy?: string;
    contentRestrictions?: string[];
    creditFormat?: string;
  };

  const [profile, leaseSettings] = await Promise.all([
    db.producerProfile.update({
      where: { userId: session.user.id },
      data: {
        displayName:              body.displayName?.trim()    || null,
        bio:                      body.bio?.trim()            ?? undefined,
        defaultLeasePrice:        body.defaultLeasePrice       ?? undefined,
        defaultNonExclusivePrice: body.defaultNonExclusivePrice ?? undefined,
        defaultExclusivePrice:    body.defaultExclusivePrice   ?? undefined,
        separatePayoutEnabled:    body.separatePayoutEnabled   ?? undefined,
      },
      select: {
        id: true,
        displayName: true,
        bio: true,
        defaultLeasePrice: true,
        defaultNonExclusivePrice: true,
        defaultExclusivePrice: true,
        separatePayoutEnabled: true,
        producerStripeConnectId: true,
      },
    }),
    db.producerLeaseSettings.upsert({
      where: { producerId: session.user.id },
      create: {
        producerId:          session.user.id,
        streamLeaseEnabled:  body.streamLeaseEnabled  ?? true,
        revocationPolicy:    body.revocationPolicy    ?? "A",
        contentRestrictions: body.contentRestrictions ?? [],
        creditFormat:        body.creditFormat?.trim() ?? "Prod. {producerName}",
      },
      update: {
        streamLeaseEnabled:  body.streamLeaseEnabled  ?? undefined,
        revocationPolicy:    body.revocationPolicy    ?? undefined,
        contentRestrictions: body.contentRestrictions ?? undefined,
        creditFormat:        body.creditFormat?.trim() ?? undefined,
      },
      select: {
        id: true,
        streamLeaseEnabled: true,
        revocationPolicy: true,
        contentRestrictions: true,
        creditFormat: true,
      },
    }),
  ]);

  return NextResponse.json({ profile, leaseSettings });
}
