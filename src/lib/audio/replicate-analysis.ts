/**
 * src/lib/audio/replicate-analysis.ts
 *
 * Full audio analysis via the custom indiethis Cog model on Replicate.
 * Runs essentia Python + all 10 EffNet ONNX models (400 Discogs genres,
 * 56 mood themes, instruments, danceability, voice, tonal).
 *
 * Env vars required:
 *   REPLICATE_API_TOKEN    — Replicate API key
 *   REPLICATE_MODEL_VERSION — model version hash from Replicate dashboard
 */

export interface AudioAnalysisResult {
  bpm:          number | null;
  musicalKey:   string | null;
  energy:       number;
  genres:       { label: string; score: number }[];
  moods:        { label: string; score: number }[];
  instruments:  { label: string; score: number }[];
  danceability: number;
  isVocal:      boolean;
  isTonal:      boolean;
}

export async function analyzeAudioOnReplicate(
  audioUrl: string,
): Promise<AudioAnalysisResult | null> {
  const token   = process.env.REPLICATE_API_TOKEN;
  const version = process.env.REPLICATE_MODEL_VERSION;

  if (!token || !version) {
    console.error("[replicate-analysis] Missing REPLICATE_API_TOKEN or REPLICATE_MODEL_VERSION");
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
      console.error(`[replicate-analysis] Create prediction failed ${createRes.status}:`, body);
      return null;
    }

    const prediction = await createRes.json() as { id: string; status: string };
    predictionId = prediction.id;
    console.log(`[replicate-analysis] Prediction created: ${predictionId}`);
  } catch (err) {
    console.error("[replicate-analysis] Create prediction threw:", err);
    return null;
  }

  // ── 2. Poll until complete ─────────────────────────────────────────────────
  const pollUrl     = `https://api.replicate.com/v1/predictions/${predictionId}`;
  const maxWait     = 240_000;
  const pollInterval = 3_000;
  const start       = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    try {
      const pollRes = await fetch(pollUrl, { headers });
      if (!pollRes.ok) continue;

      const data = await pollRes.json() as {
        status:  string;
        output?: AudioAnalysisResult;
        error?:  string;
      };

      if (data.status === "succeeded") {
        const out = data.output;
        if (!out) return null;
        console.log(
          `[replicate-analysis] Done in ${Date.now() - start}ms —`,
          `bpm=${out.bpm ?? "n/a"} key=${out.musicalKey ?? "n/a"} energy=${out.energy.toFixed(2)}`,
          `genre=${out.genres[0]?.label ?? "?"} mood=${out.moods[0]?.label ?? "?"}`,
        );
        return out;
      }

      if (data.status === "failed" || data.status === "canceled") {
        console.error(`[replicate-analysis] Prediction ${predictionId} ${data.status}:`, data.error);
        return null;
      }
    } catch (err) {
      console.error("[replicate-analysis] Poll threw:", err);
    }
  }

  console.error(`[replicate-analysis] Prediction ${predictionId} timed out after ${maxWait}ms`);
  return null;
}
