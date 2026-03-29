"use client";

import { analyzeAudioFeatures } from "./audio-features";

/**
 * Fire-and-forget: fetch the audio file, decode it, run analysis, POST results.
 * Never throws — upload flow must never be blocked by analysis failure.
 */
export async function triggerAudioAnalysis(
  trackId: string,
  audioUrl: string
): Promise<void> {
  try {
    // Fetch the audio file
    const resp = await fetch(audioUrl);
    if (!resp.ok) return;
    const arrayBuffer = await resp.arrayBuffer();

    // Decode audio
    const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    await ctx.close();

    // Analyse
    const features = await analyzeAudioFeatures(audioBuffer);

    // POST to API
    await fetch("/api/audio-features/analyze", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ trackId, features }),
    });
  } catch {
    // Silent — never block upload
  }
}
