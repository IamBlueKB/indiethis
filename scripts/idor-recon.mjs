/**
 * Phase 1.2 recon — classify every dynamic-segment API route by detected
 * ownership pattern. Reports only — no code changes.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const baseDir = path.resolve("src/app/api");
const files = execSync(`find "${baseDir}" -name "route.ts" -path "*[[]*"`, { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .map(f => f.replace(/\\/g, "/"));

function classify(file) {
  const src = fs.readFileSync(file, "utf8");

  const isWebhook = /\/webhook\//.test(file);
  const isCron    = /\/api\/cron\//.test(file);
  const isOg      = /\/api\/og\//.test(file);
  const isPublic  = /\/api\/public\//.test(file);
  const isAdmin   = /\/api\/admin\//.test(file);
  const isAuthPublic = /\/api\/auth\//.test(file);

  // Detection signals
  const hasAuthCall      = /\bawait\s+auth\(\)/.test(src) || /from\s+["']@\/lib\/auth["']/.test(src);
  const hasAssertAdmin   = /assert(Reference)?Admin|requireAdmin|isAdmin\b|getAdminSession|requireAdminAccess|@\/lib\/admin-auth/.test(src);
  const hasAdminRoleCheck= /role\s*[=!]==?\s*["'](PLATFORM_ADMIN|ADMIN|SUPER_ADMIN)["']/.test(src) || /PLATFORM_ADMIN/.test(src);
  const isExplicitlyPublic = /Public\s+—\s+no auth|Public endpoint|no auth required|@public-route/i.test(src);
  const hasOwnershipCmp  = /(?:userId|artistId|producerId|ownerId|djId)\s*[!=]==?\s*(?:session\.user\.id|userId|session\?\.user)/.test(src)
                        || /session\.user\.id.*(?:userId|artistId|producerId|ownerId|djId)/.test(src)
                        || /where:\s*\{\s*(?:userId|artistId|producerId|ownerId|djId):\s*(?:session\.user\.id|userId|session\?\.user)/.test(src)
                        || /\.findFirst\([\s\S]{0,500}where[\s\S]{0,500}(?:userId|artistId)/.test(src);
  const hasTokenCheck    = /accessToken|access_token|token\s*[=!]==?|verifyToken|validateToken|MixAccessToken|MasteringAccessToken/.test(src);
  // URL segment is itself a token (high-entropy lookup key)
  const isTokenSegment   = /\/\[(token|code|inviteToken|accessToken|customSlug|djSlug)\]\//.test(file);
  // Detect HTTP methods present (mutation routes = higher IDOR severity)
  const methods = [];
  for (const m of ["GET","POST","PUT","PATCH","DELETE"]) {
    if (new RegExp(`export async function ${m}\\b`).test(src)) methods.push(m);
  }
  const isMutation = methods.some(m => m !== "GET");
  const hasSignatureGate = /verifyWebhookSignature|verifySignature|stripeSignature|crypto\.createHmac|x-replicate-signature/i.test(src);
  const hasGuestEmailCk  = /guestEmail|indiethis_guest_email/.test(src);
  const hasNotFoundRedir = /notFound\(\)|redirect\(/.test(src);

  // Bucket decision
  let bucket;
  let reason = [];

  if (isWebhook && hasSignatureGate) {
    bucket = "EXEMPT";
    reason.push("webhook + signature");
  } else if (isWebhook) {
    bucket = "REVIEW";
    reason.push("webhook MISSING signature gate");
  } else if (isCron) {
    bucket = "EXEMPT";
    reason.push("cron");
  } else if (isOg) {
    bucket = "EXEMPT";
    reason.push("og image");
  } else if (isAuthPublic) {
    bucket = "EXEMPT";
    reason.push("auth flow");
  } else if (isExplicitlyPublic) {
    bucket = "REVIEW";
    reason.push("explicitly marked public — confirm intent + verify data exposed isn't sensitive");
  } else if (isAdmin && (hasAssertAdmin || hasAdminRoleCheck)) {
    bucket = "SAFE";
    reason.push("admin route + admin guard");
  } else if (isAdmin) {
    bucket = "RISKY";
    reason.push("admin route but NO admin guard detected");
  } else if (isPublic) {
    if (hasTokenCheck || hasGuestEmailCk) {
      bucket = "SAFE";
      reason.push("public route + token/guest gate");
    } else if (hasAuthCall) {
      bucket = "SAFE";
      reason.push("public route w/ auth call");
    } else {
      bucket = "REVIEW";
      reason.push("public route — verify intent");
    }
  } else if (hasAuthCall && hasOwnershipCmp) {
    bucket = "SAFE";
    reason.push("auth + ownership compare");
  } else if (hasAuthCall && hasTokenCheck) {
    bucket = "SAFE";
    reason.push("auth + token check");
  } else if (hasAuthCall) {
    bucket = "REVIEW";
    reason.push("auth but no ownership compare detected");
  } else if (hasTokenCheck) {
    bucket = "SAFE";
    reason.push("token-only route");
  } else if (isTokenSegment) {
    bucket = isMutation ? "REVIEW" : "SAFE";
    reason.push(`URL segment is a token (${isMutation ? "mutation — verify entropy + freshness" : "high-entropy lookup"})`);
  } else if (isMutation) {
    bucket = "RISKY";
    reason.push(`MUTATION (${methods.filter(m=>m!=="GET").join(",")}) with ID-only access — IDOR risk`);
  } else {
    bucket = "REVIEW";
    reason.push("ID-only read; verify data exposed isn't sensitive (entropy ≠ confidentiality)");
  }

  return {
    file: file.replace(baseDir + "/", ""),
    bucket,
    reason: reason.join("; "),
    isWebhook, isCron, isOg, isPublic, isAdmin,
    hasAuthCall, hasOwnershipCmp, hasTokenCheck, hasAssertAdmin, hasAdminRoleCheck, hasSignatureGate,
  };
}

const classified = files.map(classify);
const byBucket = {};
for (const c of classified) {
  (byBucket[c.bucket] ||= []).push(c);
}

const order = ["RISKY", "REVIEW", "SAFE", "EXEMPT"];
let md = "# IDOR / Ownership Audit — Recon\n\n";
md += `_Generated from \`src/app/api/**/[*]/route.ts\` — ${classified.length} dynamic-segment routes._\n\n`;
md += "## Summary\n\n";
md += "| Bucket | Count | Meaning |\n|---|---|---|\n";
md += `| 🔴 RISKY | ${(byBucket.RISKY||[]).length} | No auth, no token, no admin guard — most likely IDOR exposure |\n`;
md += `| 🟡 REVIEW | ${(byBucket.REVIEW||[]).length} | Has auth but no obvious ownership check OR public/webhook missing gates |\n`;
md += `| 🟢 SAFE | ${(byBucket.SAFE||[]).length} | Auth + ownership compare, or admin route + admin guard, or token-validated |\n`;
md += `| ⚪ EXEMPT | ${(byBucket.EXEMPT||[]).length} | Webhook (signed), cron, OG image, NextAuth |\n`;
md += `| **TOTAL** | **${classified.length}** | |\n\n`;

for (const b of order) {
  const rows = byBucket[b] || [];
  if (rows.length === 0) continue;
  md += `## ${b} (${rows.length})\n\n`;
  md += "| Route | Reason |\n|---|---|\n";
  for (const r of rows.sort((a, b) => a.file.localeCompare(b.file))) {
    md += `| \`${r.file}\` | ${r.reason} |\n`;
  }
  md += "\n";
}

fs.writeFileSync(path.resolve("prisma/migrations/manual/idor_recon.md"), md);
console.log("Wrote prisma/migrations/manual/idor_recon.md");
for (const b of order) console.log(`  ${b}: ${(byBucket[b]||[]).length}`);
