import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dl/[token] — fetch download package details (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const quickSend = await db.quickSend.findUnique({ where: { token } });

  if (!quickSend) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  if (new Date() > quickSend.expiresAt) {
    return NextResponse.json({ error: "This download link has expired." }, { status: 410 });
  }

  // Record first download time
  if (!quickSend.downloadedAt) {
    await db.quickSend.update({
      where: { token },
      data: { downloadedAt: new Date() },
    });
  }

  return NextResponse.json({
    senderName: quickSend.senderName,
    message: quickSend.message,
    fileUrls: quickSend.fileUrls,
    expiresAt: quickSend.expiresAt,
  });
}
