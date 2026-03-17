import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const role = searchParams.get("role") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const status = searchParams.get("status") ?? "";
  const sort = searchParams.get("sort") ?? "joined";
  const order = (searchParams.get("order") ?? "desc") as "asc" | "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50")));

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role && ["ARTIST", "STUDIO_ADMIN", "PLATFORM_ADMIN"].includes(role)) {
    where.role = role as "ARTIST" | "STUDIO_ADMIN" | "PLATFORM_ADMIN";
  }

  if (tier && ["LAUNCH", "PUSH", "REIGN"].includes(tier)) {
    where.subscription = { tier: tier as "LAUNCH" | "PUSH" | "REIGN" };
  }

  if (status === "active") {
    where.subscription = { ...((where.subscription as object) ?? {}), status: "ACTIVE" };
  } else if (status === "canceled") {
    where.subscription = { ...((where.subscription as object) ?? {}), status: "CANCELLED" };
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "name" ? { name: order }
    : sort === "email" ? { email: order }
    : sort === "lastLogin" ? { lastLoginAt: order }
    : { createdAt: order };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        subscription: { select: { tier: true, status: true } },
        _count: { select: { sessions: true } },
      },
    }),
  ]);

  return NextResponse.json({
    users,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}
