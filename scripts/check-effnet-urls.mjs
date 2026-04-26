/**
 * Check which EffNet-Discogs model URLs return real files vs 404.
 */

const urls = [
  // Base embedding model
  "https://essentia.upf.edu/models/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.pb",
  "https://essentia.upf.edu/models/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.json",

  // Style classifier (same model — outputs 400 styles directly)
  "https://essentia.upf.edu/models/music-style-classification/discogs-effnet/discogs-effnet-bs64-1.pb",
  "https://essentia.upf.edu/models/music-style-classification/discogs-effnet/discogs-effnet-bs64-1.json",

  // Classification heads
  "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/danceability/danceability-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/danceability/danceability-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/mood_happy/mood_happy-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/mood_happy/mood_happy-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/mood_sad/mood_sad-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/mood_sad/mood_sad-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.json",
  "https://essentia.upf.edu/models/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.pb",
  "https://essentia.upf.edu/models/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.json",
];

console.log("Checking EffNet-Discogs model URLs...\n");

for (const url of urls) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const size = r.headers.get("content-length");
    const type = r.headers.get("content-type") ?? "?";
    const sizeStr = size ? `${(parseInt(size) / 1024 / 1024).toFixed(1)}MB` : "?";
    const shortUrl = url.replace("https://essentia.upf.edu/models/", "");
    console.log(`${r.status === 200 ? "✓" : "✗"} ${r.status} [${sizeStr}] ${shortUrl}`);
  } catch (e) {
    console.log(`✗ ERR  ${url.replace("https://essentia.upf.edu/models/", "")} — ${e.message.slice(0, 50)}`);
  }
}
