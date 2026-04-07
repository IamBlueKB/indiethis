/**
 * GET /api/lyric-video/status?jobId=xxx
 *
 * Poll a LyricVideo job's status and progress.
 * Public — auth not required (jobId is secret enough).
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  try {
    const job = await db.lyricVideo.findUnique({
      where:  { id: jobId },
      select: {
        id:           true,
        status:       true,
        progress:     true,
        currentStep:  true,
        finalVideoUrl:true,
        thumbnailUrl: true,
        errorMessage: true,
      },
    });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch (err) {
    console.error("[lyric-video/status] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
