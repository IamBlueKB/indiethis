import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

// POST /api/dj/crates/[id]/invite
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: crateId } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!djProfile) return NextResponse.json({ error: "DJ profile not found" }, { status: 404 });

  const crate = await db.crate.findUnique({ where: { id: crateId }, select: { djProfileId: true } });
  if (!crate || crate.djProfileId !== djProfile.id) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  const body = await req.json() as { djSlug?: string };
  if (!body.djSlug?.trim()) return NextResponse.json({ error: "djSlug is required" }, { status: 400 });

  const invitedProfile = await db.dJProfile.findUnique({
    where: { slug: body.djSlug.trim() },
    select: { id: true },
  });

  if (!invitedProfile) return NextResponse.json({ error: "DJ not found" }, { status: 404 });
  if (invitedProfile.id === djProfile.id) return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });

  // Check if already a collaborator
  const existingCollab = await db.crateCollaborator.findUnique({
    where: { crateId_djProfileId: { crateId, djProfileId: invitedProfile.id } },
  });
  if (existingCollab) return NextResponse.json({ error: "Already a collaborator" }, { status: 409 });

  try {
    const invite = await db.crateInvite.create({
      data: {
        crateId,
        invitedById: djProfile.id,
        invitedId: invitedProfile.id,
        status: "PENDING",
      },
    });

    // Notify the invited DJ
    const invitedDj = await db.dJProfile.findUnique({
      where: { id: invitedProfile.id },
      select: { userId: true },
    });
    if (invitedDj) {
      const inviterName = djProfile.user.name ?? "A DJ";
      void createNotification({
        userId: invitedDj.userId,
        type: "DJ_CRATE_INVITE",
        title: "Crate collaboration invite",
        message: `${inviterName} invited you to collaborate on a crate.`,
        link: "/dashboard/dj/crates",
      }).catch(() => {});
    }

    return NextResponse.json({ invite });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Invite already sent" }, { status: 409 });
    }
    throw e;
  }
}
