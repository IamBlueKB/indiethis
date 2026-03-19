import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { artistId, email } = await req.json();

  if (!artistId || !email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "artistId and valid email required" }, { status: 400 });
  }

  const artist = await db.user.findUnique({ where: { id: artistId } });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  // Upsert — silently ignore duplicate entries
  await db.showInterest.upsert({
    where:  { artistId_email: { artistId, email: email.toLowerCase().trim() } },
    update: {},
    create: { artistId, email: email.toLowerCase().trim() },
  });

  return NextResponse.json({ ok: true });
}
