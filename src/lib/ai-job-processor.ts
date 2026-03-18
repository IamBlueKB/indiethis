/**
 * ai-job-processor.ts — Unified AI job processor / router
 *
 * processAIJob(jobId):
 *   1. Loads the AIJob from the database.
 *   2. Sets status → PROCESSING.
 *   3. Routes to the correct handler based on job.type.
 *   4. On success  → sets status COMPLETE + stores outputData + completedAt.
 *   5. On failure  → sets status FAILED + stores errorMessage.
 *
 * Provider integrations:
 *   Step 4  — AR_REPORT:   Whisper (transcription) + Dolby analyzeMusic + Claude Sonnet
 *   Step 5+ — remaining handlers wired in subsequent steps
 */

import { db } from "@/lib/db";
import { AIJobStatus, type AIJob } from "@prisma/client";
import OpenAI, { toFile } from "openai";
import * as dolbyClient from "@dolbyio/dolbyio-rest-apis-client";
import { claude, SONNET } from "@/lib/claude";

// ─── Handler result type ──────────────────────────────────────────────────────

type HandlerResult = {
  outputData: Record<string, unknown>;
  costToUs?: number; // actual provider cost in dollars
};

// ─── Stub handlers (replaced in later steps) ─────────────────────────────────

async function handleVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing VIDEO job ${job.id} via ${job.provider}`);
  // Step 4: wire Runway Gen-3 here
  return { outputData: { stub: true, type: "VIDEO" } };
}

async function handleCoverArt(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing COVER_ART job ${job.id} via ${job.provider}`);
  // Step 5: wire Replicate (SDXL / Flux) here
  return { outputData: { stub: true, type: "COVER_ART" } };
}

async function handleMastering(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing MASTERING job ${job.id} via ${job.provider}`);
  // Step 6: wire Dolby.io mastering here
  return { outputData: { stub: true, type: "MASTERING" } };
}

async function handleLyricVideo(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing LYRIC_VIDEO job ${job.id} via ${job.provider}`);
  // Step 7: wire Remotion Lambda here
  return { outputData: { stub: true, type: "LYRIC_VIDEO" } };
}

async function handleARReport(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing AR_REPORT job ${job.id} via ${job.provider}`);

  // ── Env checks — fail fast with actionable messages ──────────────────────
  const openaiKey  = process.env.OPENAI_API_KEY;
  const dolbyKey   = process.env.DOLBY_API_KEY   ?? process.env.DOLBY_APP_KEY;
  const dolbySecret= process.env.DOLBY_API_SECRET ?? process.env.DOLBY_APP_SECRET;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey   || openaiKey.startsWith("your_"))
    throw new Error("OPENAI_API_KEY is not configured — add it to .env.local to use the A&R Report.");
  if (!dolbyKey    || dolbyKey.startsWith("your_"))
    throw new Error("DOLBY_API_KEY is not configured — add it to .env.local to use the A&R Report.");
  if (!dolbySecret || dolbySecret.startsWith("your_"))
    throw new Error("DOLBY_API_SECRET is not configured — add it to .env.local to use the A&R Report.");
  if (!anthropicKey || anthropicKey.startsWith("sk-ant-api") === false && anthropicKey === "sk-ant-...")
    throw new Error("ANTHROPIC_API_KEY is not configured — add it to .env.local to use the A&R Report.");

  // ── Extract job inputs ────────────────────────────────────────────────────
  const input = (job.inputData ?? {}) as Record<string, string>;
  const { trackUrl, genre, artistBio, targetMarket, comparableArtists } = input;

  if (!trackUrl) throw new Error("AR_REPORT job missing required input: trackUrl");

  let totalCost = 0;

  // ── Step 1: Whisper transcription ─────────────────────────────────────────
  console.log(`[ar-report] transcribing audio via Whisper: ${trackUrl}`);
  const openai = new OpenAI({ apiKey: openaiKey });

  // Fetch the audio file from its URL and pass as a File to Whisper
  const audioResponse = await fetch(trackUrl);
  if (!audioResponse.ok) throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`);
  const audioBuffer  = await audioResponse.arrayBuffer();
  const audioName    = trackUrl.split("/").pop() ?? "track.mp3";
  const audioFile    = await toFile(Buffer.from(audioBuffer), audioName, {
    type: audioResponse.headers.get("content-type") ?? "audio/mpeg",
  });

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file:  audioFile,
    response_format: "verbose_json",   // includes segments with timestamps
    timestamp_granularities: ["segment"],
  });

  // Estimate Whisper cost: $0.006 per minute
  const audioDurationMinutes = (transcription.duration ?? 180) / 60;
  totalCost += audioDurationMinutes * 0.006;

  const lyrics    = transcription.text ?? "(No lyrics detected — instrumental or transcription failed)";
  const segments  = (transcription.segments ?? []) as Array<{ start: number; end: number; text: string }>;
  const lyricsWithTimestamps = segments.length > 0
    ? segments.map((s) => `[${s.start.toFixed(1)}s] ${s.text.trim()}`).join("\n")
    : lyrics;

  console.log(`[ar-report] Whisper complete — ${audioDurationMinutes.toFixed(1)} min, ${lyrics.length} chars`);

  // ── Step 2: Dolby analyzeMusic ────────────────────────────────────────────
  console.log(`[ar-report] analyzing audio via Dolby analyzeMusic`);

  let audioAnalysis: Record<string, unknown> = {};

  try {
    // Get Dolby access token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dolbyToken: any = await dolbyClient.media.authentication.getApiAccessToken(
      dolbyKey,
      dolbySecret,
      1800,
    );

    // Build the analyze job body
    const analyzeBody = JSON.stringify({
      inputs:  [{ source: trackUrl }],
      outputs: [{ destination: `dlb://ar-report-${job.id}` }],
    });

    // Start analyze job
    const analyzeJobId = await dolbyClient.media.analyzeMusic.start(dolbyToken, analyzeBody) as string;
    console.log(`[ar-report] Dolby analyzeMusic job started: ${analyzeJobId}`);

    // Poll for results (max 3 minutes, 5-second intervals)
    const maxWaitMs  = 180_000;
    const pollMs     = 5_000;
    const started    = Date.now();
    let   analyzeResult: Record<string, unknown> | null = null;

    while (Date.now() - started < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollMs));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await dolbyClient.media.analyzeMusic.getResults(dolbyToken, analyzeJobId);
      const status = result?.status as string;

      if (status === "Success") {
        analyzeResult = result;
        break;
      }
      if (["Failed", "Canceled", "Expired"].includes(status)) {
        console.warn(`[ar-report] Dolby analyzeMusic ${status} — proceeding without audio analysis`);
        break;
      }
    }

    if (analyzeResult) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = analyzeResult as any;
      audioAnalysis = {
        loudness:      r?.result?.audio?.loudness?.measured     ?? null,
        truePeak:      r?.result?.audio?.loudness?.true_peak    ?? null,
        dynamicRange:  r?.result?.audio?.dynamics?.range        ?? null,
        noiseLevel:    r?.result?.audio?.noise?.snr_avg         ?? null,
        tempo:         r?.result?.music?.tempo?.bpm             ?? null,
        key:           r?.result?.music?.key?.value             ?? null,
        mode:          r?.result?.music?.key?.mode              ?? null,
        energy:        r?.result?.music?.energy?.value          ?? null,
        danceability:  r?.result?.music?.danceability?.value    ?? null,
      };
      // Dolby analyzeMusic: ~$0.003 per minute
      totalCost += audioDurationMinutes * 0.003;
    }
  } catch (dolbyErr: unknown) {
    // Non-fatal — proceed with what we have
    console.warn(`[ar-report] Dolby analyze error (non-fatal): ${dolbyErr instanceof Error ? dolbyErr.message : dolbyErr}`);
  }

  console.log(`[ar-report] audio analysis:`, audioAnalysis);

  // ── Step 3: Claude Sonnet — generate A&R report ───────────────────────────
  console.log(`[ar-report] generating report via Claude Sonnet`);

  const systemPrompt = `You are a music industry A&R consultant with 20 years of experience signing artists to major and independent labels. Analyze this track based on the lyrics, audio characteristics, and artist profile. Write a detailed report covering:

1. **Commercial Viability** — Is this track ready for radio, streaming playlists, or sync licensing? What would need to change?
2. **Lyrical Analysis** — Themes, storytelling quality, hook strength, word economy, emotional resonance.
3. **Sonic Quality Assessment** — Based on the audio measurements provided, assess the production quality, loudness compliance for streaming platforms, and tonal balance.
4. **Target Audience Recommendations** — Who is the primary audience? Age range, geography, platform (TikTok/Spotify/radio), lifestyle segments.
5. **Marketing Strategy Suggestions** — Concrete tactics for this specific track and artist profile. Playlist pitching angles, sync opportunities, brand partnership fits.
6. **Comparable Artist Positioning** — How does this artist sit relative to the market? Who are they most comparable to and what gaps do they fill?

Be specific and actionable, not generic. Reference actual data from the audio analysis and lyrics where possible. Format with clear section headers.`;

  const userMessage = `
**Artist Profile:**
- Genre: ${genre || "Not specified"}
- Bio: ${artistBio || "Not provided"}
- Target Market: ${targetMarket || "Not specified"}
- Comparable Artists: ${comparableArtists || "Not specified"}

**Audio Analysis (Dolby.io):**
- Integrated Loudness: ${audioAnalysis.loudness != null ? `${audioAnalysis.loudness} LUFS` : "Not available"}
- True Peak: ${audioAnalysis.truePeak != null ? `${audioAnalysis.truePeak} dBTP` : "Not available"}
- Dynamic Range: ${audioAnalysis.dynamicRange != null ? `${audioAnalysis.dynamicRange} LU` : "Not available"}
- Tempo: ${audioAnalysis.tempo != null ? `${audioAnalysis.tempo} BPM` : "Not available"}
- Key: ${audioAnalysis.key != null ? `${audioAnalysis.key} ${audioAnalysis.mode ?? ""}`.trim() : "Not available"}
- Energy: ${audioAnalysis.energy != null ? audioAnalysis.energy : "Not available"}
- Danceability: ${audioAnalysis.danceability != null ? audioAnalysis.danceability : "Not available"}
- Audio Duration: ${audioDurationMinutes.toFixed(1)} minutes

**Lyrics (transcribed via Whisper):**
${lyricsWithTimestamps}

Please write the A&R report now.`.trim();

  const claudeResponse = await claude.messages.create({
    model:      SONNET,
    max_tokens: 2048,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userMessage }],
  });

  const reportText = claudeResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Claude Sonnet cost: $3/MTok input, $15/MTok output
  const inputTokens  = claudeResponse.usage.input_tokens;
  const outputTokens = claudeResponse.usage.output_tokens;
  totalCost += (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

  console.log(
    `[ar-report] Claude complete — ${inputTokens} in / ${outputTokens} out tokens. ` +
    `Total cost: $${totalCost.toFixed(4)}`
  );

  return {
    outputData: {
      report:         reportText,
      lyrics,
      lyricsWithTimestamps,
      audioAnalysis,
      audioDurationMinutes,
      whisperModel:   "whisper-1",
      claudeModel:    SONNET,
      inputTokens,
      outputTokens,
    },
    costToUs: totalCost,
  };
}

async function handlePressKit(job: AIJob): Promise<HandlerResult> {
  console.log(`[ai-jobs] processing PRESS_KIT job ${job.id} via ${job.provider}`);
  // Step 9: wire Claude (Anthropic) here
  return { outputData: { stub: true, type: "PRESS_KIT" } };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function processAIJob(jobId: string): Promise<void> {
  // 1. Load job
  const job = await db.aIJob.findUnique({ where: { id: jobId } });

  if (!job) {
    console.error(`[ai-jobs] job ${jobId} not found`);
    return;
  }

  if (job.status !== AIJobStatus.QUEUED) {
    console.warn(`[ai-jobs] job ${jobId} is ${job.status} — skipping`);
    return;
  }

  // 2. Mark PROCESSING
  await db.aIJob.update({
    where: { id: jobId },
    data: { status: AIJobStatus.PROCESSING },
  });

  // 3. Route to handler
  try {
    let result: HandlerResult;

    switch (job.type) {
      case "VIDEO":
        result = await handleVideo(job);
        break;
      case "COVER_ART":
        result = await handleCoverArt(job);
        break;
      case "MASTERING":
        result = await handleMastering(job);
        break;
      case "LYRIC_VIDEO":
        result = await handleLyricVideo(job);
        break;
      case "AR_REPORT":
        result = await handleARReport(job);
        break;
      case "PRESS_KIT":
        result = await handlePressKit(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // 4. Mark COMPLETE
    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status:      AIJobStatus.COMPLETE,
        outputData:  result.outputData as import("@prisma/client").Prisma.InputJsonValue,
        costToUs:    result.costToUs ?? null,
        completedAt: new Date(),
      },
    });

    console.log(`[ai-jobs] job ${jobId} (${job.type}) COMPLETE`);

  } catch (err: unknown) {
    // 5. Mark FAILED
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-jobs] job ${jobId} FAILED: ${message}`);

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status:       AIJobStatus.FAILED,
        errorMessage: message,
        completedAt:  new Date(),
      },
    });
  }
}
