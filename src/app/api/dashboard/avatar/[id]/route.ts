/**
 * PUT    /api/dashboard/avatar/[id]  — update name or set as default
 * DELETE /api/dashboard/avatar/[id]  — delete avatar
 *
 * PUT body: { name?, isDefault? }
 * Setting isDefault: true clears isDefault on all other avatars for this user.
 * Deleting does NOT affect previously generated content that used this avatar.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";

export const runtime = "nodejs";

// ─── PUT — update avatar ──────────────────────────────────────────────────────

export async function PUT(
  req:     NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId  = session.user.id;

  const existing = await db.artistAvatar.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { name?: string; isDefault?: boolean };

  // If setting as default, clear the current default first
  if (body.isDefault) {
    await db.artistAvatar.updateMany({
      where: { userId, isDefault: true },
      data:  { isDefault: false },
    });
  }

  const updated = await db.artistAvatar.update({
    where: { id },
    data: {
      ...(body.name      !== undefined && { name:      body.name.trim() }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    },
  });

  return NextResponse.json({ avatar: updated });
}

// ─── DELETE — remove avatar ───────────────────────────────────────────────────

export async function DELETE(
  _req:    NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId  = session.user.id;

  const existing = await db.artistAvatar.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.artistAvatar.delete({ where: { id } });

  // If we deleted the default, promote the newest remaining avatar to default
  if (existing.isDefault) {
    const next = await db.artistAvatar.findFirst({
      where:   { userId },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await db.artistAvatar.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return NextResponse.json({ success: true });
}
