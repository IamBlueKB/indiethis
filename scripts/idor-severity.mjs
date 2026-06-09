/**
 * Deep-read pass: for every RISKY + REVIEW route, open the file and classify
 * by data-sensitivity dimensions. Produces a severity-ranked report.
 */
import fs from "node:fs";
import path from "node:path";

const recon = fs.readFileSync(path.resolve("prisma/manual/idor_recon.md"), "utf8");

// Parse out the RISKY + REVIEW route paths from the report
function extractBucket(name) {
  const lines = recon.split("\n");
  const out = [];
  let inBucket = false;
  for (const line of lines) {
    const head = line.match(/^## (\w+)/);
    if (head) {
      inBucket = head[1] === name;
      continue;
    }
    if (!inBucket) continue;
    const m = line.match(/^\| `([^`]+)` \| (.+?) \|$/);
    if (m && !m[1].includes("Route")) {
      out.push({ file: m[1], reason: m[2] });
    }
  }
  return out;
}

const risky  = extractBucket("RISKY");
const review = extractBucket("REVIEW");
const all = [...risky.map(r => ({...r, initBucket: "RISKY"})),
             ...review.map(r => ({...r, initBucket: "REVIEW"}))];

function classify({ file, reason, initBucket }) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch { return { file, score: 0, dims: ["unreadable"], severity: "UNKNOWN" }; }

  const dims = [];
  let score = 0;

  // HTTP methods
  const methods = ["GET","POST","PUT","PATCH","DELETE"].filter(m =>
    new RegExp(`export async function ${m}\\b`).test(src));
  const isMutation = methods.some(m => m !== "GET");

  // === Data-sensitivity signals ===

  // 1. Downloads / file URLs (D — DOWNLOADS)
  if (/signedUrl|generateFreshSignedUrl|getSignedUrl|presignedUrl|file_size|downloadUrl|outputUrl|wavUrl|mp3Url|filePath|object\/sign/i.test(src)) {
    dims.push("FILES"); score += 3;
  }

  // 2. Financial paths (M — MONEY)
  if (/stripe|checkout|payment|payout|invoice|transfer|charge|refund|balance|withdrawal/i.test(src)) {
    dims.push("MONEY"); score += 5;
  }

  // 3. Personal info exposure (P — PII)
  // Triggers if the route returns or queries these fields in a select/include
  if (/\bemail\b|\bphone\b|\baddress\b|\bzipCode\b|cashApp|venmo|zelle|paypal|passwordHash|stripeCustomerId|stripeConnectId|ssn|taxId/i.test(src)) {
    dims.push("PII"); score += 4;
  }

  // 4. Other users' content / state mutation
  // Mutation routes default to higher score
  if (isMutation && /db\.\w+\.(update|create|delete|upsert)/.test(src)) {
    dims.push("MUTATES_STATE"); score += 4;
  }

  // 5. AI cost paths (compute that costs money on each call)
  if (/fal\.subscribe|fal-ai|replicate\.run|replicate\.predictions|claude\(|anthropic|generateScene|keyframe|director|chat\(|messages\.create/i.test(src)) {
    dims.push("AI_COST"); score += 4;
  }

  // 6. Admin / privileged
  if (/adminAccount|impersonate|comp|suspend|tier|approve|reject|grant|revoke/i.test(src)) {
    dims.push("ADMIN_ACTION"); score += 3;
  }

  // 7. Files written to disk / uploaded
  if (/uploadthing|R2|s3\.send|PutObject|formData\.get\(["']file/.test(src)) {
    dims.push("UPLOADS"); score += 3;
  }

  // 8. Reads another user's record via ID (queries Track/Mix/Mastering/MusicVideo/etc. by ID, no userId filter)
  if (/db\.(mixJob|masteringJob|musicVideo|track|coverArtJob|mixerSession|videoStudioJob|directorSession|invoice|deliveredFile|quickSend)\.findUnique\(\{\s*where:\s*\{\s*id/.test(src)
   && !/userId|guestEmail|ownerId|artistId|producerId/.test(src)) {
    dims.push("ID_ONLY_LOOKUP"); score += 3;
  }

  // 9. Does it have ANY ownership check at all?
  const hasOwnerCheck = /(userId|artistId|producerId|guestEmail|ownerId)\s*[!=]==?/.test(src)
                     || /where:\s*\{[\s\S]{0,200}(userId|artistId|producerId|guestEmail|ownerId):/.test(src)
                     || /session\.user\.id.*===|=== session\.user\.id/.test(src);

  // 10. Has auth call at all
  const hasAuth = /\bawait\s+auth\(\)|getAdminSession\(/.test(src);

  // Adjust: if owner check present + auth call → significantly less risky (REVIEW false positive)
  if (hasAuth && hasOwnerCheck) {
    dims.push("HAS_OWNER_CHECK"); score -= 5;
  } else if (!hasAuth && !hasOwnerCheck && isMutation) {
    dims.push("NO_AUTH_NO_OWNER"); score += 5;
  }

  // Severity tier
  let severity;
  if (score >= 9)      severity = "S0_CRITICAL";
  else if (score >= 6) severity = "S1_HIGH";
  else if (score >= 3) severity = "S2_MEDIUM";
  else if (score >= 0) severity = "S3_LOW";
  else                 severity = "S4_LIKELY_OK";

  return {
    file: file.replace(/^.*?src\/app\/api\//, "/api/"),
    initBucket,
    methods,
    severity,
    score,
    dims,
    hasAuth,
    hasOwnerCheck,
  };
}

const results = all.map(classify);

// Sort by severity then by score desc
const sevOrder = { S0_CRITICAL: 0, S1_HIGH: 1, S2_MEDIUM: 2, S3_LOW: 3, S4_LIKELY_OK: 4, UNKNOWN: 5 };
results.sort((a, b) =>
  sevOrder[a.severity] - sevOrder[b.severity] ||
  (b.score || 0) - (a.score || 0) ||
  a.file.localeCompare(b.file)
);

const bySev = {};
for (const r of results) (bySev[r.severity] ||= []).push(r);

// Build markdown report
let md = "# Phase 1.2 — IDOR Severity Audit (deep read)\n\n";
md += `_Read every RISKY + REVIEW route from idor_recon.md and scored by data-sensitivity dimensions: FILES, MONEY, PII, MUTATES_STATE, AI_COST, ADMIN_ACTION, UPLOADS, ID_ONLY_LOOKUP._\n\n`;
md += "## Severity legend\n\n";
md += "| Tier | Score | Action |\n|---|---|---|\n";
md += "| **S0_CRITICAL** | ≥9 | Stop-the-presses — money / privileged / multi-vector exposure |\n";
md += "| **S1_HIGH** | 6–8 | Fix before launch — sensitive single-vector exposure |\n";
md += "| **S2_MEDIUM** | 3–5 | Fix in P1.2; not launch-blocking on its own |\n";
md += "| **S3_LOW** | 0–2 | Verify intent; likely fine |\n";
md += "| **S4_LIKELY_OK** | <0 | Has auth + owner check; likely a REVIEW false positive |\n\n";
md += "## Summary\n\n";
md += "| Tier | Count |\n|---|---|\n";
for (const t of ["S0_CRITICAL","S1_HIGH","S2_MEDIUM","S3_LOW","S4_LIKELY_OK","UNKNOWN"]) {
  md += `| ${t} | ${(bySev[t]||[]).length} |\n`;
}
md += `| **TOTAL** | **${results.length}** |\n\n`;

for (const t of ["S0_CRITICAL","S1_HIGH","S2_MEDIUM","S3_LOW","S4_LIKELY_OK","UNKNOWN"]) {
  const rows = bySev[t] || [];
  if (!rows.length) continue;
  md += `## ${t} (${rows.length})\n\n`;
  md += "| Route | Methods | Dimensions | Score | Has auth? | Has owner check? |\n|---|---|---|---|---|---|\n";
  for (const r of rows) {
    md += `| \`${r.file}\` | ${r.methods.join(", ")} | ${r.dims.join(", ") || "—"} | ${r.score} | ${r.hasAuth ? "✓" : "✗"} | ${r.hasOwnerCheck ? "✓" : "✗"} |\n`;
  }
  md += "\n";
}

fs.writeFileSync(path.resolve("prisma/manual/idor_severity.md"), md);
console.log("Wrote prisma/manual/idor_severity.md");
for (const t of ["S0_CRITICAL","S1_HIGH","S2_MEDIUM","S3_LOW","S4_LIKELY_OK","UNKNOWN"]) {
  console.log(`  ${t}: ${(bySev[t]||[]).length}`);
}
