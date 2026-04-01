/**
 * GET /api/dashboard/ai/creative-prompt?trackId={id}&type=cover_art|video|lyric_video
 *
 * Returns one Haiku-generated prompt suggestion for cover art or video generation.
 * Also checks for a preloaded proactive suggestion stored by the cron agent.
 *
 * Returns: { suggestion: string; preloaded?: boolean }
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { generateCreativePrompt } from "@/lib/agents/creative-prompt";
import { logAgentAction } from "@/lib/agents";

type PromptType = "cover_art" | "video" | "lyric_video";
const VALID_TYPES: PromptType[] = ["cover_art", "video", "lyric_video"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get("trackId");
  const typeRaw = searchParams.get("type") ?? "cover_art";

  if (!trackId) return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  if (!VALID_TYPES.includes(typeRaw as PromptType)) {
    return NextResponse.json({ error: "type must be cover_art, video, or lyric_video" }, { status: 400 });
  }
  const type = typeRaw as PromptType;

  // Verify track ownership
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { id: true, artistId: true },
  });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
  if (track.artistId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check for a preloaded proactive suggestion (stored by cron agent in AgentLog)
  if (type === "cover_art") {
    const preloaded = await db.agentLog.findFirst({
      where: {
        agentType: "CREATIVE_PROMPT",
        action:    "PROACTIVE_NOTIFIED",
        targetId:  trackId,
      },
      orderBy: { createdAt: "desc" },
    });
    if (preloaded?.details) {
      const details = preloaded.details as Record<string, unknown>;
      const suggestion = details.suggestion as string | undefined;
      if (suggestion) {
        await logAgentAction("CREATIVE_PROMPT", "ON_DEMAND_PRELOADED", "TRACK", trackId);
        return NextResponse.json({ suggestion, preloaded: true });
      }
    }
  }

  // Generate fresh suggestion via Haiku
  try {
    const suggestion = await generateCreativePrompt(trackId, type);
    if (!suggestion) {
      return NextResponse.json({ error: "Could not generate suggestion" }, { status: 500 });
    }
    await logAgentAction("CREATIVE_PROMPT", "ON_DEMAND_GENERATED", "TRACK", trackId, { type });
    return NextResponse.json({ suggestion, preloaded: false });
  } catch (e) {
    console.error("[creative-prompt] generation error:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
