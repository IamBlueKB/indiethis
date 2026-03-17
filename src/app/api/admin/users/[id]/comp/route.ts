import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { enabled, expiresAt } = (await req.json()) as {
    enabled: boolean;
    expiresAt?: string | null;
  };

  const user = await db.user.update({
    where: { id },
    data: {
      isComped: enabled,
      compExpiresAt: enabled && expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true, isComped: true, compExpiresAt: true },
  });

  return NextResponse.json(user);
}
