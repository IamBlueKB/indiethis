/**
 * scripts/create-stripe-prices.mjs
 * One-time script — creates IndieThis subscription products + monthly prices in Stripe.
 * Run: node scripts/create-stripe-prices.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read .env.local
const envPath = resolve(__dirname, "../.env.local");
const envRaw  = readFileSync(envPath, "utf-8");
const env     = Object.fromEntries(
  envRaw.split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const secretKey = env.STRIPE_SECRET_KEY;
if (!secretKey) { console.error("STRIPE_SECRET_KEY not found in .env.local"); process.exit(1); }

const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });

const PLANS = [
  { name: "IndieThis Launch",       envKey: "STRIPE_PRICE_LAUNCH",       amount: 1900 },
  { name: "IndieThis Push",         envKey: "STRIPE_PRICE_PUSH",         amount: 4900 },
  { name: "IndieThis Reign",        envKey: "STRIPE_PRICE_REIGN",        amount: 9900 },
  { name: "IndieThis Studio Pro",   envKey: "STRIPE_PRICE_STUDIO_PRO",   amount: 4900 },
  { name: "IndieThis Studio Elite", envKey: "STRIPE_PRICE_STUDIO_ELITE", amount: 9900 },
];

const results = {};

for (const plan of PLANS) {
  console.log(`Creating: ${plan.name} — $${(plan.amount / 100).toFixed(2)}/mo`);

  const product = await stripe.products.create({
    name:     plan.name,
    metadata: { platform: "indiethis" },
  });

  const price = await stripe.prices.create({
    product:      product.id,
    unit_amount:  plan.amount,
    currency:     "usd",
    recurring:    { interval: "month" },
    metadata:     { platform: "indiethis", plan: plan.envKey },
  });

  results[plan.envKey] = price.id;
  console.log(`  ✓ ${plan.envKey}=${price.id}`);
}

// Print .env.local additions
console.log("\n─── Add to .env.local ───────────────────────────────");
for (const [key, value] of Object.entries(results)) {
  console.log(`${key}=${value}`);
}

// Write results to a temp file so the calling process can read them
import { writeFileSync } from "fs";
writeFileSync(resolve(__dirname, "stripe-prices-output.json"), JSON.stringify(results, null, 2));
console.log("\nOutput written to scripts/stripe-prices-output.json");
