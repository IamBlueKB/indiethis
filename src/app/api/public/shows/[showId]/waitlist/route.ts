import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ showId: string }> },
) {
  const { showId } = await params;
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const show = await db.artistShow.findUnique({ where: { id: showId } });
  if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });

  // Upsert — silently ignore duplicate entries
  await db.showWaitlist.upsert({
    where:  { showId_email: { showId, email: email.toLowerCase().trim() } },
    update: {},
    create: { showId, email: email.toLowerCase().trim() },
  });

  return NextResponse.json({ ok: true });
}
