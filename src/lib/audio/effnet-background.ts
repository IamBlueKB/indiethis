/**
 * src/lib/audio/effnet-background.ts
 *
 * Background EffNet-Discogs analysis — called via waitUntil() on track upload.
 *
 * Runs after the 201 response is sent so the artist never waits for it.
 * Results are stored in the new effnet* columns on the Track model.
 * Director Mode reads these columns instead of running analysis live.
 *
 * Guarded by ENABLE_EFFNET_ANALYSIS env var — set to "false" during initial
 * deployment so the site is fully functional before enabling.
 */

import { db } from "@/lib/db";

export async function runEffNetBackground(trackId: string, audioUrl: string): Promise<void> {
  try {
    // Mark as in-progress
    await db.track.update({
      where: { id: trackId },
      data:  { analysisStatus: "analyzing" },
    });

    // Dynamic import keeps onnxruntime-web + ONNX models out of other function
    // bundles — only the routes that explicitly import this file (or the trigger
    // endpoints) will bundle the ML stack.
    const { analyzeUrlWithEffnet } = await import("@/lib/audio/effnet-discogs");

    const result = await analyzeUrlWithEffnet(audioUrl);

    if (!result) {
      throw new Error("EffNet analysis returned null");
    }

    // Extract per-mood scalars from the moods array
    const findMood = (label: string): number | null =>
      result.moods.find(m => m.label === label)?.score ?? null;

    await db.track.update({
      where: { id: trackId },
      data: {
        analysisStatus:       "completed",
        analyzedAt:           new Date(),
        effnetGenre:          result.genres,
        effnetMood:           result.moods,
        effnetInstruments:    result.instruments,
        effnetDanceability:   result.danceability,
        effnetVoice:          { isVocal: result.isVocal, gender: null },
        effnetMoodAggressive: findMood("aggressive"),
        effnetMoodHappy:      findMood("happy"),
        effnetMoodSad:        findMood("sad"),
        effnetMoodRelaxed:    findMood("relaxed"),
        effnetTonal:          result.isTonal,
        // Also keep legacy essentia columns in sync so existing code keeps working
        essentiaGenres:        result.genres,
        essentiaMoods:         result.moods,
        essentiaInstruments:   result.instruments,
        essentiaDanceability:  result.danceability,
        essentiaVoice:         result.isVocal ? "vocal" : "instrumental",
        essentiaAnalyzedAt:    new Date(),
      },
    });

    console.log(
      `[effnet-bg] Analysis completed for track ${trackId}:`,
      `genre=${result.genres[0]?.label ?? "?"}`,
      `mood=${result.moods[0]?.label ?? "?"}`,
      `dance=${result.danceability.toFixed(2)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[effnet-bg] Analysis failed for track ${trackId}:`, msg);
    await db.track.update({
      where: { id: trackId },
      data:  { analysisStatus: "failed", analysisError: msg },
    }).catch(() => {}); // best-effort — don't throw if DB write also fails
  }
}
