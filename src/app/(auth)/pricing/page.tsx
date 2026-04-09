import type { Metadata } from "next";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title:       "Pricing — IndieThis",
  description: "Simple, transparent pricing for independent artists. Pay per track or subscribe to save up to 50% on AI tools.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
