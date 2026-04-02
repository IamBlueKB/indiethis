// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioFeatureScores {
  loudness:         number;
  energy:           number;
  danceability:     number;
  acousticness:     number;
  instrumentalness: number;
  speechiness:      number;
  liveness:         number;
  valence:          number;
  genre:            string | null;
  mood:             string | null;
  isVocal:          boolean;
}

// ─── Average Calculator ───────────────────────────────────────────────────────

export function calculateAverageFeatures(
  featuresList: AudioFeatureScores[]
): AudioFeatureScores | null {
  if (featuresList.length === 0) return null;
  const count = featuresList.length;
  const sum = featuresList.reduce(
    (acc, f) => ({
      loudness:         acc.loudness         + f.loudness,
      energy:           acc.energy           + f.energy,
      danceability:     acc.danceability     + f.danceability,
      acousticness:     acc.acousticness     + f.acousticness,
      instrumentalness: acc.instrumentalness + f.instrumentalness,
      speechiness:      acc.speechiness      + f.speechiness,
      liveness:         acc.liveness         + f.liveness,
      valence:          acc.valence          + f.valence,
    }),
    {
      loudness: 0, energy: 0, danceability: 0, acousticness: 0,
      instrumentalness: 0, speechiness: 0, liveness: 0, valence: 0,
    }
  );
  const averaged = Object.fromEntries(
    Object.entries(sum).map(([k, v]) => [k, v / count])
  ) as Omit<AudioFeatureScores, "genre" | "mood" | "isVocal">;

  // Genre/mood: use the most frequent value across the list
  const mostCommon = <T,>(arr: T[]): T | null => {
    if (!arr.length) return null;
    const freq = new Map<T, number>();
    arr.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  return {
    ...averaged,
    genre:   mostCommon(featuresList.map(f => f.genre).filter(Boolean) as string[]),
    mood:    mostCommon(featuresList.map(f => f.mood).filter(Boolean) as string[]),
    isVocal: featuresList.filter(f => f.isVocal).length >= count / 2,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, isFinite(v) ? v : 0.5));
}

function safe(fn: () => number, fallback = 0.5): number {
  try {
    const v = fn();
    return clamp01(isNaN(v) ? fallback : v);
  } catch {
    return fallback;
  }
}

function rms(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

function spectralCentroid(magnitudes: Float32Array, sampleRate: number, fftSize: number): number {
  let weightedSum = 0;
  let totalMag = 0;
  const binHz = sampleRate / fftSize;
  for (let i = 0; i < magnitudes.length; i++) {
    const freq = i * binHz;
    weightedSum += freq * magnitudes[i];
    totalMag    += magnitudes[i];
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

function spectralFlatness(magnitudes: Float32Array): number {
  const n = magnitudes.length;
  if (n === 0) return 0;
  let logSum = 0;
  let linSum = 0;
  let nonZero = 0;
  for (let i = 0; i < n; i++) {
    const m = magnitudes[i];
    if (m > 0) {
      logSum += Math.log(m);
      linSum += m;
      nonZero++;
    }
  }
  if (nonZero === 0 || linSum === 0) return 0;
  const geoMean = Math.exp(logSum / nonZero);
  const ariMean = linSum / n;
  return ariMean > 0 ? clamp01(geoMean / ariMean) : 0;
}

function computeFFT(
  channelData: Float32Array,
  startSample: number,
  frameSize: number,
  analyser: AnalyserNode,
  ctx: OfflineAudioContext
): Float32Array {
  // Simple DFT magnitude approximation via OfflineAudioContext AnalyserNode
  // We use the passed analyser's frequencyBinCount
  const bins = analyser.frequencyBinCount;
  const freqData = new Float32Array(bins);
  // Slice the frame
  const slice = channelData.slice(startSample, startSample + frameSize);
  // Write into a buffer and connect
  const buf = ctx.createBuffer(1, slice.length, ctx.sampleRate);
  buf.copyToChannel(slice, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(analyser);
  // getFloatFrequencyData fills in dB values — convert to linear
  analyser.getFloatFrequencyData(freqData);
  for (let i = 0; i < freqData.length; i++) {
    freqData[i] = Math.pow(10, freqData[i] / 20); // dB → linear
  }
  return freqData;
}

// ─── Main Analyser ────────────────────────────────────────────────────────────

export async function analyzeAudioFeatures(
  audioBuffer: AudioBuffer
): Promise<AudioFeatureScores> {
  const sampleRate  = audioBuffer.sampleRate;
  const maxSamples  = Math.min(audioBuffer.length, sampleRate * 60); // analyse first 60s max
  const channelData = audioBuffer.getChannelData(0).slice(0, maxSamples);
  const duration    = maxSamples / sampleRate;

  // ── OfflineAudioContext + AnalyserNode for FFT snapshots ─────────────────
  const fftSize   = 2048;
  const offCtx    = new OfflineAudioContext(1, maxSamples, sampleRate);
  const analyser  = offCtx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.connect(offCtx.destination);

  // Take ~20 evenly-spaced snapshots for spectral statistics
  const NUM_FRAMES  = 20;
  const frameSize   = fftSize;
  const frameStep   = Math.floor(maxSamples / NUM_FRAMES);
  const snapshots: Float32Array[] = [];

  for (let i = 0; i < NUM_FRAMES; i++) {
    const start = Math.min(i * frameStep, maxSamples - frameSize);
    snapshots.push(computeFFT(channelData, start, frameSize, analyser, offCtx));
  }

  // Average magnitude spectrum across all frames
  const bins = analyser.frequencyBinCount;
  const avgMag = new Float32Array(bins);
  for (const snap of snapshots) {
    for (let b = 0; b < bins; b++) avgMag[b] += snap[b] / NUM_FRAMES;
  }

  // ── Spectral centroid (average) ───────────────────────────────────────────
  const centroid = spectralCentroid(avgMag, sampleRate, fftSize);
  const centroidNorm = clamp01(centroid / 8000); // 0 = bass-heavy, 1 = very bright (8kHz+)

  // ── Flatness ─────────────────────────────────────────────────────────────
  const flatness = spectralFlatness(avgMag);

  // ── RMS energy per frame (for variance/liveness calc) ─────────────────────
  const frameRms: number[] = [];
  for (let i = 0; i < NUM_FRAMES; i++) {
    const start = Math.min(i * frameStep, maxSamples - frameSize);
    frameRms.push(rms(channelData.slice(start, start + frameSize)));
  }
  const avgRms   = frameRms.reduce((s, v) => s + v, 0) / NUM_FRAMES;
  const rmsVar   = frameRms.reduce((s, v) => s + Math.pow(v - avgRms, 2), 0) / NUM_FRAMES;
  const rmsStdDev = Math.sqrt(rmsVar);

  // ── Overall RMS ────────────────────────────────────────────────────────────
  const overallRms = rms(channelData);

  // ── Onset density (rough danceability proxy) ───────────────────────────────
  let onsets = 0;
  const prevRms = [overallRms * 0.5];
  for (let i = 0; i < NUM_FRAMES; i++) {
    const cur = frameRms[i];
    const prev = prevRms[prevRms.length - 1];
    if (cur > prev * 1.3) onsets++;
    prevRms.push(cur);
  }
  const onsetDensity = clamp01(onsets / (NUM_FRAMES * 0.5));

  // ── Vocal band energy (300Hz–3kHz) ─────────────────────────────────────────
  const binHz = sampleRate / fftSize;
  const vocalLow  = Math.floor(300  / binHz);
  const vocalHigh = Math.floor(3000 / binHz);
  let vocalEnergy = 0;
  let totalEnergy = 0;
  for (let b = 0; b < bins; b++) {
    const e = avgMag[b] * avgMag[b];
    totalEnergy += e;
    if (b >= vocalLow && b <= vocalHigh) vocalEnergy += e;
  }
  const vocalRatio = totalEnergy > 0 ? vocalEnergy / totalEnergy : 0;

  // ── Sub-bass vs total (acousticness proxy) ─────────────────────────────────
  const subBassHigh = Math.floor(200 / binHz);
  let subBassEnergy = 0;
  for (let b = 0; b < subBassHigh; b++) subBassEnergy += avgMag[b] * avgMag[b];
  const subBassRatio = totalEnergy > 0 ? clamp01(subBassEnergy / totalEnergy * 5) : 0;

  // ── Feature calculations ───────────────────────────────────────────────────

  const loudness = safe(() => clamp01((overallRms - 0.005) / (0.2 - 0.005)));

  const energy = safe(() => clamp01(overallRms * 5 + centroidNorm * 0.3));

  const danceability = safe(() => clamp01(onsetDensity * 0.6 + (1 - rmsStdDev * 10) * 0.4));

  // Acoustic = NOT electronic: low flatness + low sub-bass dominance = more acoustic
  const acousticness = safe(() => clamp01(1 - flatness * 0.6 - subBassRatio * 0.4));

  // Instrumentalness = low vocal ratio
  const instrumentalness = safe(() => clamp01(1 - vocalRatio * 3));

  // Speechiness = mid-vocal energy relative to overall
  const speechiness = safe(() => clamp01(vocalRatio * 2.5));

  // Liveness = high RMS variance over time (live recordings have more dynamic swings)
  const liveness = safe(() => clamp01(rmsStdDev * 20));

  // Valence proxy: brighter centroid + higher energy = more positive/uplifting
  const valence = safe(() => clamp01(centroidNorm * 0.5 + energy * 0.3 + (1 - speechiness) * 0.2));

  // ── isVocal ────────────────────────────────────────────────────────────────
  const isVocal = vocalRatio > 0.15;

  // ── Genre classification ───────────────────────────────────────────────────
  const genre = classifyGenre({ centroidNorm, flatness, subBassRatio, onsetDensity, energy: energy, acousticness });

  // ── Mood classification ────────────────────────────────────────────────────
  const mood = classifyMood({ valence, energy: energy, speechiness, liveness, centroidNorm });

  return {
    loudness,
    energy,
    danceability,
    acousticness,
    instrumentalness,
    speechiness,
    liveness,
    valence,
    genre,
    mood,
    isVocal,
  };
}

// ─── Genre Classifier ─────────────────────────────────────────────────────────

interface SpectralProfile {
  centroidNorm:  number;
  flatness:      number;
  subBassRatio:  number;
  onsetDensity:  number;
  energy:        number;
  acousticness:  number;
}

function classifyGenre(p: SpectralProfile): string {
  const { centroidNorm, flatness, subBassRatio, onsetDensity, energy, acousticness } = p;

  if (subBassRatio > 0.5 && onsetDensity > 0.5 && flatness > 0.3)    return "Electronic";
  if (subBassRatio > 0.4 && centroidNorm < 0.4 && energy > 0.5)      return "Hip-hop";
  if (centroidNorm > 0.5 && acousticness < 0.4 && onsetDensity > 0.4) return "Pop";
  if (centroidNorm > 0.4 && acousticness > 0.5 && energy < 0.5)       return "R&B";
  if (acousticness > 0.7 && centroidNorm < 0.5)                        return "Jazz";
  if (acousticness > 0.8 && energy < 0.4)                              return "Classical";
  if (centroidNorm > 0.6 && energy > 0.6 && flatness > 0.4)           return "Rock";
  if (acousticness > 0.6 && centroidNorm < 0.4)                        return "Country";
  if (centroidNorm > 0.45 && onsetDensity > 0.6)                       return "Latin";
  return "Other";
}

// ─── Mood Classifier ──────────────────────────────────────────────────────────

interface MoodProfile {
  valence:      number;
  energy:       number;
  speechiness:  number;
  liveness:     number;
  centroidNorm: number;
}

function classifyMood(p: MoodProfile): string {
  const { valence, energy, speechiness, centroidNorm } = p;

  if (energy > 0.75 && valence < 0.4)                   return "Aggressive";
  if (energy > 0.7  && valence > 0.6)                   return "Hype";
  if (energy < 0.35 && valence < 0.4)                   return "Melancholic";
  if (energy < 0.4  && valence > 0.55)                  return "Relaxed";
  if (valence < 0.3 && centroidNorm < 0.4)              return "Dark";
  if (valence > 0.7 && centroidNorm > 0.5)              return "Bright";
  if (energy < 0.5 && valence > 0.5 && speechiness < 0.3) return "Romantic";
  if (valence > 0.6 && energy > 0.5)                    return "Uplifting";
  return "Relaxed";
}
