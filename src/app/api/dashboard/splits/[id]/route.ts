import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendSplitSheetInviteEmail } from "@/lib/brevo/email";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/splits/[id]
 * Full split sheet detail. Must be a participant.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const sheet = await db.splitSheet.findFirst({
    where: {
      id,
      OR: [
        { createdById: userId },
        { splits: { some: { userId } } },
      ],
    },
    include: {
      splits: { orderBy: { createdAt: "asc" } },
      track: { select: { id: true, title: true, coverArtUrl: true, artistId: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ sheet });
}

/**
 * PATCH /api/dashboard/splits/[id]
 * Update splits (creator only, PENDING only). Re-sends invites.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const sheet = await db.splitSheet.findFirst({
    where: { id, createdById: userId, status: "PENDING" },
    include: { track: { select: { title: true } } },
  });
  if (!sheet) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });

  const body = await req.json() as {
    splits: {
      userId?: string;
      name: string;
      email: string;
      role: string;
      percentage: number;
    }[];
  };

  const total = body.splits.reduce((acc, s) => acc + s.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return NextResponse.json({ error: "Percentages must sum to 100" }, { status: 400 });
  }

  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // Replace all splits
  await db.split.deleteMany({ where: { splitSheetId: id } });
  await db.splitSheet.update({
    where: { id },
    data: {
      splits: {
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
  });

  const updated = await db.splitSheet.findUnique({
    where: { id },
    include: { splits: true, track: { select: { id: true, title: true, coverArtUrl: true } } },
  });

  // Re-send invites
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://indiethis.com";
  for (const split of updated!.splits) {
    if (split.userId === userId) continue;
    if (split.userId) {
      await createNotification({
        userId: split.userId,
        type: "SPLIT_SHEET_INVITE",
        title: `${creator?.name ?? "An artist"} updated your split sheet`,
        message: `New share: ${split.percentage}% as ${split.role} on "${sheet.track.title}"`,
        link: `/dashboard/splits/${id}`,
      }).catch(console.error);
    }
    const reviewUrl = split.userId
      ? `${appUrl}/dashboard/splits/${id}`
      : `${appUrl}/splits/review/${split.reviewToken}`;
    sendSplitSheetInviteEmail({
      recipientEmail: split.email,
      recipientName: split.name,
      creatorName: creator?.name ?? "An artist",
      trackTitle: sheet.track.title,
      role: split.role,
      percentage: split.percentage,
      reviewUrl,
    }).catch(console.error);
  }

  return NextResponse.json({ sheet: updated });
}

/**
 * DELETE /api/dashboard/splits/[id]
 * Cancel/expire a PENDING split sheet (creator only).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const sheet = await db.splitSheet.findFirst({
    where: { id, createdById: userId, status: "PENDING" },
  });
  if (!sheet) return NextResponse.json({ error: "Not found or not cancellable" }, { status: 404 });

  await db.splitSheet.update({ where: { id }, data: { status: "EXPIRED" } });

  return NextResponse.json({ ok: true });
}
