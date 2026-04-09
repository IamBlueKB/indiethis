import { auth }            from "@/lib/auth";
import { db }             from "@/lib/db";
import { redirect }       from "next/navigation";
import { MasterPageClient } from "./MasterPageClient";

export const metadata = { title: "AI Mix & Master — IndieThis" };

export default async function MasterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sub = await db.subscription.findFirst({
    where:  { userId: session.user.id!, status: "ACTIVE" },
    select: { aiMasterCreditsUsed: true, aiMasterCreditsLimit: true },
  });

  const creditsUsed  = sub?.aiMasterCreditsUsed  ?? 0;
  const creditsLimit = sub?.aiMasterCreditsLimit ?? 0;

  return (
    <MasterPageClient
      userId={session.user.id!}
      creditsUsed={creditsUsed}
      creditsLimit={creditsLimit}
    />
  );
}
