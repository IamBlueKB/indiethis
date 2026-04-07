/**
 * POST /api/lyric-video/brief
 *
 * Creates a draft LyricVideo job (Director Mode) and returns a Claude greeting.
 * Public — no auth required.
 *
 * Body: { audioUrl, trackTitle, coverArtUrl?, guestEmail, mode: "director" }
 * Response: { jobId: string; greeting: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";
import { auth }                      from "@/lib/auth";
import { claude, SONNET }            from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    audioUrl?:    string;
    trackTitle?:  string;
    coverArtUrl?: string;
    guestEmail?:  string;
    mode?:        string;
  };

  if (!body.audioUrl?.trim() || !body.trackTitle?.trim()) {
    return NextResponse.json({ error: "audioUrl and trackTitle required" }, { status: 400 });
  }

  const session    = await auth();
  const guestEmail = body.guestEmail?.trim() ?? session?.user?.email ?? null;

  // Create draft LyricVideo job
  const job = await db.lyricVideo.create({
    data: {
      userId:       session?.user?.id ?? null,
      guestEmail:   session?.user?.id ? null : guestEmail,
      mode:         "DIRECTOR",
      audioUrl:     body.audioUrl.trim(),
      trackTitle:   body.trackTitle.trim(),
      trackDuration: 180, // placeholder
      coverArtUrl:  body.coverArtUrl?.trim() || null,
      status:       "PENDING",
      amount:       0, // set at checkout
    },
  });

  // Generate a creative director greeting via Claude
  let greeting = `I'm your creative director for "${body.trackTitle}". Tell me about the vibe, mood, story, or aesthetic you want. What should viewers feel?`;

  try {
    const response = await claude.messages.create({
      model:      SONNET,
      max_tokens: 200,
      messages: [{
        role:    "user",
        content: `You are a creative director for a lyric video project. The artist wants to create a cinematic lyric video for their track "${body.trackTitle}". Write a brief, enthusiastic opening message (2-3 sentences max) asking them about their creative vision — mood, aesthetic, themes, colors, feeling. Be concise, warm, creative.`,
      }],
    });
    const text = (response.content[0] as { text?: string })?.text;
    if (text) greeting = text;
  } catch { /* fallback to default greeting */ }

  return NextResponse.json({ jobId: job.id, greeting });
}
