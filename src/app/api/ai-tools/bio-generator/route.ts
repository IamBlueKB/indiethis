/**
 * POST /api/ai-tools/bio-generator
 * Generates three bio versions (short / medium / full) using Claude.
 * Free tool — no charge — but limited to 5 uses per calendar day.
 * Available to both artists and studio admins.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claude, SONNET } from "@/lib/claude";

export const maxDuration = 60;

const DAILY_LIMIT = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const isStudio = session.user.role === "STUDIO_ADMIN";

  const body = await req.json() as {
    name?:       string;
    genre?:      string;
    vibe?:       string;        // artist: sound/vibe | studio: studio vibe
    location?:   string;
    influences?: string;
    achievements?: string;
    extra?:      string;       // any extra context
    targetAudience?: string;   // artist only
    studioServices?: string;   // studio only
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // ── Daily usage check ─────────────────────────────────────────────────────
  const usedToday = await db.aIJob.count({
    where: {
      triggeredById: userId,
      type:          "BIO_GENERATOR",
      createdAt:     { gte: todayStart() },
    },
  });

  if (usedToday >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `You've used all ${DAILY_LIMIT} free bio generations for today. Try again tomorrow.`, limitReached: true },
      { status: 429 }
    );
  }

  // ── Build prompt ─────────────────────────────────────────────────────────
  const entityType = isStudio ? "recording studio" : "independent music artist";

  const contextLines = [
    `Name: ${name}`,
    body.genre       ? `Genre / style: ${body.genre}` : null,
    body.vibe        ? (isStudio ? `Studio atmosphere / vibe: ${body.vibe}` : `Sound / vibe: ${body.vibe}`) : null,
    body.location    ? `Location: ${body.location}` : null,
    body.influences  ? `Influences: ${body.influences}` : null,
    body.achievements ? `Achievements / highlights: ${body.achievements}` : null,
    body.targetAudience && !isStudio ? `Target audience: ${body.targetAudience}` : null,
    body.studioServices && isStudio  ? `Services offered: ${body.studioServices}` : null,
    body.extra       ? `Additional context: ${body.extra}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are a professional music industry copywriter. Write three versions of a bio for the following ${entityType}. Return ONLY valid JSON — no markdown, no explanation.

${contextLines}

Return this exact JSON shape:
{
  "short": "1–2 sentence bio (50–80 words max) — punchy, hook-first, ideal for social media profiles",
  "medium": "2–3 paragraph bio (120–200 words) — for music platforms (Spotify, Apple Music, SoundCloud), press releases",
  "full": "3–5 paragraph bio (300–500 words) — detailed, narrative, ideal for EPK and website About page"
}

Rules:
- Write in third person
- Match the tone to the genre/vibe provided
- Do NOT use placeholder brackets like [City] or [Year] — if info is missing, omit gracefully
- Do NOT add commentary outside the JSON`;

  // ── Create job record (pending) ───────────────────────────────────────────
  const job = await db.aIJob.create({
    data: {
      type:          "BIO_GENERATOR",
      status:        "QUEUED",
      triggeredBy:   isStudio ? "STUDIO" : "ARTIST",
      triggeredById: userId,
      ...(isStudio ? { studioId: userId } : { artistId: userId }),
      provider:      "anthropic",
      inputData:     body as object,
    },
  });

  // ── Call Claude ──────────────────────────────────────────────────────────
  try {
    const message = await claude.messages.create({
      model:      SONNET,
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    });

    const rawText = message.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    // Parse JSON
    let bios: { short: string; medium: string; full: string };
    try {
      // Strip potential markdown code fences if model adds them
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      bios = JSON.parse(cleaned);
    } catch {
      throw new Error("Claude returned non-JSON response: " + rawText.slice(0, 200));
    }

    if (!bios.short || !bios.medium || !bios.full) {
      throw new Error("Claude response missing one or more bio versions.");
    }

    const inputTokens  = message.usage?.input_tokens  ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    const costToUs     = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15; // Sonnet pricing

    await db.aIJob.update({
      where: { id: job.id },
      data:  {
        status:     "COMPLETE",
        outputData: bios as object,
        costToUs,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      jobId: job.id,
      bios,
      usedToday: usedToday + 1,
      remainingToday: DAILY_LIMIT - (usedToday + 1),
    });

  } catch (err) {
    await db.aIJob.update({
      where: { id: job.id },
      data:  { status: "FAILED", errorMessage: String(err) },
    });
    return NextResponse.json(
      { error: "Bio generation failed. Please try again.", detail: String(err) },
      { status: 500 }
    );
  }
}

// ── GET: usage stats ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usedToday = await db.aIJob.count({
    where: {
      triggeredById: session.user.id,
      type:          "BIO_GENERATOR",
      createdAt:     { gte: todayStart() },
    },
  });

  return NextResponse.json({
    usedToday,
    dailyLimit: DAILY_LIMIT,
    remainingToday: Math.max(0, DAILY_LIMIT - usedToday),
  });
}
