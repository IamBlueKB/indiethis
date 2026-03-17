import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ slug: null });
  }
  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { slug: true },
  });
  return NextResponse.json({ slug: studio?.slug ?? null });
}
