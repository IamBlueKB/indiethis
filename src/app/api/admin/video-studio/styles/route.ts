/**
 * GET  /api/admin/video-studio/styles — list all VideoStyle records
 * POST /api/admin/video-studio/styles — create a new VideoStyle
 *
 * Admin only.
 */

import { auth }                  from "@/lib/auth";
import { db }                    from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function assertAdmin(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "PLATFORM_ADMIN" ? session : null;
}

export async function GET(req: NextRequest) {
  const adminSession = await assertAdmin(req);
  if (!adminSession) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const styles = await db.videoStyle.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ styles });
}

export async function POST(req: NextRequest) {
  const adminSession = await assertAdmin(req);
  if (!adminSession) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json() as {
    name:       string;
    category:   string;
    previewUrl: string;
    promptBase: string;
    sortOrder?: number;
    active?:    boolean;
  };

  if (!body.name || !body.category || !body.promptBase) {
    return NextResponse.json({ error: "name, category, promptBase required" }, { status: 400 });
  }

  const style = await db.videoStyle.create({
    data: {
      name:       body.name,
      category:   body.category,
      previewUrl: body.previewUrl ?? "",
      promptBase: body.promptBase,
      sortOrder:  body.sortOrder ?? 0,
      active:     body.active ?? true,
    },
  });

  return NextResponse.json({ style });
}
