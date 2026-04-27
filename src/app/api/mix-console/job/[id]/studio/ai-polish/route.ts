/**
 * POST /api/mix-console/job/[id]/studio/ai-polish
 *
 * Full-mix AI Polish — Opus call that reasons over the entire studio
 * state (every stem + master) and returns a coordinated patch nudging
 * the whole mix toward Claude's idea of "polished" given the analysis,
 * genre, and artist's vibe choice.
 *
 * Where AI Assist (Haiku) is a quick per-stem nudge, AI Polish is the
 * heavyweight: it sees the relationships between stems and tweaks them
 * together (e.g. duck the bass when the kick is too punchy, lift the
 * vocal if the master is dense).
 *
 * Auth: subscriber session must own the job. Pro tier required.
 *
 * Body: {
 *   global: Record<role, StemState>,
 *   master: MasterState,
 *   aiOriginals?: Record<role, AiOriginal>,
 *   sectionName?: string | null,    // if set, only patches the section override
 * }
 *
 * Returns: {
 *   stemPatches: Record<role, Partial<StemState>>,
 *   masterPatch: Partial<MasterState>,
 *   note: string
 * }
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

interface MasterStateInput {
  volumeDb:     number;
  stereoWidth:  number;
  eq:           [number, number, number, number, number];
  aiIntensity:  number;
}

interface AiPolishBody {
  global:        Record<string, StemStateInput>;
  master:        MasterStateInput;
  aiOriginals?:  Record<string, unknown>;
  sectionName?:  string | null;
}

interface StemPatch {
  gainDb?:     number;
  pan?:        number;
  reverb?:     number;
  delay?:      number;
  comp?:       number;
  brightness?: number;
}

interface MasterPatch {
  volumeDb?:    number;
  stereoWidth?: number;
  eq?:          [number, number, number, number, number];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeStemPatch(raw: unknown): StemPatch {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const out: StemPatch = {};
  if (typeof p.gainDb     === "number") out.gainDb     = clamp(p.gainDb,     -12,  6);
  if (typeof p.pan        === "number") out.pan        = clamp(p.pan,        -1,   1);
  if (typeof p.reverb     === "number") out.reverb     = clamp(p.reverb,      0, 100);
  if (typeof p.delay      === "number") out.delay      = clamp(p.delay,       0, 100);
  if (typeof p.comp       === "number") out.comp       = clamp(p.comp,        0, 100);
  if (typeof p.brightness === "number") out.brightness = clamp(p.brightness,  0, 100);
  return out;
}

function sanitizeMasterPatch(raw: unknown): MasterPatch {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const out: MasterPatch = {};
  if (typeof p.volumeDb    === "number") out.volumeDb    = clamp(p.volumeDb,    -12,   6);
  if (typeof p.stereoWidth === "number") out.stereoWidth = clamp(p.stereoWidth,   0, 150);
  if (Array.isArray(p.eq) && p.eq.length === 5 && p.eq.every((v) => typeof v === "number")) {
    out.eq = (p.eq as number[]).map((v) => clamp(v, -6, 6)) as [number, number, number, number, number];
  }
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
  if (!job)                            return NextResponse.json({ error: "not found" },         { status: 404 });
  if (job.userId !== session.user.id)  return NextResponse.json({ error: "forbidden" },         { status: 403 });
  if (job.tier   !== "PRO")            return NextResponse.json({ error: "pro tier required" }, { status: 403 });

  let body: AiPolishBody;
  try { body = (await req.json()) as AiPolishBody; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body?.global || typeof body.global !== "object" || !body?.master) {
    return NextResponse.json({ error: "missing global or master" }, { status: 400 });
  }

  const ad   = (job.analysisData as { bpm?: number; lufs?: number } | null) ?? null;
  const bpm  = typeof ad?.bpm  === "number" ? Math.round(ad.bpm)  : null;
  const lufs = typeof ad?.lufs === "number" ? Math.round(ad.lufs) : null;

  const roles = Object.keys(body.global);

  const prompt = [
    "You are a senior mix engineer doing a full-mix polish pass.",
    "Return ONLY valid JSON, no prose, no code fences.",
    "",
    "JSON shape:",
    "{",
    '  "stemPatches": { "<role>": { gainDb?, pan?, reverb?, delay?, comp?, brightness? }, ... },',
    '  "masterPatch": { volumeDb?, stereoWidth?, eq? },',
    '  "note": "1-2 sentences — under 180 chars — what you changed and why"',
    "}",
    "",
    "Field domains (knob = 0..100, 50 = AI's setting; gain in dB):",
    "  stem.gainDb       -6..+4 (delta from AI mix; small steps)",
    "  stem.pan          -1..+1 absolute",
    "  stem.reverb       0..100 (move 5..20 units)",
    "  stem.delay        0..100",
    "  stem.comp         0..100",
    "  stem.brightness   0..100 (50 = flat)",
    "  master.volumeDb   -6..+4",
    "  master.stereoWidth 0..150 (% of normal width; 100 = neutral)",
    "  master.eq         [bass, warmth, body, presence, sparkle] each -6..+6 dB",
    "",
    "Rules:",
    "  - Be coordinated. Think about how stems sit together (vocal vs bass vs drums).",
    "  - Don't touch dryWet, muted, or soloed.",
    "  - Only include fields that should change. Empty objects are fine.",
    "  - Don't propose more than 6 stem field changes total across the whole mix.",
    "  - The artist already shipped this through Claude once — don't undo the AI's work,",
    "    just refine it for cohesion.",
    "",
    `Track: bpm=${bpm ?? "unknown"}, lufs=${lufs ?? "unknown"}, genre=${job.genre ?? "unknown"}, vibe=${job.mixVibe ?? "AUTO"}.`,
    body.sectionName
      ? `Editing scope: SECTION OVERRIDE for "${body.sectionName}" only.`
      : "Editing scope: GLOBAL mix.",
    "",
    `Stems (${roles.length}): ${roles.join(", ")}`,
    `Current state: ${JSON.stringify({ global: body.global, master: body.master })}`,
    body.aiOriginals ? `AI originals: ${JSON.stringify(body.aiOriginals)}` : "",
    "",
    "Now return the JSON.",
  ].filter(Boolean).join("\n");

  const stemPatches: Record<string, StemPatch> = {};
  let masterPatch: MasterPatch = {};
  let note = "";
  try {
    const msg = await client.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 4000,
      thinking:   { type: "enabled", budget_tokens: 4000 },
      messages:   [{ role: "user", content: prompt }],
    });
    const textBlock = msg.content.find((b) => b.type === "text") as
      { type: "text"; text: string } | undefined;
    const raw = (textBlock?.text ?? "{}").trim();
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      stemPatches?: unknown;
      masterPatch?: unknown;
      note?:        unknown;
    };
    if (parsed.stemPatches && typeof parsed.stemPatches === "object") {
      const sp = parsed.stemPatches as Record<string, unknown>;
      for (const role of roles) {
        if (sp[role]) {
          const sanitized = sanitizeStemPatch(sp[role]);
          if (Object.keys(sanitized).length > 0) stemPatches[role] = sanitized;
        }
      }
    }
    masterPatch = sanitizeMasterPatch(parsed.masterPatch);
    if (typeof parsed.note === "string") note = parsed.note.slice(0, 220);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[mix-console/ai-polish] ${m.slice(0, 200)}`);
    // Fallback to Sonnet without thinking so the user still gets *something*.
    try {
      const fb = await client.messages.create({
        model:      "claude-sonnet-4-5",
        max_tokens: 3000,
        messages:   [{ role: "user", content: prompt }],
      });
      const fbTxt = fb.content.find((b) => b.type === "text") as
        { type: "text"; text: string } | undefined;
      const cleaned = (fbTxt?.text ?? "{}").trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned) as {
        stemPatches?: unknown;
        masterPatch?: unknown;
        note?:        unknown;
      };
      if (parsed.stemPatches && typeof parsed.stemPatches === "object") {
        const sp = parsed.stemPatches as Record<string, unknown>;
        for (const role of roles) {
          if (sp[role]) {
            const cleaned = sanitizeStemPatch(sp[role]);
            if (Object.keys(cleaned).length > 0) stemPatches[role] = cleaned;
          }
        }
      }
      masterPatch = sanitizeMasterPatch(parsed.masterPatch);
      if (typeof parsed.note === "string") note = parsed.note.slice(0, 220);
    } catch (err2) {
      const m2 = err2 instanceof Error ? err2.message : String(err2);
      console.error(`[mix-console/ai-polish:fallback] ${m2.slice(0, 200)}`);
      return NextResponse.json({ error: "ai polish failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ stemPatches, masterPatch, note });
}
