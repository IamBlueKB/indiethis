import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/studio/generation-feedback
// Called when a studio user edits an AI-generated field in the visual editor.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDIO_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    generationLogId?: string;
    sectionType: string;
    fieldChanged: string;
    aiOriginalValue: string;
    userEditedValue: string;
  };

  if (!body.sectionType || !body.fieldChanged) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Skip trivial / no-op changes
  if (body.aiOriginalValue === body.userEditedValue) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await db.generationFeedback.create({
    data: {
      pageType: "STUDIO",
      ownerId: session.user.id,
      generationLogId: body.generationLogId ?? null,
      sectionType: body.sectionType,
      fieldChanged: body.fieldChanged,
      aiOriginalValue: String(body.aiOriginalValue ?? ""),
      userEditedValue: String(body.userEditedValue ?? ""),
    },
  });

  return NextResponse.json({ ok: true });
}
