/**
 * GET /api/mastering/presets
 *
 * Returns all active MasteringPresets sorted by sortOrder.
 * Used to populate the genre preset picker in the upload wizard.
 * Public — no auth required.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const presets = await prisma.masteringPreset.findMany({
      where:   { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id:          true,
        name:        true,
        genre:       true,
        description: true,
      },
    });

    return NextResponse.json({ presets });
  } catch (err) {
    console.error("GET /api/mastering/presets:", err);
    return NextResponse.json({ error: "Failed to load presets." }, { status: 500 });
  }
}
