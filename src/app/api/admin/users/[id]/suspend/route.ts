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
  const { suspend } = (await req.json()) as { suspend: boolean };

  const user = await db.user.update({
    where: { id },
    data: { isSuspended: suspend },
    select: { id: true, isSuspended: true },
  });

  return NextResponse.json(user);
}
