import Stripe from "stripe";

declare global { var stripe: Stripe | undefined; }

export const stripe =
  process.env.STRIPE_SECRET_KEY
    ? (globalThis.stripe ??
        new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2026-02-25.clover",
          typescript: true,
        }))
    : null;

if (process.env.NODE_ENV !== "production" && stripe) globalThis.stripe = stripe;

// Stripe Price IDs — set these in .env.local after creating products in Stripe dashboard
// STRIPE_PRICE_LAUNCH=price_xxx
// STRIPE_PRICE_PUSH=price_xxx
// STRIPE_PRICE_REIGN=price_xxx

export const PLAN_PRICES: Record<string, { priceId: string; tier: string; amount: number }> = {
  launch: { priceId: process.env.STRIPE_PRICE_LAUNCH ?? "", tier: "LAUNCH", amount: 1900 },
  push:   { priceId: process.env.STRIPE_PRICE_PUSH   ?? "", tier: "PUSH",   amount: 4900 },
  reign:  { priceId: process.env.STRIPE_PRICE_REIGN  ?? "", tier: "REIGN",  amount: 9900 },
};
