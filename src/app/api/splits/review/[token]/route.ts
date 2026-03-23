import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/splits/review/[token]
 * Public endpoint — returns split sheet info for a specific split token.
 * Used by the public review page for non-IndieThis users.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const split = await db.split.findUnique({
    where: { reviewToken: token },
    include: {
      splitSheet: {
        include: {
          splits: {
            select: { id: true, name: true, role: true, percentage: true, agreedAt: true, rejectedAt: true },
            orderBy: { createdAt: "asc" },
          },
          track: { select: { id: true, title: true, coverArtUrl: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!split) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Don't expose sensitive fields
  return NextResponse.json({
    sheet: {
      id: split.splitSheet.id,
      status: split.splitSheet.status,
      track: split.splitSheet.track,
      createdBy: split.splitSheet.createdBy,
      splits: split.splitSheet.splits,
    },
    mySplit: {
      id: split.id,
      name: split.name,
      role: split.role,
      percentage: split.percentage,
      agreedAt: split.agreedAt,
      rejectedAt: split.rejectedAt,
      rejectionReason: split.rejectionReason,
    },
  });
}
