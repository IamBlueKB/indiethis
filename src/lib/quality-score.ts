/**
 * Quality Score — 0–100 ranking signal for tracks.
 * Calculated daily by the quality-scores cron job; stored on Track.qualityScore.
 * Never computed at page-load time.
 */

export type TrackForScoring = {
  id:                 string;
  playsLast7Days:     number;
  playsPrevious7Days: number;
  playsLast30Days:    number;
  crateCount:         number; // DJ crate adds (all-time or last 30d in cron)
  purchaseCount:      number; // beat license purchases
  createdAt:          Date;
  coverArtUrl:        string | null;
  producer:           string | null;
  songwriter:         string | null;
  canvasVideoUrl:     string | null;
  audioFeatures: {
    energy:           number;
    danceability:     number;
    acousticness:     number;
    instrumentalness: number;
    valence:          number;
  } | null;
};

/**
 * Returns 0–1: average deviation of each audio feature from platform mean (0.5).
 * Higher = more sonically distinctive.
 */
function calculateUniqueness(f: {
  energy: number; danceability: number; acousticness: number;
  instrumentalness: number; valence: number;
}): number {
  const vals = [f.energy, f.danceability, f.acousticness, f.instrumentalness, f.valence];
  const deviations = vals.map(v => Math.abs(v - 0.5));
  return deviations.reduce((a, b) => a + b, 0) / deviations.length;
}

export function calculateQualityScore(track: TrackForScoring): number {
  let score = 0;

  // ── Play velocity — plays this week vs last week (max 25 pts) ───────────────
  const recentPlays   = track.playsLast7Days;
  const previousPlays = track.playsPrevious7Days;
  const velocity      = recentPlays > 0
    ? (recentPlays - previousPlays) / Math.max(previousPlays, 1)
    : 0;
  score += Math.min(velocity * 10, 25);

  // ── DJ crate adds (max 20 pts) ──────────────────────────────────────────────
  score += Math.min(track.crateCount * 3, 20);

  // ── Fan engagement — purchases (max 15 pts) ──────────────────────────────
  score += Math.min(track.purchaseCount * 5, 15);

  // ── AudioFeatures uniqueness (max 10 pts) ───────────────────────────────────
  if (track.audioFeatures) {
    const uniqueness = calculateUniqueness(track.audioFeatures);
    score += Math.min(uniqueness * 10, 10);
  }

  // ── Recency boost (max 15 pts) ───────────────────────────────────────────────
  const daysSinceUpload =
    (Date.now() - track.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if      (daysSinceUpload < 7)  score += 15;
  else if (daysSinceUpload < 14) score += 10;
  else if (daysSinceUpload < 30) score += 5;

  // ── Profile completeness (max 15 pts) ───────────────────────────────────────
  if (track.coverArtUrl)                  score += 5;
  if (track.producer || track.songwriter) score += 3;
  if (track.audioFeatures)               score += 2;
  if (track.canvasVideoUrl)              score += 5;

  let finalScore = Math.min(score, 100);

  // ── Stale content penalty ────────────────────────────────────────────────────
  // Tracks older than 90 days with zero plays in the last 30 days get score halved.
  // They shouldn't outrank new uploads.
  if (daysSinceUpload > 90 && track.playsLast30Days === 0) {
    finalScore = finalScore / 2;
  }

  return Math.round(finalScore);
}
