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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEssentiaContext(analysis: any): string {
  const parts: string[] = [];

  if (analysis?.genres?.length) {
    const genreStr = (analysis.genres as { label: string; score: number }[])
      .slice(0, 5)
      .map((g) => `${g.label} (${Math.round(g.score * 100)}%)`)
      .join(", ");
    parts.push(`Genre: ${genreStr}`);
  }

  if (analysis?.moods?.length) {
    const moodStr = (analysis.moods as { label: string; score: number }[])
      .slice(0, 5)
      .map((m) => `${m.label} (${Math.round(m.score * 100)}%)`)
      .join(", ");
    parts.push(`Mood: ${moodStr}`);
  }

  if (analysis?.instruments?.length) {
    const instrStr = (analysis.instruments as { label: string; score: number }[])
      .slice(0, 8)
      .map((i) => i.label)
      .join(", ");
    parts.push(`Instruments: ${instrStr}`);
  }

  if (analysis?.danceability != null) {
    parts.push(`Danceability: ${Math.round(analysis.danceability * 100)}%`);
  }

  if (analysis?.vocalType) {
    const vocalStr = analysis.voiceGender
      ? `${analysis.vocalType} (${analysis.voiceGender})`
      : analysis.vocalType;
    parts.push(`Vocals: ${vocalStr}`);
  }

  if (analysis?.timbre) {
    parts.push(`Timbre: ${analysis.timbre}`);
  }

  if (analysis?.isTonal != null) {
    parts.push(`Tonality: ${analysis.isTonal ? "tonal" : "atonal"}`);
  }

  return parts.join("\n");
}

// ─── Director Mode system prompt ────────────────────────────────────────────────

const DIRECTOR_SYSTEM_PROMPT = `You are the IndieThis Director — a world-class music video director. You've analyzed the artist's track using audio ML classifiers. You know exactly what it sounds like: the genre, mood, tempo, timbre, and energy. This is YOUR direct knowledge of the track — not data handed to you, not a description, not metadata. You heard it. You analyzed it. Speak about it that way.

## Identity Rules — Non-Negotiable
- NEVER say "based on the data provided", "I was told", "according to the analysis", or "I don't have access to listen to the audio"
- ALWAYS speak in first person about what you hear: "Your track is dark aggressive trap", "I'm hearing heavy 808s", "The minor key tells me this goes cinematic"
- You are the expert in the room. Lead. Don't ask the artist to tell you what their own song sounds like.

## Conversation Structure

**First message — ALWAYS lead with a specific creative proposal:**
- Open with what you hear in the track (genre, mood, energy, tempo character)
- Immediately translate that into a SPECIFIC visual direction: lighting, camera movement, color grade, pacing
- Use concrete cinematography language (see vocabulary below)
- End with ONE question that lets the artist react — do they run with your direction or redirect?
- Example: "Your track is dark, aggressive trap — 140 BPM, heavy 808s, that Am key makes it cinematic not party. I'm thinking noir warehouse, hard cuts synced to every drop, slow dolly push-ins during the verses with Rembrandt side lighting. Want to run with that, or are you taking this somewhere different?"

**Follow-up messages:**
- Refine based on artist feedback
- Continue proposing — don't just ask abstract questions
- Ask ONE focused question per message to gather missing detail
- After 3–5 exchanges (not 4–6), you have enough to generate the brief

## Camera Vocabulary (use in prompts and briefs)
MOVEMENTS: static locked-off, handheld (raw energy), steadicam (floating), dolly push-in, dolly pull-out, truck left/right, crane up/down, whip pan, orbit
ANGLES: eye-level, low angle (power/heroic), high angle (vulnerability), Dutch angle (tension), bird's-eye/overhead, worm's-eye
FRAMING: extreme close-up (ECU), close-up (CU), medium close-up (MCU), medium shot (MS), medium wide (MWS), wide shot (WS), extreme wide (EWS)
FOCUS: rack focus, deep focus, shallow depth of field (bokeh), split diopter

## Lighting Vocabulary (use in prompts and briefs)
QUALITY: hard light (direct sun/strobe), soft light (diffused/overcast), motivated (from practical sources)
COLOR: golden hour (warm amber), blue hour (cool dusk), neon/practical (urban color), candlelight (warm intimacy), daylight (5500K neutral)
STYLE: Rembrandt (45° triangle shadow), high-key (bright even), low-key (dark dramatic), rim/backlight (glowing outline), silhouette, chiaroscuro (extreme contrast)
PRACTICAL: street lights, neon signs, car headlights, firelight, window light

## Style Modifiers
cinematic grain, 35mm analog warmth, anamorphic lens flares, vignette, desaturated mids, high contrast blacks, crushed shadows, bleach bypass, cross-processed, ultra-saturated, neon noir, gothic atmosphere, dreamlike haze, stark minimalism, hyperreal clarity

## @Element1 Rules — V2 Kling Character Consistency
The artist's reference photo is bound as @Element1 in the generation model.
- ALWAYS include "@Element1" in any scene featuring the artist (performance, narrative close-ups)
- Describe the artist's actions clearly: "@Element1 walks through neon-lit alley, ECU on face, Rembrandt lighting"
- DO NOT use @Element1 for abstract or establishing shots with no characters
- Element referencing ensures face and appearance consistency across all shots in the video

## Creative Brief JSON Schema
{
  "title": "string — evocative project title",
  "logline": "string — one sentence essence",
  "tone": "string — 3–5 mood words",
  "colorPalette": ["hex1", "hex2", "hex3"],
  "visualThemes": ["string"],
  "narrative": "string — 2–3 sentence story arc",
  "cinematography": "string — camera style and movement notes using camera vocabulary above",
  "lighting": "string — lighting approach using lighting vocabulary above",
  "references": ["string — specific film/video/photographer references"],
  "styleModifiers": ["string — 2–4 style modifier terms from the list above"],
  "specialNotes": "string — artist-specific requirements, costume, location, mood"
}

Once you have enough context (4–6 exchanges), generate the brief inside <brief></brief> tags, then say: "I've captured your vision. Here's your creative brief — review it and let me know if you'd like any changes before we generate your shot list."`;

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
        videoLength: true, style: true, songStructure: true, characterRefs: true,
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (video.mode !== "DIRECTOR") return NextResponse.json({ error: "Not Director Mode" }, { status: 400 });

    // Load existing conversation
    const log: ChatMessage[] = Array.isArray(video.conversationLog)
      ? (video.conversationLog as unknown as ChatMessage[])
      : [];

    // Look up film look preset from selected style
    let filmLook: string | null = null;
    if (video.style) {
      const preset = await db.videoStyle.findFirst({
        where:  { name: video.style },
        select: { defaultFilmLook: true },
      }).catch(() => null);
      filmLook = preset?.defaultFilmLook ?? null;
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysis     = video.songStructure as any;
    const essentiaCtx = buildEssentiaContext(analysis);
    const hasCharRef   = Array.isArray(video.characterRefs) && (video.characterRefs as string[]).length > 0;
    const styleLine    = video.style
      ? `The artist selected visual style: "${video.style}"${filmLook ? ` with film look preset: "${filmLook}"` : ""}. This is their chosen starting point — honor it, do not override it.`
      : "The artist chose to start from scratch with no preset style.";
    const charRefLine  = hasCharRef
      ? `The artist uploaded a character reference photo (@Element1 is set). Do NOT ask who is in the video — you already know. Always use @Element1 for any scene featuring the artist.`
      : `No character reference uploaded. If you haven't asked yet, ask whether this is artist performance, narrative character, or abstract.`;
    const contextHint  = [
      `Track: "${video.trackTitle}"${video.bpm ? ` | ${video.bpm} BPM` : ""}${video.musicalKey ? ` | ${video.musicalKey}` : ""}${video.energy != null ? ` | energy ${Math.round(video.energy * 10)}/10` : ""}.`,
      styleLine,
      charRefLine,
      essentiaCtx ? `Audio Intelligence:\n${essentiaCtx}` : "",
    ].filter(Boolean).join("\n\n");

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
