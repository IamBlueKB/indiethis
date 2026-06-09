-- =============================================================================
-- Patch: enable RLS on Prisma-managed underscore tables
-- =============================================================================
-- The main RLS migration (enable_rls.sql) enabled RLS on the 143 user-facing
-- public tables. Two Prisma-managed system tables were not in the inventory
-- because they're auto-generated rather than declared as models:
--
--   _DigitalProductTracks — implicit many-to-many junction for the
--     DigitalProduct ↔ Track relation.
--   _prisma_migrations    — Prisma's own migration history table.
--
-- Neither is reachable by anon today (anon has no USAGE on schema public —
-- verified post-apply) but enabling RLS here is belt-and-suspenders against
-- a future GRANT being added by mistake.
--
-- Idempotent — safe to re-run. No policies attached → default deny for
-- non-bypass roles. service_role and the BYPASSRLS Prisma role continue to
-- access these tables normally.
-- =============================================================================

BEGIN;

ALTER TABLE "public"."_DigitalProductTracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations"     ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verify:
--   SELECT relname, relrowsecurity FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relkind = 'r' AND relrowsecurity = false;
-- Expected: 0 rows.
