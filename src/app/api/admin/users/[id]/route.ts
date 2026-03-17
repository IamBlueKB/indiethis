import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      photo: true,
      bio: true,
      artistName: true,
      createdAt: true,
      lastLoginAt: true,
      isComped: true,
      compExpiresAt: true,
      isSuspended: true,
      subscription: {
        select: {
          tier: true,
          status: true,
          createdAt: true,
          canceledAt: true,
          cancelReason: true,
          currentPeriodEnd: true,
        },
      },
      _count: {
        select: {
          sessions: true,
          aiGenerations: true,
          tracks: true,
        },
      },
      ownedStudios: { select: { id: true, name: true, slug: true, studioTier: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
