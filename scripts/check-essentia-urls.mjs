/**
 * Scrape the essentia.upf.edu directory listing to find actual model URLs.
 */

async function listDir(url) {
  const r = await fetch(url);
  if (!r.ok) { console.log("SKIP", r.status, url); return []; }
  const text = await r.text();
  // Parse Apache directory listing hrefs
  const hrefs = [...text.matchAll(/href="([^"?#]+)"/g)]
    .map(m => m[1])
    .filter(h => !h.startsWith("/") && h !== "../" && h !== ".");
  return hrefs;
}

const BASE = "https://essentia.upf.edu/models/classifiers/";
console.log("Listing:", BASE);
const classifiers = await listDir(BASE);
console.log("Classifiers:", classifiers.join(", "), "\n");

// Filter to relevant ones
const want = classifiers.filter(c =>
  c.includes("genre") || c.includes("mood") || c.includes("dance") ||
  c.includes("voice") || c.includes("tonal") || c.includes("instrumental")
);

for (const classifier of want.slice(0, 12)) {
  const dirUrl = BASE + classifier;
  const versions = await listDir(dirUrl);
  if (versions.length) {
    console.log(`${classifier.replace("/", "")}`);
    for (const v of versions) {
      const modelUrl = `${dirUrl}${v}model.json`;
      const r = await fetch(modelUrl, { method: "HEAD" });
      const size = r.headers.get("content-length");
      console.log(`  ${r.status}  ${v}model.json  (${size ? (parseInt(size)/1024).toFixed(0)+"KB" : "?"})`);
    }
  }
}
