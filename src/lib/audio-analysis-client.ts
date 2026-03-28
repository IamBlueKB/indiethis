/**
 * Client-side audio analysis using the native browser Web Audio API.
 * No native modules, no server required — runs in the browser on any device.
 */

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

function detectBpm(channelData: Float32Array, sampleRate: number): number | null {
  const filtered = lowpass240(channelData, sampleRate);
  const n        = filtered.length;

  let maxAmp = 0;
  for (let i = 0; i < n; i++) if (filtered[i] > maxAmp) maxAmp = filtered[i];
  if (maxAmp <= 0.05) return null;

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

  const MIN_BPM = 60, MAX_BPM = 200;
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
  if (!tempos.length) return null;
  tempos.sort((a, b) => b.score - a.score);
  return tempos[0].bpm;
}

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NOTE_NAMES    = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function detectKey(channelData: Float32Array, sampleRate: number): string | null {
  // Build a simple pitch class profile via zero-crossing + energy per semitone band
  const frameSize = Math.floor(sampleRate * 0.05); // 50ms frames
  const pcp = new Float32Array(12);

  for (let start = 0; start + frameSize < channelData.length; start += frameSize) {
    for (let i = start; i < start + frameSize - 1; i++) {
      if (channelData[i] >= 0 && channelData[i + 1] < 0) {
        // estimate frequency from zero crossing rate
        const zcRate    = 0;
        void zcRate;
      }
    }
    // Use RMS energy in frequency bands approximated by sample autocorrelation lags
    let energy = 0;
    for (let i = start; i < start + frameSize; i++) energy += channelData[i] * channelData[i];
    const rms = Math.sqrt(energy / frameSize);
    if (rms < 0.01) continue;

    // Autocorrelation-based pitch class: find dominant lag in musical range
    const minLag = Math.floor(sampleRate / 2000); // ~C7
    const maxLag = Math.floor(sampleRate / 65);   // ~C2
    let bestLag = minLag, bestCorr = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      const end = start + frameSize - lag;
      for (let i = start; i < end; i++) corr += channelData[i] * channelData[i + lag];
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    const freq      = sampleRate / bestLag;
    const semitone  = Math.round(12 * Math.log2(freq / 16.35)) % 12;
    const pitchClass = ((semitone % 12) + 12) % 12;
    pcp[pitchClass] += rms;
  }

  // Normalize PCP
  const pcpMax = Math.max(...pcp);
  if (pcpMax === 0) return null;
  for (let i = 0; i < 12; i++) pcp[i] /= pcpMax;

  // Compare against all 24 key templates
  let bestScore = -Infinity, bestKey = "";
  for (let root = 0; root < 12; root++) {
    for (const [mode, profile] of [["major", MAJOR_PROFILE], ["minor", MINOR_PROFILE]] as [string, number[]][]) {
      let score = 0;
      for (let i = 0; i < 12; i++) score += pcp[(i + root) % 12] * profile[i];
      if (score > bestScore) { bestScore = score; bestKey = `${NOTE_NAMES[root]} ${mode}`; }
    }
  }
  return bestKey || null;
}

export interface ClientAudioFeatures {
  bpm: number | null;
  key: string | null;
}

/**
 * Analyze an audio File in the browser using the native Web Audio API.
 * Returns BPM and musical key. Never throws — returns nulls on failure.
 */
export async function analyzeAudioFile(file: File): Promise<ClientAudioFeatures> {
  try {
    const arrayBuffer  = await file.arrayBuffer();
    const audioContext = new window.AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch {
      await audioContext.close();
      return { bpm: null, key: null };
    }

    const sampleRate  = audioBuffer.sampleRate;
    // Limit to first 30 s to keep analysis fast on long tracks
    const maxSamples  = Math.min(audioBuffer.length, sampleRate * 30);
    const channelData = audioBuffer.getChannelData(0).slice(0, maxSamples);

    const bpm = detectBpm(channelData, sampleRate);
    const key = detectKey(channelData, sampleRate);

    await audioContext.close();
    return { bpm, key };
  } catch {
    return { bpm: null, key: null };
  }
}
