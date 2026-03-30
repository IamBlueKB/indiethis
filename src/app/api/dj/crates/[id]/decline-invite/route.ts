import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/dj/crates/[id]/decline-invite
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: crateId } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });
  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const invite = await db.crateInvite.findUnique({
    where: { crateId_invitedId: { crateId, invitedId: djProfile.id } },
  });

  if (!invite || invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invite not found or already processed" }, { status: 404 });
  }

  await db.crateInvite.update({
    where: { crateId_invitedId: { crateId, invitedId: djProfile.id } },
    data: { status: "DECLINED" },
  });

  return NextResponse.json({ ok: true });
}
