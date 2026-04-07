/**
 * POST /api/video-studio/director/[id]/chat
 *
 * Director Mode — Claude chat endpoint.
 * Receives a user message, runs one round of the Director Mode conversation,
 * stores the message + reply in MusicVideo.conversationLog, and returns:
 *   { reply, phase, done }
 *
 * Phase progression:
 *   1 → collecting vision (questions 1–5)
 *   2 → generating creative brief
 *   3 → brief ready for review
 *
 * Body: { message: string }
 */

import { db }                  from "@/lib/db";
import { claude, SONNET }      from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";

// ─── Director Mode system prompt ────────────────────────────────────────────────

const DIRECTOR_SYSTEM_PROMPT = `You are the IndieThis Director — an acclaimed music video director working with an artist to create their vision.

Your job is to ask insightful questions ONE AT A TIME to understand:
1. The emotional tone and mood of the video
2. Key visual themes, imagery, or metaphors
3. The story or journey you want to tell
4. Any references (movies, other music videos, photographers)
5. Special requirements (locations, characters, costumes)

Rules:
- Ask ONE question per message. Never stack multiple questions.
- Be concise — one sentence questions, 1-2 sentences max.
- Be cinematic and inspiring in your language.
- After 4-6 questions, generate the creative brief.
- When generating the brief, output valid JSON inside <brief>...</brief> tags.

Creative Brief JSON schema:
{
  "title": "string — evocative project title",
  "logline": "string — one sentence essence of the video",
  "tone": "string — 3-5 mood words",
  "colorPalette": ["hex1", "hex2", "hex3"],
  "visualThemes": ["string"],
  "narrative": "string — 2-3 sentence story arc",
  "cinematography": "string — camera style and movement notes",
  "references": ["string — film/video references"],
  "specialNotes": "string — any artist-specific requirements"
}

Once you have enough context (after 4-6 exchanges), generate the brief wrapped in <brief></brief> tags, then say "I've captured your vision. Here's your creative brief — review it and let me know if you'd like any changes before we generate your shot list."`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  createdAt: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }    = await params;
    const body      = await req.json() as { message: string };
    const userMsg   = body.message?.trim();

    if (!userMsg) return NextResponse.json({ error: "Message required" }, { status: 400 });

    const video = await db.musicVideo.findUnique({
      where:  { id },
      select: {
        id: true, trackTitle: true, mode: true, status: true,
        conversationLog: true, bpm: true, musicalKey: true, energy: true,
        videoLength: true, style: true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.mode !== "DIRECTOR") return NextResponse.json({ error: "Not Director Mode" }, { status: 400 });

    // Load existing conversation
    const log: ChatMessage[] = Array.isArray(video.conversationLog)
      ? (video.conversationLog as unknown as ChatMessage[])
      : [];

    // Add user message
    const newUserMsg: ChatMessage = {
      role:      "user",
      content:   userMsg,
      createdAt: new Date().toISOString(),
    };
    const updatedLog = [...log, newUserMsg];

    // Build messages for Claude
    const messages = updatedLog.map(m => ({
      role:    m.role as "user" | "assistant",
      content: m.content,
    }));

    // Context hint for Claude
    const contextHint = `The artist's track is "${video.trackTitle}"${video.bpm ? ` at ${video.bpm} BPM` : ""}${video.musicalKey ? `, key of ${video.musicalKey}` : ""}${video.energy != null ? `, energy ${Math.round(video.energy * 10)}/10` : ""}.`;

    const response = await claude.messages.create({
      model:      SONNET,
      max_tokens: 800,
      system:     `${DIRECTOR_SYSTEM_PROMPT}\n\nContext: ${contextHint}`,
      messages,
    });

    const assistantContent = response.content[0].type === "text" ? response.content[0].text : "";

    // Check if brief was generated
    const briefMatch = assistantContent.match(/<brief>([\s\S]*?)<\/brief>/);
    let brief: object | null = null;
    if (briefMatch) {
      try {
        brief = JSON.parse(briefMatch[1].trim());
      } catch { /* brief parse failed — continue */ }
    }

    // Add assistant message to log
    const newAsstMsg: ChatMessage = {
      role:      "assistant",
      content:   assistantContent,
      createdAt: new Date().toISOString(),
    };
    const finalLog = [...updatedLog, newAsstMsg];

    // Determine phase
    const phase = brief ? 2 : 1;

    // Update DB
    await db.musicVideo.update({
      where: { id },
      data:  {
        conversationLog: finalLog as object[],
        ...(brief ? { creativeBrief: brief } : {}),
      },
    });

    // Return stripped reply (without raw JSON tags)
    const displayReply = assistantContent
      .replace(/<brief>[\s\S]*?<\/brief>/g, "")
      .trim();

    return NextResponse.json({
      reply:  displayReply,
      phase,
      done:   !!brief,
      brief:  brief ?? null,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[director/chat]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
