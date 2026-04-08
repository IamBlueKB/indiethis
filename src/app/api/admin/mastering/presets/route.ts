/**
 * GET  /api/admin/mastering/presets — list all MasteringPreset records
 * POST /api/admin/mastering/presets — create a new MasteringPreset
 *
 * PLATFORM_ADMIN only.
 */

import { auth }                      from "@/lib/auth";
import { db }                        from "@/lib/db";
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

export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const presets = await db.masteringPreset.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ presets });
}

export async function POST(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json() as {
    name:          string;
    genre:         string;
    description:   string;
    mixProfile?:   Record<string, unknown>;
    masterProfile?: Record<string, unknown>;
    sortOrder?:    number;
  };

  if (!body.name?.trim() || !body.genre?.trim() || !body.description?.trim()) {
    return NextResponse.json({ error: "name, genre, and description are required." }, { status: 400 });
  }

  const preset = await db.masteringPreset.create({
    data: {
      name:          body.name.trim(),
      genre:         body.genre.trim(),
      description:   body.description.trim(),
      mixProfile:    body.mixProfile    ?? {},
      masterProfile: body.masterProfile ?? {},
      active:        true,
      sortOrder:     body.sortOrder ?? 0,
    },
  });

  return NextResponse.json({ preset }, { status: 201 });
}
