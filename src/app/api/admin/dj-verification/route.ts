import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!["SUPER_ADMIN", "OPS_ADMIN", "SUPPORT_ADMIN"].includes(user?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applications = await db.dJVerificationApplication.findMany({
    where: { status: "PENDING" },
    orderBy: { appliedAt: "asc" },
    include: {
      djProfile: {
        select: {
          id: true,
          slug: true,
          socialLinks: true,
          user: { select: { name: true, email: true, createdAt: true } },
          crates: { select: { items: { select: { id: true } } } },
          attributions: {
            where: { amount: { gt: 0 } },
            select: { id: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ applications });
}
