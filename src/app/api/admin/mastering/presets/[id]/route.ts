/**
 * PATCH  /api/admin/mastering/presets/[id] — update a MasteringPreset
 * DELETE /api/admin/mastering/presets/[id] — delete a MasteringPreset
 *
 * PLATFORM_ADMIN only.
 */

import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
import { Prisma }                    from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN" ? session : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as Partial<{
    name:          string;
    genre:         string;
    description:   string;
    mixProfile:    Record<string, unknown>;
    masterProfile: Record<string, unknown>;
    active:        boolean;
    sortOrder:     number;
  }>;

  const preset = await db.masteringPreset.update({
    where: { id },
    data:  {
      ...(body.name          !== undefined && { name:          body.name.trim() }),
      ...(body.genre         !== undefined && { genre:         body.genre.trim() }),
      ...(body.description   !== undefined && { description:   body.description.trim() }),
      ...(body.mixProfile    !== undefined && { mixProfile:    body.mixProfile    as Prisma.InputJsonValue }),
      ...(body.masterProfile !== undefined && { masterProfile: body.masterProfile as Prisma.InputJsonValue }),
      ...(body.active        !== undefined && { active:        body.active }),
      ...(body.sortOrder     !== undefined && { sortOrder:     body.sortOrder }),
    },
  });

  return NextResponse.json({ preset });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  await db.masteringPreset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
