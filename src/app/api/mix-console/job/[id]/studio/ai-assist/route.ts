/**
 * POST /api/mix-console/job/[id]/studio/ai-assist
 *
 * Per-stem AI Assist — Haiku call invoked when the artist clicks the
 * sparkle button on a ChannelStrip. Looks at the stem's current settings
 * + the AI Original + the surrounding mix context, and returns a small
 * patch nudging the knobs in the direction Claude thinks fits the role.
 *
 * Cheap (Haiku) so the sparkle feels instant — it's a polish nudge, not
 * a full re-decision. AI Polish (step 21) is the Opus variant that
 * touches the whole mix and reasons longer.
 *
 * Auth: subscriber session must own the job. Pro tier required.
 *
 * Body: { role, currentStem, aiOriginal, sectionName }
 * Returns: { patch: Partial<StemState>, note: string }
 */

import { NextResponse } from "next/server";
import Anthropic        from "@anthropic-ai/sdk";
import { auth }         from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface StemStateInput {
  gainDb:     number;
  pan:        number;
  reverb:     number;
  delay:      number;
  comp:       number;
  brightness: number;
  dryWet:     number;
  muted:      boolean;
  soloed:     boolean;
}

interface AiOriginalInput {
  gainDb:     number;
  pan:        number;
  reverb:     number;
  reverbType: "plate" | "room" | "hall" | "cathedral" | "dry";
  brightness: number;
  delay:      number;
  comp:       number;
}

interface AiAssistBody {
  role:         string;
  currentStem:  StemStateInput;
  aiOriginal?:  AiOriginalInput;
  sectionName?: string | null;
}

interface AiAssistPatch {
  gainDb?:     number;
  pan?:        number;
  reverb?:     number;
  delay?:      number;
  comp?:       number;
  brightness?: number;
  dryWet?:     number;
}

/** Hard clamp the patch so a hallucinated value can't blow the user's ears. */
function sanitizePatch(raw: unknown): AiAssistPatch {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const out: AiAssistPatch = {};
  if (typeof p.gainDb     === "number") out.gainDb     = Math.max(-12, Math.min( 6,  p.gainDb));
  if (typeof p.pan        === "number") out.pan        = Math.max(-1,  Math.min( 1,  p.pan));
  if (typeof p.reverb     === "number") out.reverb     = Math.max( 0,  Math.min(100, p.reverb));
  if (typeof p.delay      === "number") out.delay      = Math.max( 0,  Math.min(100, p.delay));
  if (typeof p.comp       === "number") out.comp       = Math.max( 0,  Math.min(100, p.comp));
  if (typeof p.brightness === "number") out.brightness = Math.max( 0,  Math.min(100, p.brightness));
  if (typeof p.dryWet     === "number") out.dryWet     = Math.max( 0,  Math.min(100, p.dryWet));
  return out;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const job    = await prisma.mixJob.findUnique({
    where:  { id },
    select: {
      id: true, userId: true, tier: true, status: true,
      genre: true, mixVibe: true, analysisData: true,
    },
  });
  if (!job)                            return NextResponse.json({ error: "not found" },          { status: 404 });
  if (job.userId !== session.user.id)  return NextResponse.json({ error: "forbidden" },          { status: 403 });
  if (job.tier   !== "PRO")            return NextResponse.json({ error: "pro tier required" },  { status: 403 });

  let body: AiAssistBody;
  try { body = (await req.json()) as AiAssistBody; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body?.role || !body?.currentStem) {
    return NextResponse.json({ error: "missing role or currentStem" }, { status: 400 });
  }

  const role        = body.role;
  const cur         = body.currentStem;
  const ai          = body.aiOriginal ?? null;
  const sectionName = body.sectionName ?? null;

  // Pull a few facts from analysis to ground Claude's nudge.
  const ad = (job.analysisData as { bpm?: number; lufs?: number } | null) ?? null;
  const bpm  = typeof ad?.bpm  === "number" ? Math.round(ad.bpm)  : null;
  const lufs = typeof ad?.lufs === "number" ? Math.round(ad.lufs) : null;

  // Knob domain: 0..100 with 50 = AI's setting (delta), gainDb = dB delta from AI.
  const prompt = [
    "You are a senior mix engineer doing a single-stem polish nudge.",
    "Return ONLY valid JSON, no prose, no code fences.",
    "",
    "JSON shape: {\"patch\":{...},\"note\":\"one short sentence — under 90 chars\"}",
    "Patch fields are all OPTIONAL. Include only what should change.",
    "  gainDb:     dB delta from AI mix. Range -6..+4. Small steps, usually -2..+2.",
    "  pan:        absolute -1..+1.",
    "  reverb:     0..100, 50 = AI's setting. Move 5..20 units.",
    "  delay:      0..100, 50 = AI's setting.",
    "  comp:       0..100, 50 = AI's setting.",
    "  brightness: 0..100, 50 = flat / AI's high-shelf.",
    "",
    "Be conservative. The artist already loves the AI mix overall — they just",
    "want this one stem nudged. 1-3 patch fields max. Don't touch dryWet.",
    "",
    `Track context: bpm=${bpm ?? "unknown"}, lufs=${lufs ?? "unknown"}, genre=${job.genre ?? "unknown"}, vibe=${job.mixVibe ?? "AUTO"}.`,
    sectionName ? `Editing scope: SECTION OVERRIDE for "${sectionName}" only.` : "Editing scope: GLOBAL mix.",
    "",
    `Stem role:        ${role}`,
    `Current state:    ${JSON.stringify(cur)}`,
    ai ? `AI original:      ${JSON.stringify(ai)}` : "AI original:      (unknown)",
    "",
    "Now return the JSON.",
  ].join("\n");

  let patch: AiAssistPatch = {};
  let note = "";
  try {
    const msg = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 400,
      messages:   [{ role: "user", content: prompt }],
    });
    const textBlock = msg.content.find((b) => b.type === "text") as
      { type: "text"; text: string } | undefined;
    const raw = (textBlock?.text ?? "{}").trim();
    // Strip accidental code fences just in case.
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { patch?: unknown; note?: unknown };
    patch = sanitizePatch(parsed.patch);
    if (typeof parsed.note === "string") note = parsed.note.slice(0, 140);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[mix-console/ai-assist] ${role}: ${m.slice(0, 200)}`);
    return NextResponse.json({ error: "ai assist failed" }, { status: 502 });
  }

  return NextResponse.json({ patch, note });
}
