/**
 * /dashboard/ai/mix-console/[id]
 *
 * Subscriber-facing mix results page. Requires session auth, ownership
 * check on the MixJob, then renders the same MixResultsClient as the
 * guest tokenized route.
 */

import { redirect, notFound } from "next/navigation";
import { auth }               from "@/lib/auth";
import { db as prisma }       from "@/lib/db";
import { MixResultsClient }   from "@/app/mix-console/results/MixResultsClient";
import { ProcessingState }    from "@/app/mix-console/results/ProcessingState";
import { mixJobToResultsData } from "@/app/mix-console/results/load-mix-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title:       "Your Mix — IndieThis",
  description: "Your AI-mixed track is ready. Compare versions and download.",
};

export default async function SubscriberMixResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/dashboard/ai/mix-console");
  }

  const { id } = await params;

  const job = await prisma.mixJob.findUnique({ where: { id } });
  if (!job) notFound();

  if (job.userId !== session.user.id) {
    redirect("/dashboard/ai/mix-console");
  }

  // Treat REVISING the same as not-yet-COMPLETE so the artist doesn't
  // accidentally download the previous mix while the engine is overwriting
  // those files with the revised render.
  if (job.status !== "COMPLETE") {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ProcessingState jobId={job.id} initialStatus={job.status} />
      </div>
    );
  }

  const data = mixJobToResultsData(job);

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
      <MixResultsClient data={data} />
    </div>
  );
}
