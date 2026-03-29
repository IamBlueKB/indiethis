"use client";

import { analyzeAudioFeatures } from "./audio-features";

// ── Client-side BPM detection (mirrors server-side algorithm) ─────────────────

function lowpass240(data: Float32Array, sampleRate: number): Float32Array {
  const rc    = 1 / (2 * Math.PI * 240);
  const dt    = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out   = new Float32Array(data.length);
  out[0]      = data[0];
  for (let i = 1; i < data.length; i++) {
    out[i] = out[i - 1] + alpha * (data[i] - out[i - 1]);
  }
  return out;
}

function detectBpmClient(channelData: Float32Array, sampleRate: number): number | null {
  const filtered = lowpass240(channelData, sampleRate);
  const n        = filtered.length;

  let maxAmp = 0;
  for (let i = 0; i < n; i++) if (filtered[i] > maxAmp) maxAmp = filtered[i];
  if (maxAmp <= 0.25) return null;

  const minThreshold = 0.3 * maxAmp;
  let peaks: number[] = [];
  let threshold = maxAmp * 0.95;
  while (peaks.length < 30 && threshold >= minThreshold) {
    peaks = [];
    let above = false;
    for (let i = 0; i < n; i++) {
      if (filtered[i] > threshold) { above = true; }
      else if (above) {
        above = false;
        peaks.push(i - 1);
        i += Math.floor(sampleRate / 4) - 1;
      }
    }
    if (above) peaks.push(n - 1);
    threshold -= 0.05 * maxAmp;
  }
  if (peaks.length < 2) return null;

  const intervals: { interval: number; count: number }[] = [];
  for (let i = 0; i < peaks.length; i++) {
    const maxJ = Math.min(peaks.length - i, 10);
    for (let j = 1; j < maxJ; j++) {
      const interval = peaks[i + j] - peaks[i];
      const existing = intervals.find((x) => x.interval === interval);
      if (existing) existing.count++;
      else intervals.push({ interval, count: 1 });
    }
  }

  const MIN_BPM = 80, MAX_BPM = 200;
  const tempos: { bpm: number; score: number }[] = [];
  for (const { interval, count } of intervals) {
    let tempo = 60 / (interval / sampleRate);
    while (tempo < MIN_BPM) tempo *= 2;
    while (tempo > MAX_BPM) tempo /= 2;
    if (tempo < MIN_BPM || tempo > MAX_BPM) continue;
    const rounded = Math.round(tempo);
    const existing = tempos.find((t) => Math.abs(t.bpm - rounded) <= 1);
    if (existing) existing.score += count;
    else tempos.push({ bpm: rounded, score: count });
  }
  if (tempos.length === 0) return null;
  tempos.sort((a, b) => b.score - a.score);
  return tempos[0].bpm;
}

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

    // Analyse features
    const features = await analyzeAudioFeatures(audioBuffer);

    // Detect BPM client-side
    let bpm: number | null = null;
    try {
      const channelData = audioBuffer.getChannelData(0);
      bpm = detectBpmClient(channelData, audioBuffer.sampleRate);
    } catch {
      // silent — BPM detection is best-effort
    }

    // POST to API — include bpm if detected (musicalKey requires server-side essentia)
    await fetch("/api/audio-features/analyze", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        trackId,
        features,
        ...(bpm !== null && { bpm }),
      }),
    });
  } catch {
    // Silent — never block upload
  }
}
