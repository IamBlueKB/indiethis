import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ContactSource } from "@prisma/client";

// GET /api/studio/contacts — list all contacts for the current studio admin
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const sourceFilter = searchParams.get("source") ?? "";

  const contacts = await db.contact.findMany({
    where: {
      studioId: studio.id,
      ...(sourceFilter ? { source: sourceFilter as ContactSource } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ contacts });
}

// POST /api/studio/contacts — create a new contact
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = await db.studio.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!studio) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const body = await req.json();
  const { name, email, phone, instagramHandle, genre, notes, source } = body as {
    name: string;
    email?: string;
    phone?: string;
    instagramHandle?: string;
    genre?: string;
    notes?: string;
    source?: ContactSource;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const contact = await db.contact.create({
    data: {
      studioId: studio.id,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      instagramHandle: instagramHandle?.trim() || null,
      genre: genre?.trim() || null,
      notes: notes?.trim() || null,
      source: source ?? "MANUAL",
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
