import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import AmbassadorDashboard from "./AmbassadorDashboard";

export default async function AmbassadorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Find ambassador by any of their promo codes
  const promoCode = await db.promoCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { ambassador: true },
  });

  if (!promoCode?.ambassador || !promoCode.ambassador.isActive) {
    notFound();
  }

  return <AmbassadorDashboard code={code.toUpperCase()} ambassadorName={promoCode.ambassador.name} />;
}
