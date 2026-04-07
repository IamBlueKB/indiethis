/**
 * POST /api/lyric-video/brief/chat
 *
 * Sends a user message to Claude creative director and returns the AI reply.
 * Detects when the brief has enough info to lock (after 3+ exchanges).
 *
 * Body: { jobId, message, history: ChatMessage[] }
 * Response: { reply: string; briefReady: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { claude, SONNET }            from "@/lib/claude";

export const runtime = "nodejs";

interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a creative director for cinematic lyric videos. Your job is to extract the artist's creative vision through friendly conversation — mood, aesthetic, colors, themes, visual story.

After 2-3 exchanges, you'll have enough to craft per-section prompts. Keep responses under 3 sentences. Be specific and visually descriptive. When the user seems satisfied or provides enough detail, end with: "Perfect — I have everything I need to build your section plan!"`;

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    jobId?:   string;
    message?: string;
    history?: ChatMessage[];
  };

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const history = body.history ?? [];

  try {
    const messages = history.map(m => ({
      role:    m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await claude.messages.create({
      model:      SONNET,
      max_tokens: 250,
      system:     SYSTEM_PROMPT,
      messages,
    });

    const reply = (response.content[0] as { text?: string })?.text ?? "Tell me more about your vision.";

    // Detect if brief is ready
    const briefReady =
      reply.toLowerCase().includes("i have everything") ||
      reply.toLowerCase().includes("section plan") ||
      history.filter(m => m.role === "user").length >= 3;

    return NextResponse.json({ reply, briefReady });
  } catch (err) {
    console.error("[lyric-video/brief/chat] error:", err);
    return NextResponse.json({ reply: "I had trouble connecting. Could you share your vision again?", briefReady: false });
  }
}
