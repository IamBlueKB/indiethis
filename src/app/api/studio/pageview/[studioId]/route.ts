import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "crypto";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + process.env.NEXTAUTH_SECRET).digest("hex");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;

  // Don't count studio owner viewing their own page
  const session = await auth();
  if (session?.user?.id) {
    const studio = await db.studio.findUnique({
      where: { id: studioId },
      select: { ownerId: true },
    });
    if (studio?.ownerId === session.user.id) {
      return NextResponse.json({ ok: true, skipped: "owner" });
    }
  }

  // Get IP from headers
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : headersList.get("x-real-ip") ?? "unknown";
  const ipHash = hashIp(ip);

  // Dedup: skip if same IP viewed this studio in the last 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const recentView = await db.pageView.findFirst({
    where: {
      studioId,
      ipHash,
      viewedAt: { gte: thirtyMinutesAgo },
    },
    select: { id: true },
  });

  if (recentView) {
    return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  await db.pageView.create({
    data: { studioId, ipHash },
  });

  return NextResponse.json({ ok: true });
}
