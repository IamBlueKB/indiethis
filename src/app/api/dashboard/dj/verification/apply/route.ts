import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function monthsDiff(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  // Load DJ profile with all data needed for validation
  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      verificationStatus: true,
      user: { select: { createdAt: true } },
      crates: {
        select: {
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!djProfile)
    return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  // ── Validate requirements ────────────────────────────────────────────────

  const now = new Date();
  const accountAgeMonths = monthsDiff(djProfile.user.createdAt, now);
  if (accountAgeMonths < 6)
    return NextResponse.json(
      { error: "Account must be at least 6 months old to apply." },
      { status: 400 }
    );

  const totalCrateItems = djProfile.crates.reduce(
    (sum, c) => sum + c._count.items,
    0
  );
  if (totalCrateItems < 20)
    return NextResponse.json(
      { error: "You need at least 20 tracks across your crates." },
      { status: 400 }
    );

  const attributedSalesCount = await db.dJAttribution.count({
    where: { djProfileId: djProfile.id, amount: { gt: 0 } },
  });
  if (attributedSalesCount < 1)
    return NextResponse.json(
      { error: "You need at least 1 attributed sale." },
      { status: 400 }
    );

  // ── Check for existing PENDING application ───────────────────────────────

  if (djProfile.verificationStatus === "PENDING")
    return NextResponse.json(
      { error: "You already have a pending application." },
      { status: 400 }
    );

  // ── Upsert application + update profile status ───────────────────────────

  await db.$transaction([
    db.dJVerificationApplication.upsert({
      where: { djProfileId: djProfile.id },
      create: {
        djProfileId: djProfile.id,
        status: "PENDING",
        appliedAt: new Date(),
      },
      update: {
        status: "PENDING",
        adminNote: null,
        appliedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
      },
    }),
    db.dJProfile.update({
      where: { id: djProfile.id },
      data: { verificationStatus: "PENDING" },
    }),
  ]);

  return NextResponse.json({ success: true }, { status: 200 });
}
