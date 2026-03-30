import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/dashboard/dj/crates/[id]/collaborators
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: crateId } = await params;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });
  if (!djProfile) return NextResponse.json({ collaborators: [] });

  const crate = await db.crate.findUnique({ where: { id: crateId }, select: { djProfileId: true } });
  if (!crate) return NextResponse.json({ collaborators: [] });

  // Only the owner or collaborators can see the list
  if (crate.djProfileId !== djProfile.id) {
    const collab = await db.crateCollaborator.findUnique({
      where: { crateId_djProfileId: { crateId, djProfileId: djProfile.id } },
    });
    if (!collab) return NextResponse.json({ collaborators: [] });
  }

  const collaborators = await db.crateCollaborator.findMany({
    where: { crateId },
    select: {
      djProfileId: true,
      djProfile: {
        select: {
          slug: true,
          user: { select: { name: true, photo: true } },
        },
      },
    },
  });

  return NextResponse.json({ collaborators });
}
