import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard/license-documents?trackId=...&streamLeaseId=...&aiJobId=...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const trackId       = searchParams.get("trackId")       ?? undefined;
  const streamLeaseId = searchParams.get("streamLeaseId") ?? undefined;
  const aiJobId       = searchParams.get("aiJobId")       ?? undefined;

  const docs = await db.licenseDocument.findMany({
    where: {
      userId: session.user.id,
      ...(trackId       ? { trackId }       : {}),
      ...(streamLeaseId ? { streamLeaseId } : {}),
      ...(aiJobId       ? { aiJobId }       : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, fileUrl: true, fileType: true,
      source: true, notes: true, createdAt: true,
      trackId: true, streamLeaseId: true, aiJobId: true,
    },
  });

  return NextResponse.json({ docs });
}

// POST /api/dashboard/license-documents
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    title: string;
    fileUrl: string;
    fileType: string;
    source: string;
    notes?: string;
    trackId?: string;
    streamLeaseId?: string;
    aiJobId?: string;
  };

  if (!body.title?.trim() || !body.fileUrl || !body.source) {
    return NextResponse.json({ error: "title, fileUrl, and source are required." }, { status: 400 });
  }

  const doc = await db.licenseDocument.create({
    data: {
      userId:       session.user.id,
      title:        body.title.trim(),
      fileUrl:      body.fileUrl,
      fileType:     body.fileType,
      source:       body.source as never,
      notes:        body.notes?.trim() || null,
      trackId:      body.trackId       || null,
      streamLeaseId: body.streamLeaseId || null,
      aiJobId:      body.aiJobId       || null,
    },
    select: {
      id: true, title: true, fileUrl: true, fileType: true,
      source: true, notes: true, createdAt: true,
      trackId: true, streamLeaseId: true, aiJobId: true,
    },
  });

  return NextResponse.json({ doc }, { status: 201 });
}
