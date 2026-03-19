import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shows = await db.artistShow.findMany({
    where:   { artistId: session.user.id },
    orderBy: { date: "asc" },
    include: { _count: { select: { waitlist: true } } },
  });

  return NextResponse.json({ shows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { venueName, city, date, ticketUrl, isSoldOut } = await req.json();

  if (!venueName?.trim() || !city?.trim() || !date) {
    return NextResponse.json(
      { error: "venueName, city, and date are required" },
      { status: 400 },
    );
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const show = await db.artistShow.create({
    data: {
      artistId:  session.user.id,
      venueName: venueName.trim(),
      city:      city.trim(),
      date:      parsedDate,
      ticketUrl: ticketUrl?.trim() || null,
      isSoldOut: isSoldOut ?? false,
    },
    include: { _count: { select: { waitlist: true } } },
  });

  return NextResponse.json({ show }, { status: 201 });
}
