const BASE = "https://essentia.upf.edu/models";
const urls = [
  `${BASE}/feature-extractors/discogs-effnet/discogs-effnet-bs64-1-savedmodel.zip`,
  `${BASE}/feature-extractors/discogs-effnet/discogs-effnet-bsdynamic-1.onnx`,
  `${BASE}/music-style-classification/discogs-effnet/discogs-effnet-bsdynamic-1.onnx`,
  `${BASE}/classification-heads/danceability/danceability-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/voice_instrumental/voice_instrumental-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/mood_aggressive/mood_aggressive-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/mood_happy/mood_happy-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/mood_sad/mood_sad-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/mood_relaxed/mood_relaxed-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/tonal_atonal/tonal_atonal-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/mtg_jamendo_moodtheme/mtg_jamendo_moodtheme-discogs-effnet-1.onnx`,
  `${BASE}/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.onnx`,
];

for (const url of urls) {
  const r = await fetch(url, { method: "HEAD" });
  const s = r.headers.get("content-length");
  const size = s ? `${(parseInt(s)/1024/1024).toFixed(1)}MB` : "?";
  console.log(`${r.status === 200 ? "✓" : "✗"} ${r.status} [${size}]  ${url.replace(BASE + "/", "")}`);
}
