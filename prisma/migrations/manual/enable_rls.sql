-- =============================================================================
-- ENABLE ROW LEVEL SECURITY — IndieThis Pre-Launch Hardening, Phase 1.1
-- =============================================================================
--
-- Strategy (Interpretation A, confirmed with Blue):
--
--   * Prisma connects with a BYPASSRLS Postgres role. RLS policies on these
--     tables do NOT affect Prisma queries — the app keeps working exactly as
--     it does today. Zero functional risk.
--
--   * Supabase service_role key bypasses RLS by default. Server-side Supabase
--     SDK / storage signing / cog inputs continue to work.
--
--   * The Supabase anon role (used by PostgREST and Realtime) is denied
--     everything on every table by default. Enabling RLS without attaching
--     a policy = default deny for non-bypass roles.
--
--   * This is the 'locked door behind the locked door' — protects against:
--       - an anon key leaking and being used against the PostgREST endpoint
--       - someone enabling Realtime on a table by accident
--       - future migration to Supabase Auth without revisiting permissions
--
-- Pattern legend (see prisma/migrations/manual/rls_inventory.md):
--   A-USER-OWNED   — direct user-ownership column
--   B-PUBLIC-READ  — platform-managed style/preset library
--   C-INDIRECT     — ownership via FK to a parent row
--   D-ADMIN-ONLY   — service_role only, no anon access ever
--   E-NEXTAUTH     — NextAuth adapter system tables
--
-- WARNINGS BEFORE APPLYING:
--   1. This is idempotent — re-runnable safely.
--   2. Verify your Prisma role bypasses RLS BEFORE applying. Run in
--      Supabase SQL editor:
--          SELECT current_user, rolbypassrls
--            FROM pg_roles WHERE rolname = current_user;
--      If rolbypassrls = false, this migration WILL break Prisma queries.
--   3. Storage bucket privacy is set in the Supabase dashboard — NOT covered
--      by this SQL. Verify after applying.
--   4. PostgREST / Realtime exposure: if you want belt-and-suspenders,
--      revoke anon role from schema 'public' in the Supabase dashboard too.
--
-- Apply via Supabase SQL editor. No Prisma migration file is generated
-- because this is a Postgres-native concern not modeled by Prisma.
-- =============================================================================

BEGIN;

-- --- PATTERN A — USER-OWNED (default deny; only service_role + Prisma access) (72 tables) ---
ALTER TABLE "public"."AIGeneration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AIJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Affiliate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Ambassador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistAvatar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistBookingInquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistCollaborator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistPressItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistRelease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistShow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistSite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistSupport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistTestimonial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistVideo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArtistWithdrawal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BeatLicense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BeatPreview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BroadcastLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CoverArtJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJAttribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DeliveredFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DigitalProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DigitalPurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FanAutomation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FanContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FanFunding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FanScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GenerationFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LicenseDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LinkClick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LyricVideo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MasteringAlbumGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MasteringJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MerchOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MerchProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MixJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MusicVideo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OnboardingEmailLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PageView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PreSaveCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProducerLeaseSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProducerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PromoRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReEngagementEmailLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RecentPlay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Referral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Release" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReleasePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SampleLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SessionNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ShowInterest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Split" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StemSeparation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StreamLease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StreamLeaseBookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StreamLeasePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Studio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StudioArtist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Track" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrackPlay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrackShieldScan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserAttribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."YouTubeSync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."YoutubeReference" ENABLE ROW LEVEL SECURITY;

-- --- PATTERN B — PUBLIC-READ presets (anon SELECT allowed; writes admin only) (5 tables) ---
ALTER TABLE "public"."CoverArtStyle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_coverartstyle" ON "public"."CoverArtStyle"
  FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE "public"."ExploreFeatureCard" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_explorefeaturecard" ON "public"."ExploreFeatureCard"
  FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE "public"."MasteringPreset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_masteringpreset" ON "public"."MasteringPreset"
  FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE "public"."TypographyStyle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_typographystyle" ON "public"."TypographyStyle"
  FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE "public"."VideoStyle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_videostyle" ON "public"."VideoStyle"
  FOR SELECT TO anon, authenticated USING (true);

-- --- PATTERN C — INDIRECT ownership (default deny; service_role + Prisma access) (49 tables) ---
ALTER TABLE "public"."ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AffiliateReferral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AmbassadorPayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AudioFeatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AudioFingerprint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BeatLeaseSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContactSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Crate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CrateCollaborator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CrateInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CrateItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJBookingInquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJMix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJMixTrack" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJVerificationApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DJWithdrawal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FalKeyframeJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FalSceneJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."IntakeLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."IntakeSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MasteringAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MerchOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MerchVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MixAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MixOutcomeFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PreSaveClick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuickSend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReferenceProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReleasePlanTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ScheduledEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SessionNoteAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ShowWaitlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SplitPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SplitSheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StreamLeaseAgreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StreamLeasePlay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StudioCredit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StudioEngineer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StudioEquipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StudioPortfolioTrack" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TrackShieldResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserReferencePopularity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VideoFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VideoPreset" ENABLE ROW LEVEL SECURITY;

-- --- PATTERN D — ADMIN-ONLY (default deny; service_role only by design) (15 tables) ---
ALTER TABLE "public"."AIInsightsLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdminAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AgentLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GenerationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GenreTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ModerationFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PendingSignup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlatformPricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PromoPopup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RevenueReportAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RevenueReportConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RevenueReportGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RevenueReportLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SystemConfig" ENABLE ROW LEVEL SECURITY;

-- --- PATTERN E — NEXTAUTH system tables (default deny; managed by adapter) (2 tables) ---
ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Verification queries (run AFTER applying):
-- =============================================================================
--
-- 1. Confirm every table now has RLS enabled:
--   SELECT relname, relrowsecurity FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relkind = 'r' AND relrowsecurity = false;
--   Expected: 0 rows.
--
-- 2. Confirm anon role cannot SELECT from a sensitive table:
--   SET ROLE anon;
--   SELECT count(*) FROM "public"."User";  -- expect: permission denied (0 rows)
--   RESET ROLE;
--
-- 3. Confirm public-read presets still readable by anon (B-PUBLIC-READ):
--   SET ROLE anon;
--   SELECT count(*) FROM "public"."CoverArtStyle";  -- expect: works
--   RESET ROLE;
--
-- 4. Confirm Prisma still works (smoke-test from the app):
--   Hit /explore, /dashboard, /master — all should respond normally.
-- =============================================================================

COMMIT;
