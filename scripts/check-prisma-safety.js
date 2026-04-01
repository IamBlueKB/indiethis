#!/usr/bin/env node
/**
 * check-prisma-safety.js
 *
 * Runs as the `predbpush` npm script before any `prisma db push`.
 * Blocks execution if dangerous flags are detected that have
 * previously wiped this database TWICE.
 */

const args = process.argv.join(' ');

if (args.includes('force-reset') || args.includes('accept-data-loss')) {
  console.error('\n🚨 BLOCKED: --force-reset and --accept-data-loss are PERMANENTLY BANNED on this project.');
  console.error('This command has wiped the database TWICE. It will never be allowed again.');
  console.error('If you need to make schema changes, use: npx prisma db push\n');
  process.exit(1);
}
