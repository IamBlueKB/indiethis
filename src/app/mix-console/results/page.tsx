/**
 * /mix-console/results?token=xxx
 *
 * Guest tokenized results page. Validates MixAccessToken, loads the full
 * MixJob row, normalizes it into the MixResultsData shape, and renders
 * MixResultsClient. The same client component is reused by the subscriber
 * route at /dashboard/ai/mix-console/[id].
 */

import { db as prisma }       from "@/lib/db";
import { MixResultsClient }   from "./MixResultsClient";
import { ProcessingState }    from "./ProcessingState";
import { mixJobToResultsData } from "./load-mix-data";
import { ResultsHeader }      from "@/components/layout/ResultsHeader";

export const dynamic = "force-dynamic";

export const metadata = {
  title:       "Your Mix Results — IndieThis",
  description: "Your AI-mixed track is ready. Compare versions and download.",
};

export default async function MixResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp    = await searchParams;
  const token = sp.token ?? null;

  if (!token) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ResultsHeader isGuest kind="mix" />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold mb-2">Missing access token</h1>
          <p className="text-sm" style={{ color: "#666" }}>
            This link appears to be incomplete. Check your email for the full link.
          </p>
        </div>
      </div>
    );
  }

  const accessToken = await prisma.mixAccessToken.findUnique({
    where:   { token },
    include: { job: true },
  });

  const isExpired = accessToken ? accessToken.expiresAt < new Date() : false;

  if (!accessToken || isExpired) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ResultsHeader isGuest kind="mix" />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-4xl mb-4">⏱</p>
          <h1 className="text-xl font-bold mb-2">
            {isExpired ? "This link has expired" : "Invalid link"}
          </h1>
          <p className="text-sm mb-6" style={{ color: "#666" }}>
            {isExpired
              ? "Mix result links expire after 7 days. Sign in to access your mix history."
              : "This link is invalid or has already been used."}
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 no-underline"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            Sign in to access your mixes
          </a>
        </div>
      </div>
    );
  }

  const job = accessToken.job;

  if (job.status !== "COMPLETE") {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ResultsHeader isGuest kind="mix" />
        <ProcessingState
          jobId={job.id}
          initialStatus={job.status}
          accessToken={token}
        />
      </div>
    );
  }

  const data = mixJobToResultsData(job);

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
      <ResultsHeader isGuest kind="mix" />
      <MixResultsClient data={data} accessToken={token} />
    </div>
  );
}
