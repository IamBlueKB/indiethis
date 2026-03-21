import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const testimonials = await db.artistTestimonial.findMany({
    where:   { artistId: session.user.id },
    orderBy: { sortOrder: "asc" },
    select:  { id: true, quote: true, attribution: true, sortOrder: true },
  });

  return NextResponse.json({ testimonials });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quote, attribution } = await req.json();
  if (!quote || !attribution) return NextResponse.json({ error: "quote and attribution required" }, { status: 400 });

  const count = await db.artistTestimonial.count({ where: { artistId: session.user.id } });

  const item = await db.artistTestimonial.create({
    data: { artistId: session.user.id, quote, attribution, sortOrder: count },
  });

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, quote, attribution } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const item = await db.artistTestimonial.updateMany({
    where: { id, artistId: session.user.id },
    data:  {
      ...(quote       !== undefined && { quote }),
      ...(attribution !== undefined && { attribution }),
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.artistTestimonial.deleteMany({ where: { id, artistId: session.user.id } });

  return NextResponse.json({ ok: true });
}
