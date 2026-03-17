import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [jobs, subscription] = await Promise.all([
    db.aIGeneration.findMany({
      where: { artistId: session.user.id, type: "PRESS_KIT" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.subscription.findUnique({
      where: { userId: session.user.id },
      select: {
        tier: true,
        pressKitCreditsUsed: true,
        pressKitCreditsLimit: true,
      },
    }),
  ]);

  return NextResponse.json({ jobs, subscription });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    artistName?: string;
    genre?: string;
    location?: string;
    bio?: string;
    achievements?: string;
    trackList?: { title: string; url: string }[];
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    spotify?: string;
    appleMusic?: string;
    bookingEmail?: string;
    tone?: string;
  };

  if (!body.artistName?.trim()) {
    return NextResponse.json({ error: "Artist name is required." }, { status: 400 });
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: session.user.id },
    select: { pressKitCreditsUsed: true, pressKitCreditsLimit: true },
  });

  if (!subscription || subscription.pressKitCreditsUsed >= subscription.pressKitCreditsLimit) {
    return NextResponse.json({ error: "No press kit credits available. Purchase a press kit to continue." }, { status: 402 });
  }

  // Create job record
  const job = await db.aIGeneration.create({
    data: {
      artistId: session.user.id,
      type: "PRESS_KIT",
      status: "PROCESSING",
      inputData: body,
    },
  });

  // Generate press kit synchronously with Claude
  try {
    const tracks = (body.trackList ?? []).filter(t => t.title?.trim());
    const trackSection = tracks.length > 0
      ? tracks.map((t, i) => `${i + 1}. "${t.title}"${t.url ? ` — ${t.url}` : ""}`).join("\n")
      : "No tracks provided";

    const socialLinks = [
      body.instagram ? `Instagram: @${body.instagram}` : null,
      body.tiktok    ? `TikTok: @${body.tiktok}` : null,
      body.youtube   ? `YouTube: ${body.youtube}` : null,
      body.spotify   ? `Spotify: ${body.spotify}` : null,
      body.appleMusic? `Apple Music: ${body.appleMusic}` : null,
    ].filter(Boolean).join("\n");

    const prompt = `You are a professional music publicist writing an Electronic Press Kit (EPK) for a recording artist.

Artist details:
- Name: ${body.artistName}
- Genre: ${body.genre || "Not specified"}
- Location: ${body.location || "Not specified"}
- Bio: ${body.bio || "Not provided"}
- Notable achievements: ${body.achievements || "Not provided"}
- Tone/Style: ${body.tone || "Professional"}

Featured tracks:
${trackSection}

Social/streaming links:
${socialLinks || "Not provided"}
${body.bookingEmail ? `Booking contact: ${body.bookingEmail}` : ""}

Write a complete, professional EPK with the following sections. Use ## for section headers.

## Artist Overview
A compelling 2–3 paragraph bio written in third person. Make it engaging and industry-ready. Highlight the artist's unique sound, background, and artistic vision.

## Sound & Style
A concise description of the artist's sonic identity, influences, and what makes their music distinctive.

## Featured Music
A brief highlight of the featured tracks and what they showcase about the artist.

## Press Highlights
Write 2–3 fabricated but realistic-sounding press quotes from music blogs or publications praising the artist. Format each as: "Quote text." — Publication Name

## Booking & Contact
Professional contact block with booking info and social links.

## One-Sheet Summary
A single-paragraph executive summary suitable for pitching to labels, playlist curators, or venues.

Keep the tone ${body.tone?.toLowerCase() || "professional"} and industry-appropriate. Do not include placeholders like [insert here] — write complete, ready-to-use copy.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await response.json() as {
      content?: { type: string; text: string }[];
      error?: { message: string };
    };

    const pressKit = aiData.content?.[0]?.text ?? "";

    if (!pressKit) throw new Error(aiData.error?.message ?? "No content returned");

    // Decrement credit and update job atomically
    const [updatedJob] = await db.$transaction([
      db.aIGeneration.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          outputData: { pressKit, artistName: body.artistName, genre: body.genre },
        },
      }),
      db.subscription.update({
        where: { userId: session.user.id },
        data: { pressKitCreditsUsed: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ job: updatedJob }, { status: 201 });
  } catch (err) {
    await db.aIGeneration.update({
      where: { id: job.id },
      data: { status: "FAILED", outputData: { error: String(err) } },
    });
    return NextResponse.json({ error: "Press kit generation failed." }, { status: 500 });
  }
}
