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

  const studio = await db.studio.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      studioTier: true,
      tierOverride: true,
      isPublished: true,
      createdAt: true,
      description: true,
      city: true,
      state: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
        },
      },
      _count: {
        select: {
          artists: true,
          sessions: true,
          contacts: true,
        },
      },
    },
  });

  if (!studio) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(studio);
}
