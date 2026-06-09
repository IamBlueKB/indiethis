/**
 * One-off: parse prisma/schema.prisma and classify every model by ownership
 * pattern for the RLS inventory. Outputs a markdown table.
 */
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

// Crude model parser — schema.prisma blocks: `model Foo { ... }`
const models = [];
const re = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
let m;
while ((m = re.exec(src)) !== null) {
  models.push({ name: m[1], body: m[2] });
}

function classify(model) {
  const { name, body } = model;
  const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
  const fields = lines.filter(l => !l.startsWith("//") && !l.startsWith("@@"));

  // Detect direct user-ownership scalar FKs (lines were trimmed → no indent)
  const hasUserId        = fields.some(l => /^userId\b/.test(l));
  const hasArtistId      = fields.some(l => /^artistId\b/.test(l));
  const hasProducerId    = fields.some(l => /^producerId\b/.test(l));
  const hasOwnerId       = fields.some(l => /^ownerId\b/.test(l));
  const hasCreatorId     = fields.some(l => /^creatorId\b/.test(l));
  const hasReferrerId    = fields.some(l => /^referrerId\b/.test(l));
  const hasDjId          = fields.some(l => /^djId\b/.test(l));
  const hasAuthorId      = fields.some(l => /^authorId\b/.test(l));
  const hasFromUserId    = fields.some(l => /^fromUserId\b/.test(l));
  const hasBuyerId       = fields.some(l => /^buyerId\b/.test(l));
  const hasReferrerUserId= fields.some(l => /^referrerUserId\b/.test(l));

  // Common indirect-ownership parents
  const fkRefs = [];
  // Fields are indented 2 spaces in schema.prisma — use multiline + \s* prefix
  const has = (n) => new RegExp(`^\\s*${n}\\b`, "m").test(body);
  if (has("trackId"))         fkRefs.push("Track");
  if (has("mixJobId"))        fkRefs.push("MixJob");
  if (has("masteringJobId"))  fkRefs.push("MasteringJob");
  if (has("musicVideoId"))    fkRefs.push("MusicVideo");
  if (has("videoId"))         fkRefs.push("ArtistVideo/Video");
  if (has("productId"))       fkRefs.push("Product");
  if (has("orderId"))         fkRefs.push("Order");
  if (has("studioId"))        fkRefs.push("Studio");
  if (has("bookingId"))       fkRefs.push("Booking");
  if (has("leaseId"))         fkRefs.push("StreamLease");
  if (has("campaignId"))      fkRefs.push("PreSaveCampaign");
  if (has("crateId"))         fkRefs.push("DJCrate");
  if (has("mixId"))           fkRefs.push("DJMix");
  if (has("setId"))           fkRefs.push("DJSet");
  if (has("eventId"))         fkRefs.push("DJEvent");
  if (has("splitSheetId"))    fkRefs.push("SplitSheet");
  if (has("releaseId"))       fkRefs.push("Release");
  if (has("cardId"))          fkRefs.push("Card");
  if (has("scanId"))          fkRefs.push("Scan");
  if (has("siteId"))          fkRefs.push("ArtistSite");
  if (has("profileId"))       fkRefs.push("(Profile)");
  if (has("djProfileId"))     fkRefs.push("DJProfile");
  if (has("producerProfileId"))fkRefs.push("ProducerProfile");
  if (has("splitId"))         fkRefs.push("Split");
  if (has("promoCodeId"))     fkRefs.push("PromoCode");
  if (has("ambassadorId"))    fkRefs.push("Ambassador");
  if (has("affiliateId"))     fkRefs.push("Affiliate");
  if (has("contactId"))       fkRefs.push("Contact");
  if (has("invoiceId"))       fkRefs.push("Invoice");
  if (has("releasePlanId"))   fkRefs.push("ReleasePlan");
  if (has("sessionNoteId"))   fkRefs.push("SessionNote");
  if (has("sceneId"))         fkRefs.push("MusicVideo (scene)");
  if (has("presetId"))        fkRefs.push("(Preset)");
  if (has("styleId"))         fkRefs.push("(Style)");
  if (has("showId"))          fkRefs.push("ArtistShow");
  if (has("intakeLinkId"))    fkRefs.push("IntakeLink");
  if (has("intakeSubmissionId"))fkRefs.push("IntakeSubmission");
  if (has("submissionId"))    fkRefs.push("(Submission)");
  if (has("beatId"))          fkRefs.push("BeatPreview");
  if (has("jobId"))           fkRefs.push("(MasteringJob/MixJob)");
  if (has("streamLeaseId"))   fkRefs.push("StreamLease");

  // Admin / system signals
  const adminOnly = [
    "AdminAccount", "AgentLog", "AIInsightsLog", "GenerationLog", "PlatformPricing",
    "AILearningEvent", "AIToolFeedback", "ModerationFlag", "ContentModerationFlag",
    "FeatureFlag", "ImpersonationLog", "AdminAuditLog", "SystemSetting",
    "AuditLog", "AdminTeam", "SupportChat", "SupportChatMessage",
    "CronLog", "AgentJob", "AdminPasswordReset",
    // Platform reporting + popups + reference targets + system config
    "RevenueReportAlert", "RevenueReportConfig", "RevenueReportGoal", "RevenueReportLog",
    "PromoPopup", "GenreTarget", "SystemConfig",
    // PromoCode → admin only; redemption goes through /api/promo/redeem server-side.
    // Public SELECT would let anyone enumerate every active code including comp/high-value.
    "PromoCode",
  ].includes(name);

  // Platform-managed style/preset libraries — anyone reads, only admins mutate
  const publicReadPresets = [
    "CoverArtStyle", "VideoStyle", "TypographyStyle", "MasteringPreset",
    "ExploreFeatureCard",
  ];

  const nextAuth = ["Account", "Session", "VerificationToken"].includes(name);

  // Decide pattern bucket
  let pattern = "F-AMBIGUOUS";
  let owner = "?";
  if (nextAuth) {
    pattern = "E-NEXTAUTH";
    owner = "system (NextAuth adapter)";
  } else if (adminOnly) {
    pattern = "D-ADMIN-ONLY";
    owner = "service_role only";
  } else if (hasUserId) {
    pattern = "A-USER-OWNED";
    owner = "userId";
  } else if (hasArtistId) {
    pattern = "A-USER-OWNED";
    owner = "artistId (User)";
  } else if (hasProducerId) {
    pattern = "A-USER-OWNED";
    owner = "producerId (User)";
  } else if (hasOwnerId) {
    pattern = "A-USER-OWNED";
    owner = "ownerId (User)";
  } else if (hasCreatorId) {
    pattern = "A-USER-OWNED";
    owner = "creatorId (User)";
  } else if (hasDjId) {
    pattern = "A-USER-OWNED";
    owner = "djId (User)";
  } else if (hasReferrerId) {
    pattern = "A-USER-OWNED";
    owner = "referrerId (User)";
  } else if (hasAuthorId) {
    pattern = "A-USER-OWNED";
    owner = "authorId (User)";
  } else if (hasFromUserId) {
    pattern = "A-USER-OWNED";
    owner = "fromUserId (User)";
  } else if (hasBuyerId) {
    pattern = "A-USER-OWNED";
    owner = "buyerId (User)";
  } else if (hasReferrerUserId) {
    pattern = "A-USER-OWNED";
    owner = "referrerUserId (User)";
  } else if (name === "User") {
    pattern = "A-USER-OWNED";
    owner = "self (id = auth.uid)";
  } else if (name === "PendingSignup") {
    pattern = "D-ADMIN-ONLY";
    owner = "service_role only (pre-auth signup state)";
  } else if (fkRefs.length > 0) {
    pattern = "C-INDIRECT";
    owner = `via FK: ${fkRefs.join(", ")}`;
  }

  // Apply public-read presets override (even if other patterns matched)
  if (publicReadPresets.includes(name)) {
    pattern = "B-PUBLIC-READ";
    owner = "platform-managed (public read, admin write)";
  }

  return { name, pattern, owner };
}

const classified = models.map(classify).sort((a, b) =>
  a.pattern.localeCompare(b.pattern) || a.name.localeCompare(b.name)
);

// Summary
const summary = {};
for (const c of classified) {
  summary[c.pattern] = (summary[c.pattern] || 0) + 1;
}

let md = "# RLS Inventory — All `public` schema tables\n\n";
md += "_Generated by `scripts/rls-inventory.mjs` from `prisma/schema.prisma`._\n\n";
md += "## Pattern summary\n\n";
md += "| Pattern | Count | Meaning |\n|---|---|---|\n";
md += `| A-USER-OWNED | ${summary["A-USER-OWNED"] || 0} | Direct user-ownership column (userId / artistId / producerId / etc.) |\n`;
md += `| B-PUBLIC-READ | ${summary["B-PUBLIC-READ"] || 0} | Platform-managed, anyone can read |\n`;
md += `| C-INDIRECT | ${summary["C-INDIRECT"] || 0} | Ownership lives on a parent row (joined FK) |\n`;
md += `| D-ADMIN-ONLY | ${summary["D-ADMIN-ONLY"] || 0} | Service-role / admin only — no anon access ever |\n`;
md += `| E-NEXTAUTH | ${summary["E-NEXTAUTH"] || 0} | NextAuth adapter system tables |\n`;
md += `| F-AMBIGUOUS | ${summary["F-AMBIGUOUS"] || 0} | **NEEDS YOUR DECISION** |\n`;
md += `| **TOTAL** | **${classified.length}** | |\n\n`;

md += "## Per-table classification\n\n";
md += "| Table | Pattern | Ownership column / source |\n|---|---|---|\n";
for (const c of classified) {
  md += `| \`${c.name}\` | ${c.pattern} | ${c.owner} |\n`;
}

fs.writeFileSync(path.resolve("prisma/manual/rls_inventory.md"), md);
console.log(`Wrote ${classified.length} tables → prisma/manual/rls_inventory.md`);
console.log("Summary:", summary);
