import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await db.aIGeneration.findMany({
    where: { artistId: session.user.id, type: "AAR_REPORT" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    artistName?: string;
    genre?: string;
    bio?: string;
    trackUrls?: string[];
    targetMarket?: string;
  };

  if (!body.artistName?.trim()) {
    return NextResponse.json({ error: "Artist name is required." }, { status: 400 });
  }

  const job = await db.aIGeneration.create({
    data: {
      artistId: session.user.id,
      type: "AAR_REPORT",
      status: "QUEUED",
      inputData: {
        artistName: body.artistName.trim(),
        genre: body.genre?.trim() ?? "",
        bio: body.bio?.trim() ?? "",
        trackUrls: (body.trackUrls ?? []).filter(u => u.trim()),
        targetMarket: body.targetMarket?.trim() ?? "",
      },
    },
  });

  generateARReport(
    job.id,
    body.artistName.trim(),
    body.genre?.trim() ?? "",
    body.bio?.trim() ?? "",
    (body.trackUrls ?? []).filter(u => u.trim()),
    body.targetMarket?.trim() ?? ""
  ).catch(console.error);

  return NextResponse.json({ jobId: job.id, status: "QUEUED" });
}

async function generateARReport(
  jobId: string,
  artistName: string,
  genre: string,
  bio: string,
  trackUrls: string[],
  targetMarket: string
) {
  try {
    await db.aIGeneration.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const trackSection = trackUrls.length > 0
      ? `\nTrack URLs for reference:\n${trackUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : "";

    const prompt = `You are an experienced A&R executive at a major record label. Write a professional A&R report for the following independent artist. Be specific, direct, and actionable — avoid generic praise. Use markdown formatting with headers.

Artist: ${artistName}
Genre: ${genre || "Not specified"}
${bio ? `Bio: ${bio}` : ""}${trackSection}
${targetMarket ? `Target Market: ${targetMarket}` : ""}

Write the report with the following sections:
1. **Executive Summary** — 2-3 sentence overview of the artist's commercial and artistic potential
2. **Market Position** — Where this artist sits in the current market, comparable artists, and timing
3. **Strengths** — Specific, concrete strengths (sound, branding, audience connection, etc.)
4. **Areas for Development** — Honest assessment of what needs work before a label would commit
5. **Streaming & Audience Potential** — Estimate of streaming performance trajectory and audience demographics
6. **A&R Recommendation** — Clear recommendation: Pass, Watch List, or Priority Sign — with reasoning
7. **Suggested Next Steps** — 3-5 concrete actions the artist should take in the next 90 days

Keep the total report concise and under 600 words. Be honest — the best A&R reports are direct, not flattering.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error((err?.error as { message?: string })?.message ?? `Anthropic error ${res.status}`);
    }

    const data = await res.json() as {
      content: { type: string; text: string }[];
    };
    const report = data.content.find(c => c.type === "text")?.text ?? "";

    if (!report) throw new Error("No report content returned");

    await db.aIGeneration.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        outputData: { report, artistName, genre },
      },
    });
  } catch (err) {
    await db.aIGeneration.update({
      where: { id: jobId },
      data: { status: "FAILED", outputData: { error: String(err) } },
    });
  }
}
