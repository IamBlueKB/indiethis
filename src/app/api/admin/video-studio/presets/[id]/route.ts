/**
 * PATCH /api/admin/video-studio/presets/[id] — update a VideoPreset
 * DELETE /api/admin/video-studio/presets/[id] — delete a VideoPreset
 *
 * PLATFORM_ADMIN only.
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
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
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id }  = await params;
  const body    = await req.json() as Partial<{
    name: string; genre: string; description: string; previewUrl: string | null;
    styleName: string | null; moodArc: string; cameraSequence: object;
    briefTemplate: object; defaultFilmLook: string; sortOrder: number; active: boolean;
  }>;

  const existing = await db.videoPreset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const preset = await db.videoPreset.update({
    where: { id },
    data:  body,
  });

  return NextResponse.json({ preset });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.videoPreset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.videoPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
