/**
 * POST /api/dashboard/avatar/[id]/set-profile
 *
 * Sets the selected avatar's avatarUrl as the user's profile photo
 * (User.photo field) so it appears on their artist page and dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req:    NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId  = session.user.id;

  const avatar = await db.artistAvatar.findFirst({ where: { id, userId } });
  if (!avatar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({
    where: { id: userId },
    data:  { photo: avatar.avatarUrl },
  });

  return NextResponse.json({ success: true, photo: avatar.avatarUrl });
}
