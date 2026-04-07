/**
 * POST /api/lyric-video/brief/lock
 *
 * Locks the creative brief on a LyricVideo draft job.
 * Stores the full conversation log on the record.
 *
 * Body: { jobId, conversationLog?: ChatMessage[] }
 * Response: { success: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    jobId?:            string;
    conversationLog?:  unknown[];
    creativeBrief?:    unknown;
  };

  if (!body.jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  try {
    await db.lyricVideo.update({
      where: { id: body.jobId },
      data:  {
        conversationLog: (body.conversationLog ?? []) as object[],
        creativeBrief:   (body.creativeBrief ?? undefined) as object | undefined,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lyric-video/brief/lock] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
