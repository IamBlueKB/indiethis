import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { detectAudioFeaturesFromBuffer } from "@/lib/audio-analysis";
import { claude, SONNET } from "@/lib/claude";
import { validateUpload } from "@/lib/upload-validator";

/**
 * POST /api/dashboard/beats/describe
 *
 * Accepts a raw audio file (multipart FormData, field name "audio").
 * Runs BPM + key + energy detection, then calls Claude to generate a
 * 2–3 sentence beat marketplace description.
 *
 * Returns: { bpm: number|null, key: string|null, description: string|null }
 *
 * Never returns an error status — if analysis or Claude fails, the fields
 * come back as null so the client can silently leave them empty.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse audio file from FormData ────────────────────────────────────────
  let audioBuffer: ArrayBuffer;
  try {
    const form  = await req.formData();
    const file  = form.get("audio");
    if (!file || typeof file === "string") {
        return NextResponse.json({ bpm: null, key: null, description: null });
    }
    const audioFile = file as File;
    audioBuffer     = await audioFile.arrayBuffer();

    // ── Validate before analysis ─────────────────────────────────────────────
    const tmpPath = join(
      tmpdir(),
      `beat-describe-${randomUUID()}${extname(audioFile.name || ".mp3") || ".mp3"}`
    );
    await writeFile(tmpPath, Buffer.from(audioBuffer));
    const validation = await validateUpload(
      tmpPath,
      audioFile.name || "audio.mp3",
      audioFile.size,
      audioFile.type || "audio/mpeg",
      "audio"
    );
    await unlink(tmpPath).catch(() => {});
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  } catch (err) {
    console.error("[beats/describe] FormData parse error:", err);
    return NextResponse.json({ bpm: null, key: null, description: null });
  }

  // ── Audio analysis ─────────────────────────────────────────────────────────
  const { bpm, musicalKey, energy } = await detectAudioFeaturesFromBuffer(audioBuffer);


  // ── Build Claude prompt ───────────────────────────────────────────────────
  const energyLabel =
    energy === null    ? null
    : energy >= 0.70   ? "high energy"
    : energy >= 0.35   ? "medium energy"
    : "low energy, atmospheric";

  // Only call Claude if we have at least BPM or key — otherwise the prompt
  // is too vague to produce anything useful.
  const hasEnoughData = bpm !== null || musicalKey !== null;
  let description: string | null = null;

  if (hasEnoughData) {
    const bpmPart  = bpm         ? `${bpm} BPM`          : null;
    const keyPart  = musicalKey  ? `in ${musicalKey}`     : null;
    const energyPart = energyLabel ?? null;

    const featureLine = [bpmPart, keyPart, energyPart].filter(Boolean).join(", ");

    const prompt = `Write a 2–3 sentence beat marketplace description for a beat that is ${featureLine}.

Keep it concise, descriptive, and useful for an artist searching for beats. Mention the mood, energy, and what style of vocals would work well over it. No hype language. Output only the description — no title, no label, no quotes, no intro.`;

    try {
      const response = await claude.messages.create({
        model:      SONNET,
        max_tokens: 200,
        messages:   [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      if (text.length > 10) description = text;
    } catch {
      // Claude failed — description stays null, upload flow unaffected
    }
  }

  return NextResponse.json({ bpm, key: musicalKey, description });
}
