/**
 * src/lib/audio/replicate-analysis.ts
 *
 * Calls the indiethis audio analysis model on Replicate.
 * Replaces node-web-audio-api + essentia.js which cannot run on Vercel
 * (requires libasound.so.2 — Linux ALSA — not available in serverless).
 *
 * Env vars required:
 *   REPLICATE_API_TOKEN  — Replicate API key
 *   REPLICATE_MODEL_VERSION — model version ID (e.g. "abc123...")
 */

export interface AudioAnalysisResult {
  bpm:          number;
  musicalKey:   string;
  energy:       number;
  genres:       { label: string; score: number }[];
  moods:        { label: string; score: number }[];
  instruments:  { label: string; score: number }[];
  danceability: number;
  isVocal:      boolean;
  isTonal:      boolean;
}

/**
 * Run full audio analysis on Replicate.
 * Returns null on failure — callers must handle gracefully.
 * Blocks until the prediction completes (synchronous polling).
 * Typical latency: 15-45s cold, 5-15s warm.
 */
export async function analyzeAudioOnReplicate(
  audioUrl: string,
): Promise<AudioAnalysisResult | null> {
  const token   = process.env.REPLICATE_API_TOKEN;
  const version = process.env.REPLICATE_MODEL_VERSION;

  if (!token || !version) {
    console.error("[replicate] Missing REPLICATE_API_TOKEN or REPLICATE_MODEL_VERSION");
    return null;
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type":  "application/json",
  };

  // ── 1. Create prediction ───────────────────────────────────────────────────
  let predictionId: string;
  try {
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method:  "POST",
      headers,
      body: JSON.stringify({
        version: version,
        input:   { audio_url: audioUrl },
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.text();
      console.error(`[replicate] Create prediction failed ${createRes.status}:`, body);
      return null;
    }

    const prediction = await createRes.json() as { id: string; status: string };
    predictionId = prediction.id;
    console.log(`[replicate] Prediction created: ${predictionId}`);
  } catch (err) {
    console.error("[replicate] Create prediction threw:", err);
    return null;
  }

  // ── 2. Poll until complete ─────────────────────────────────────────────────
  const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
  const maxWait = 240_000; // 4 minutes
  const pollInterval = 3_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    try {
      const pollRes = await fetch(pollUrl, { headers });
      if (!pollRes.ok) continue;

      const data = await pollRes.json() as {
        status: string;
        output?: AudioAnalysisResult;
        error?: string;
      };

      if (data.status === "succeeded") {
        console.log(`[replicate] Prediction ${predictionId} succeeded in ${Date.now() - start}ms`);
        return data.output ?? null;
      }

      if (data.status === "failed" || data.status === "canceled") {
        console.error(`[replicate] Prediction ${predictionId} ${data.status}:`, data.error);
        return null;
      }

      // still processing — continue polling
    } catch (err) {
      console.error("[replicate] Poll threw:", err);
    }
  }

  console.error(`[replicate] Prediction ${predictionId} timed out after ${maxWait}ms`);
  return null;
}
