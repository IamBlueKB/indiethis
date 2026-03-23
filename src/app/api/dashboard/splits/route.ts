import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSplitSheetInviteEmail } from "@/lib/brevo/email";

/**
 * GET /api/dashboard/splits
 * List all split sheets the artist created or participates in.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Sheets I created
  const created = await db.splitSheet.findMany({
    where: { createdById: userId },
    include: {
      splits: { orderBy: { createdAt: "asc" } },
      track: { select: { id: true, title: true, coverArtUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Sheets I'm a split participant in (but didn't create)
  const participating = await db.splitSheet.findMany({
    where: {
      splits: { some: { userId } },
      NOT: { createdById: userId },
    },
    include: {
      splits: { orderBy: { createdAt: "asc" } },
      track: { select: { id: true, title: true, coverArtUrl: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ created, participating });
}

/**
 * POST /api/dashboard/splits
 * Create a new split sheet with all splits. Sends invite notifications/emails.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const body = await req.json() as {
    trackId: string;
    splits: {
      userId?: string;
      name: string;
      email: string;
      role: string;
      percentage: number;
    }[];
  };

  if (!body.trackId || !body.splits?.length) {
    return NextResponse.json({ error: "trackId and splits are required" }, { status: 400 });
  }

  // Validate track ownership
  const track = await db.track.findFirst({
    where: { id: body.trackId, artistId: userId },
    select: { id: true, title: true },
  });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Validate no existing active/pending split sheet
  const existing = await db.splitSheet.findUnique({
    where: { trackId: body.trackId },
  });
  if (existing && existing.status !== "EXPIRED") {
    return NextResponse.json({ error: "A split sheet already exists for this track" }, { status: 409 });
  }

  // Validate percentages sum to 100
  const total = body.splits.reduce((acc, s) => acc + s.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 });
  }

  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  // Create or replace split sheet
  const sheet = await db.splitSheet.upsert({
    where: { trackId: body.trackId },
    create: {
      trackId: body.trackId,
      createdById: userId,
      status: "PENDING",
      splits: {
        create: body.splits.map((s) => ({
          userId: s.userId ?? null,
          name: s.name,
          email: s.email,
          role: s.role as import("@prisma/client").SplitRole,
          percentage: s.percentage,
          // Auto-agree creator's own split
          agreedAt: s.userId === userId ? new Date() : null,
        })),
      },
    },
    update: {
      status: "PENDING",
      splits: {
        deleteMany: {},
        create: body.splits.map((s) => ({
          userId: s.userId ?? null,
          name: s.name,
          email: s.email,
          role: s.role as import("@prisma/client").SplitRole,
          percentage: s.percentage,
          agreedAt: s.userId === userId ? new Date() : null,
        })),
      },
    },
    include: {
      splits: true,
      track: { select: { id: true, title: true, coverArtUrl: true } },
    },
  });

  // Send invites to all contributors (except the creator)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
  for (const split of sheet.splits) {
    if (split.userId === userId) continue; // skip self

    // In-app notification for registered users
    if (split.userId) {
      await createNotification({
        userId: split.userId,
        type: "SPLIT_SHEET_INVITE",
        title: `${creator?.name ?? "An artist"} invited you to a split sheet`,
        message: `Your share: ${split.percentage}% as ${split.role} on "${track.title}"`,
        link: `/dashboard/splits/${sheet.id}`,
      }).catch(console.error);
    }

    // Email invite (both registered and non-registered)
    const reviewUrl = split.userId
      ? `${appUrl}/dashboard/splits/${sheet.id}`
      : `${appUrl}/splits/review/${split.reviewToken}`;

    sendSplitSheetInviteEmail({
      recipientEmail: split.email,
      recipientName: split.name,
      creatorName: creator?.name ?? "An artist",
      trackTitle: track.title,
      role: split.role,
      percentage: split.percentage,
      reviewUrl,
    }).catch(console.error);
  }

  return NextResponse.json({ sheet }, { status: 201 });
}
