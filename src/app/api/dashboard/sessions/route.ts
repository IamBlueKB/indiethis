import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/sessions — artist's own booking sessions
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ARTIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db.bookingSession.findMany({
    where: { artistId: session.user.id },
    orderBy: { dateTime: "desc" },
    take: 50,
    include: {
      studio: {
        select: { id: true, name: true, address: true },
      },
    },
  });

  return NextResponse.json({ sessions });
}
