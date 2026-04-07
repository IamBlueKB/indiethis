/**
 * PATCH  /api/admin/video-studio/styles/[id] — update a VideoStyle
 * DELETE /api/admin/video-studio/styles/[id] — delete a VideoStyle
 *
 * Admin only.
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id }  = await params;
  const body    = await req.json() as Partial<{
    name:       string;
    category:   string;
    previewUrl: string;
    promptBase: string;
    sortOrder:  number;
    active:     boolean;
  }>;

  const style = await db.videoStyle.update({
    where: { id },
    data:  body,
  });

  return NextResponse.json({ style });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await assertAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  await db.videoStyle.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
