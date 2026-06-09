/**
 * Generates the RLS migration SQL from the inventory output.
 *
 * Strategy (Interpretation A, confirmed):
 *   - Prisma uses a BYPASSRLS role → policies do not affect app behavior.
 *   - service_role bypasses RLS by default (Supabase) → server-side Supabase
 *     storage signing / SDK calls keep working.
 *   - Anon PostgREST role gets default-deny on every table (RLS enabled +
 *     zero policies = deny by default for non-bypass roles).
 *
 * For Pattern B (B-PUBLIC-READ — platform style libraries), we add an
 * anon SELECT policy so /api/og/style and similar public endpoints could
 * read styles via PostgREST if ever needed. Today everything is fetched
 * via Prisma so even these tables work without that policy — but it's
 * a cheap, explicit signal of intent.
 */
import fs from "node:fs";
import path from "node:path";

const md = fs.readFileSync(path.resolve("prisma/manual/rls_inventory.md"), "utf8");

// Parse the per-table table — lines look like: | `TableName` | PATTERN | ... |
const lines = md.split("\n");
const tableRe = /^\|\s*`([A-Za-z0-9_]+)`\s*\|\s*([A-Z]-[A-Z-]+)\s*\|/;
const rows = [];
for (const line of lines) {
  const m = tableRe.exec(line);
  if (m) rows.push({ name: m[1], pattern: m[2] });
}

const byPattern = {
  "A-USER-OWNED":  [],
  "B-PUBLIC-READ": [],
  "C-INDIRECT":    [],
  "D-ADMIN-ONLY":  [],
  "E-NEXTAUTH":    [],
};
for (const r of rows) byPattern[r.pattern]?.push(r.name);

let sql = "";
sql += "-- =============================================================================\n";
sql += "-- ENABLE ROW LEVEL SECURITY — IndieThis Pre-Launch Hardening, Phase 1.1\n";
sql += "-- =============================================================================\n";
sql += "--\n";
sql += "-- Strategy (Interpretation A, confirmed with Blue):\n";
sql += "--\n";
sql += "--   * Prisma connects with a BYPASSRLS Postgres role. RLS policies on these\n";
sql += "--     tables do NOT affect Prisma queries — the app keeps working exactly as\n";
sql += "--     it does today. Zero functional risk.\n";
sql += "--\n";
sql += "--   * Supabase service_role key bypasses RLS by default. Server-side Supabase\n";
sql += "--     SDK / storage signing / cog inputs continue to work.\n";
sql += "--\n";
sql += "--   * The Supabase anon role (used by PostgREST and Realtime) is denied\n";
sql += "--     everything on every table by default. Enabling RLS without attaching\n";
sql += "--     a policy = default deny for non-bypass roles.\n";
sql += "--\n";
sql += "--   * This is the 'locked door behind the locked door' — protects against:\n";
sql += "--       - an anon key leaking and being used against the PostgREST endpoint\n";
sql += "--       - someone enabling Realtime on a table by accident\n";
sql += "--       - future migration to Supabase Auth without revisiting permissions\n";
sql += "--\n";
sql += "-- Pattern legend (see prisma/manual/rls_inventory.md):\n";
sql += "--   A-USER-OWNED   — direct user-ownership column\n";
sql += "--   B-PUBLIC-READ  — platform-managed style/preset library\n";
sql += "--   C-INDIRECT     — ownership via FK to a parent row\n";
sql += "--   D-ADMIN-ONLY   — service_role only, no anon access ever\n";
sql += "--   E-NEXTAUTH     — NextAuth adapter system tables\n";
sql += "--\n";
sql += "-- WARNINGS BEFORE APPLYING:\n";
sql += "--   1. This is idempotent — re-runnable safely.\n";
sql += "--   2. Verify your Prisma role bypasses RLS BEFORE applying. Run in\n";
sql += "--      Supabase SQL editor:\n";
sql += "--          SELECT current_user, rolbypassrls\n";
sql += "--            FROM pg_roles WHERE rolname = current_user;\n";
sql += "--      If rolbypassrls = false, this migration WILL break Prisma queries.\n";
sql += "--   3. Storage bucket privacy is set in the Supabase dashboard — NOT covered\n";
sql += "--      by this SQL. Verify after applying.\n";
sql += "--   4. PostgREST / Realtime exposure: if you want belt-and-suspenders,\n";
sql += "--      revoke anon role from schema 'public' in the Supabase dashboard too.\n";
sql += "--\n";
sql += "-- Apply via Supabase SQL editor. No Prisma migration file is generated\n";
sql += "-- because this is a Postgres-native concern not modeled by Prisma.\n";
sql += "-- =============================================================================\n\n";

sql += "BEGIN;\n\n";

function block(title, names, policySql) {
  if (names.length === 0) return "";
  let s = `-- --- ${title} (${names.length} tables) ---\n`;
  for (const n of names.sort()) {
    s += `ALTER TABLE "public"."${n}" ENABLE ROW LEVEL SECURITY;\n`;
    if (policySql) s += policySql(n);
  }
  s += "\n";
  return s;
}

// A — user-owned. Default deny is enough (Prisma reads/writes; PostgREST denied).
sql += block(
  "PATTERN A — USER-OWNED (default deny; only service_role + Prisma access)",
  byPattern["A-USER-OWNED"],
);

// B — public-read presets. Add an explicit anon SELECT policy so reads via
// PostgREST are an intentional, named decision rather than an accident.
sql += block(
  "PATTERN B — PUBLIC-READ presets (anon SELECT allowed; writes admin only)",
  byPattern["B-PUBLIC-READ"],
  (n) => `CREATE POLICY "public_read_${n.toLowerCase()}" ON "public"."${n}"\n  FOR SELECT TO anon, authenticated USING (true);\n`,
);

// C — indirect ownership. Same default-deny as A.
sql += block(
  "PATTERN C — INDIRECT ownership (default deny; service_role + Prisma access)",
  byPattern["C-INDIRECT"],
);

// D — admin only. Strictest. Same default-deny mechanics; documentation only.
sql += block(
  "PATTERN D — ADMIN-ONLY (default deny; service_role only by design)",
  byPattern["D-ADMIN-ONLY"],
);

// E — NextAuth system tables.
sql += block(
  "PATTERN E — NEXTAUTH system tables (default deny; managed by adapter)",
  byPattern["E-NEXTAUTH"],
);

sql += "-- =============================================================================\n";
sql += "-- Verification queries (run AFTER applying):\n";
sql += "-- =============================================================================\n";
sql += "--\n";
sql += "-- 1. Confirm every table now has RLS enabled:\n";
sql += "--   SELECT relname, relrowsecurity FROM pg_class c\n";
sql += "--     JOIN pg_namespace n ON n.oid = c.relnamespace\n";
sql += "--     WHERE n.nspname = 'public' AND c.relkind = 'r' AND relrowsecurity = false;\n";
sql += "--   Expected: 0 rows.\n";
sql += "--\n";
sql += "-- 2. Confirm anon role cannot SELECT from a sensitive table:\n";
sql += "--   SET ROLE anon;\n";
sql += "--   SELECT count(*) FROM \"public\".\"User\";  -- expect: permission denied (0 rows)\n";
sql += "--   RESET ROLE;\n";
sql += "--\n";
sql += "-- 3. Confirm public-read presets still readable by anon (B-PUBLIC-READ):\n";
sql += "--   SET ROLE anon;\n";
sql += "--   SELECT count(*) FROM \"public\".\"CoverArtStyle\";  -- expect: works\n";
sql += "--   RESET ROLE;\n";
sql += "--\n";
sql += "-- 4. Confirm Prisma still works (smoke-test from the app):\n";
sql += "--   Hit /explore, /dashboard, /master — all should respond normally.\n";
sql += "-- =============================================================================\n\n";

sql += "COMMIT;\n";

fs.writeFileSync(path.resolve("prisma/manual/enable_rls.sql"), sql);
console.log(`Wrote SQL → prisma/manual/enable_rls.sql`);
console.log(`  A-USER-OWNED:  ${byPattern["A-USER-OWNED"].length}`);
console.log(`  B-PUBLIC-READ: ${byPattern["B-PUBLIC-READ"].length}  (with SELECT policy for anon)`);
console.log(`  C-INDIRECT:    ${byPattern["C-INDIRECT"].length}`);
console.log(`  D-ADMIN-ONLY:  ${byPattern["D-ADMIN-ONLY"].length}`);
console.log(`  E-NEXTAUTH:    ${byPattern["E-NEXTAUTH"].length}`);
console.log(`  TOTAL:         ${rows.length}`);
