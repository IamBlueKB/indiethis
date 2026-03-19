import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function getOwnedShow(id: string, userId: string) {
  const show = await db.artistShow.findUnique({ where: { id } });
  if (!show || show.artistId !== userId) return null;
  return show;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const show = await getOwnedShow(id, session.user.id);
  if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.venueName === "string") data.venueName = body.venueName.trim();
  if (typeof body.city      === "string") data.city      = body.city.trim();
  if (typeof body.ticketUrl === "string") data.ticketUrl = body.ticketUrl.trim() || null;
  if (typeof body.isSoldOut === "boolean") data.isSoldOut = body.isSoldOut;
  if (body.date) {
    const d = new Date(body.date);
    if (!isNaN(d.getTime())) data.date = d;
  }

  const updated = await db.artistShow.update({
    where: { id },
    data,
    include: { _count: { select: { waitlist: true } } },
  });

  return NextResponse.json({ show: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const show = await getOwnedShow(id, session.user.id);
  if (!show) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.artistShow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
