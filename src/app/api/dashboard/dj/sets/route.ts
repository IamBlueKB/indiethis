import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/dashboard/dj/sets — list sets for current user's DJ profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ sets: [] });

  const sets = await db.dJSet.findMany({
    where: { djProfileId: djProfile.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      thumbnailUrl: true,
      duration: true,
      venue: true,
      date: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ sets });
}

// POST /api/dashboard/dj/sets — create set
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;

  const djProfile = await db.dJProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!djProfile) return NextResponse.json({ error: "DJ profile not found. Enable DJ Mode first." }, { status: 400 });

  const body = await req.json() as {
    title?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    venue?: string;
    date?: string;
    duration?: number;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!body.videoUrl?.trim()) return NextResponse.json({ error: "Video URL is required" }, { status: 400 });

  const set = await db.dJSet.create({
    data: {
      djProfileId: djProfile.id,
      title: body.title.trim(),
      videoUrl: body.videoUrl.trim(),
      thumbnailUrl: body.thumbnailUrl?.trim() || null,
      venue: body.venue?.trim() || null,
      date: body.date ? new Date(body.date) : null,
      duration: body.duration ?? null,
    },
  });

  return NextResponse.json({ set });
}
