/**
 * PATCH  /api/dashboard/presave/[id]  — update (toggle isActive, edit fields)
 * DELETE /api/dashboard/presave/[id]  — delete campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function own(id: string, userId: string) {
  const c = await db.preSaveCampaign.findFirst({ where: { id, artistId: userId } });
  return c;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await own(params.id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json() as Partial<{
      title:        string;
      artUrl:       string | null;
      releaseDate:  string;
      spotifyUrl:   string | null;
      appleMusicUrl: string | null;
      isActive:     boolean;
    }>;

    const updated = await db.preSaveCampaign.update({
      where: { id: params.id },
      data: {
        ...(body.title        !== undefined && { title:        body.title }),
        ...(body.artUrl       !== undefined && { artUrl:       body.artUrl }),
        ...(body.releaseDate  !== undefined && { releaseDate:  new Date(body.releaseDate) }),
        ...(body.spotifyUrl   !== undefined && { spotifyUrl:   body.spotifyUrl }),
        ...(body.appleMusicUrl !== undefined && { appleMusicUrl: body.appleMusicUrl }),
        ...(body.isActive     !== undefined && { isActive:     body.isActive }),
      },
    });

    return NextResponse.json({ ok: true, campaign: updated });
  } catch (err) {
    console.error("[presave PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await own(params.id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.preSaveCampaign.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[presave DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
