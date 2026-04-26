import { execSync } from "child_process";

process.env.DATABASE_URL =
  "postgresql://postgres.havnsrtfdeusaggoqfms:JbBb2016%40Blue@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5";
process.env.DIRECT_URL =
  "postgresql://postgres.havnsrtfdeusaggoqfms:JbBb2016%40Blue@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

execSync("npx prisma migrate deploy", {
  cwd: "C:/Users/brian/Documents/indiethis",
  stdio: "inherit",
});
