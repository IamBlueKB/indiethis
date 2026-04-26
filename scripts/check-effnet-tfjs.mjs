/**
 * Check if essentia.upf.edu has pre-converted TF.js zip versions of EffNet models.
 * Also scan directory listings for any .zip or tfjs files.
 */

const BASE = "https://essentia.upf.edu/models";

const tfjsUrls = [
  // TFJs zips for base model
  `${BASE}/feature-extractors/discogs-effnet/discogs-effnet-bs64-1-tfjs.zip`,
  `${BASE}/music-style-classification/discogs-effnet/discogs-effnet-bs64-1-tfjs.zip`,
  // Classification heads tfjs
  `${BASE}/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/danceability/danceability-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/mood_happy/mood_happy-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/mood_sad/mood_sad-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1-tfjs.zip`,
  `${BASE}/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1-tfjs.zip`,
];

console.log("Checking for pre-converted TF.js zips...\n");
for (const url of tfjsUrls) {
  const r = await fetch(url, { method: "HEAD" });
  const size = r.headers.get("content-length");
  const sizeStr = size ? `${(parseInt(size)/1024/1024).toFixed(1)}MB` : "?";
  console.log(`${r.status === 200 ? "✓" : "✗"} ${r.status} [${sizeStr}]  ${url.replace(BASE + "/", "")}`);
}

// Also scrape directory listings for any tfjs-related files
console.log("\n\nScanning directory listings for tfjs files...\n");
const dirs = [
  `${BASE}/feature-extractors/discogs-effnet/`,
  `${BASE}/music-style-classification/discogs-effnet/`,
  `${BASE}/classification-heads/danceability/`,
  `${BASE}/classification-heads/mood_aggressive/`,
];

for (const dir of dirs) {
  const r = await fetch(dir);
  if (!r.ok) continue;
  const text = await r.text();
  const hrefs = [...text.matchAll(/href="([^"?#]+)"/g)]
    .map(m => m[1])
    .filter(h => !h.startsWith("/") && h !== "../");
  console.log(`${dir.replace(BASE + "/", "")}:`);
  for (const h of hrefs) console.log(`  ${h}`);
  console.log();
}
