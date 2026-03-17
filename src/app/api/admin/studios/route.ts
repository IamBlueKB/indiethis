import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

const DORMANT_DAYS = 14;

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tier = searchParams.get("tier") ?? "";
  const published = searchParams.get("published") ?? "";
  const dormantOnly = searchParams.get("dormant") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50")));

  const where: Prisma.StudioWhereInput = {};

  if (tier && ["PRO", "ELITE"].includes(tier)) {
    where.studioTier = tier as "PRO" | "ELITE";
  }

  if (published === "true") {
    where.isPublished = true;
  } else if (published === "false") {
    where.isPublished = false;
  }

  if (dormantOnly) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);
    where.owner = {
      OR: [
        { lastLoginAt: { lt: cutoff } },
        { lastLoginAt: null },
      ],
    };
  }

  const [total, studios] = await Promise.all([
    db.studio.count({ where }),
    db.studio.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        owner: { select: { name: true, email: true, lastLoginAt: true } },
        _count: { select: { artists: true, sessions: true, contacts: true } },
      },
    }),
  ]);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);

  const studiosWithDormant = studios.map((s) => ({
    ...s,
    isDormant:
      !s.owner.lastLoginAt || new Date(s.owner.lastLoginAt) < cutoff,
  }));

  return NextResponse.json({
    studios: studiosWithDormant,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}
