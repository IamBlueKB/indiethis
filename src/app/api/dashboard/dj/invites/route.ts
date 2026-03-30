import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/dashboard/dj/invites — list pending invites for current DJ
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const djProfile = await db.dJProfile.findUnique({
    where: { userId: session.user.id as string },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ invites: [] });

  const invites = await db.crateInvite.findMany({
    where: { invitedId: djProfile.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      crateId: true,
      status: true,
      createdAt: true,
      crate: {
        select: {
          id: true,
          name: true,
          djProfile: {
            select: {
              slug: true,
              user: { select: { name: true, artistName: true, photo: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ invites });
}
