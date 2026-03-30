import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST /api/dashboard/dj/deactivate
// Sets user.djMode = false (keeps DJProfile and data intact)
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({
    where: { id: session.user.id as string },
    data: { djMode: false },
  });

  return NextResponse.json({ ok: true });
}
