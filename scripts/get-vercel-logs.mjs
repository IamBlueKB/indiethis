/**
 * Fetch recent Vercel deployment logs and print full message text.
 * Uses the Vercel REST API to get runtime logs with full content.
 */

const TOKEN = "vca_8ZOudYa8jPsUj5RQknqc0gSgbEP9hCiHVVawY9J71dW93FCJ5F1nMxPp";
const TEAM  = "team_Vp2OTioijgS53o5i8PKFS5r6"; // bluekbs-projects team ID

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function api(path) {
  const r = await fetch(`https://api.vercel.com${path}`, { headers });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status} ${path}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function main() {
  // 1. Find the project
  const projects = await api(`/v9/projects?teamId=${TEAM}`);
  const proj = projects.projects.find(p => p.name === "indiethis");
  if (!proj) throw new Error("Project 'indiethis' not found");
  console.log(`Project ID: ${proj.id}\n`);

  // 2. Get recent production deployments
  const deps = await api(`/v6/deployments?teamId=${TEAM}&projectId=${proj.id}&limit=8&target=production`);
  console.log("Recent deployments:");
  for (const d of deps.deployments) {
    const age = Math.round((Date.now() - d.created) / 60000);
    console.log(`  ${d.uid.slice(4, 14)}  ${d.url}  ${d.readyState}  ${age}m ago`);
  }
  console.log();

  // 3. Get runtime logs for the 2 most recent deployments, filtering for video-studio
  for (const dep of deps.deployments.slice(0, 2)) {
    console.log(`\n=== Logs for ${dep.url} ===`);
    try {
      // Runtime logs endpoint
      const logsUrl = `https://api.vercel.com/v2/deployments/${dep.uid}/events?teamId=${TEAM}&limit=200`;
      const logsR = await fetch(logsUrl, { headers });
      const logsText = await logsR.text();

      // Parse NDJSON (one JSON object per line)
      const lines = logsText.split("\n").filter(Boolean);
      let found = 0;
      for (const line of lines) {
        try {
          const ev = JSON.parse(line);
          const msg = ev.payload?.text ?? ev.text ?? ev.message ?? "";
          if (
            msg.includes("analyzeSong") ||
            msg.includes("song-analyzer") ||
            msg.includes("essentia-vggish") ||
            msg.includes("VGGish") ||
            msg.includes("[chat]") ||
            msg.includes("RhythmExtractor") ||
            msg.includes("director") ||
            msg.includes("video-studio")
          ) {
            const ts = ev.payload?.date ? new Date(ev.payload.date).toISOString().slice(11, 19) : "??:??:??";
            console.log(`  ${ts}  ${msg.slice(0, 500)}`);
            found++;
          }
        } catch { /* skip non-JSON lines */ }
      }
      if (!found) console.log("  (no matching log lines found)");
    } catch (err) {
      console.log(`  Error fetching logs: ${err.message}`);
    }
  }
}

main().catch(console.error);
