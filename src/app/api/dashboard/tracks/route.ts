import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tracks = await db.track.findMany({
    where: { artistId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tracks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    title?: string;
    fileUrl?: string;
    coverArtUrl?: string;
    price?: number;
    status?: "DRAFT" | "PUBLISHED";
    projectName?: string;
    description?: string;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!body.fileUrl?.trim()) return NextResponse.json({ error: "File URL is required." }, { status: 400 });

  const track = await db.track.create({
    data: {
      artistId: session.user.id,
      title: body.title.trim(),
      fileUrl: body.fileUrl.trim(),
      coverArtUrl: body.coverArtUrl ?? null,
      price: body.price ?? null,
      status: body.status ?? "DRAFT",
      projectName: body.projectName?.trim() ?? null,
      description: body.description?.trim() ?? null,
    },
  });

  return NextResponse.json({ track }, { status: 201 });
}
