/**
 * GET /api/lyric-video/section-plan?jobId=xxx
 *
 * Generates (or returns cached) a per-section plan for Director Mode.
 * Runs song analysis if not already done, then uses Claude to craft
 * per-section background prompts from the conversation log.
 *
 * Response: { sections: SectionPlan[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";
import { claude, SONNET }            from "@/lib/claude";
import { analyzeSong }               from "@/lib/video-studio/song-analyzer";
import { fal }                       from "@fal-ai/client";

export const runtime = "nodejs";

interface SectionPlan {
  sectionIndex:       number;
  type:               string;
  lyrics:             string | null;
  startTime:          number;
  endTime:            number;
  backgroundPrompt:   string;
  typographyStyleId?: string;
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await db.lyricVideo.findUnique({
    where:  { id: jobId },
    select: {
      audioUrl:       true,
      trackTitle:     true,
      trackDuration:  true,
      trackId:        true,
      coverArtUrl:    true,
      conversationLog: true,
      sectionPlan:    true,
      songStructure:  true,
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Return cached section plan if already built
  if (job.sectionPlan) {
    return NextResponse.json({ sections: job.sectionPlan });
  }

  try {
    // Ensure fal is configured
    const falKey = process.env.FAL_KEY;
    if (falKey) fal.config({ credentials: falKey });

    // Analyze song if not already done
    let analysis = job.songStructure as {
      sections: { type: string; startTime: number; endTime: number; duration: number; energy: number; lyrics: string | null; mood: string }[];
      lyrics: string | null;
    } | null;

    if (!analysis) {
      const result = await analyzeSong({
        audioUrl:  job.audioUrl,
        trackId:   job.trackId ?? undefined,
        duration:  job.trackDuration,
      });
      await db.lyricVideo.update({
        where: { id: jobId },
        data:  { songStructure: result as object, bpm: result.bpm, musicalKey: result.key, energy: result.energy },
      });
      analysis = result;
    }

    const sections = analysis?.sections ?? [];

    // Build per-section prompts using Claude + conversation log
    const conversationLog = (job.conversationLog as { role: string; content: string }[]) ?? [];
    const briefSummary    = conversationLog
      .filter(m => m.role === "user")
      .map(m => m.content)
      .join(" | ");

    const sectionDescriptions = sections.map((s, i) =>
      `Section ${i} (${s.type}, ${s.startTime.toFixed(0)}s–${s.endTime.toFixed(0)}s, energy: ${s.energy.toFixed(2)}, mood: ${s.mood})${s.lyrics ? `: "${s.lyrics.slice(0, 60)}"` : ""}`,
    ).join("\n");

    const promptResponse = await claude.messages.create({
      model:      SONNET,
      max_tokens: 1200,
      messages: [{
        role:    "user",
        content: `You are creating background scene descriptions for a cinematic lyric video.

Track: "${job.trackTitle}"
Artist vision: ${briefSummary || "No specific direction provided — use the section mood and energy."}

Song sections:
${sectionDescriptions}

For each section, write a 1-sentence atmospheric background scene description (no people, no text, no faces — abstract cinematic environments only). Make each one visually distinct and match the energy/mood.

Respond ONLY with a JSON array:
[{"sectionIndex": 0, "backgroundPrompt": "..."}, ...]`,
      }],
    });

    const raw = (promptResponse.content[0] as { text?: string })?.text ?? "[]";
    let promptMap: { sectionIndex: number; backgroundPrompt: string }[] = [];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) promptMap = JSON.parse(jsonMatch[0]);
    } catch { /* use fallback */ }

    const sectionPlan: SectionPlan[] = sections.map((s, i) => {
      const promptData = promptMap.find(p => p.sectionIndex === i);
      return {
        sectionIndex:     i,
        type:             s.type,
        lyrics:           s.lyrics,
        startTime:        s.startTime,
        endTime:          s.endTime,
        backgroundPrompt: promptData?.backgroundPrompt ?? `${s.mood} atmospheric abstract environment, ${s.type} section, cinematic, no people`,
      };
    });

    // Cache it
    await db.lyricVideo.update({
      where: { id: jobId },
      data:  { sectionPlan: sectionPlan as object[] },
    });

    return NextResponse.json({ sections: sectionPlan });
  } catch (err) {
    console.error("[lyric-video/section-plan] error:", err);
    return NextResponse.json({ error: "Failed to build section plan" }, { status: 500 });
  }
}
