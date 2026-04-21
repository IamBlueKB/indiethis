/**
 * /mix-console/results?token=xxx
 *
 * Guest tokenized results page. Validates MixAccessToken and renders
 * the compare/export UI for users who arrive via email link.
 */

import { notFound } from "next/navigation";
import { db as prisma } from "@/lib/db";
import { MixResultsClient } from "./MixResultsClient";

export const metadata = {
  title: "Your Mix Results — IndieThis",
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

  // Validate token
  const accessToken = await prisma.mixAccessToken.findUnique({
    where: { token },
    include: { job: true },
  });

  const isExpired = accessToken ? accessToken.expiresAt < new Date() : false;

  if (!accessToken || isExpired) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
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
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-4xl mb-4">⚙️</p>
          <h1 className="text-xl font-bold mb-2">Still processing</h1>
          <p className="text-sm" style={{ color: "#666" }}>
            Your mix isn&apos;t ready yet. Check back shortly — we&apos;ll also email you when it&apos;s done.
          </p>
        </div>
      </div>
    );
  }

  // Serialize job to plain object for client component
  const jobData = {
    id:                 job.id,
    mode:               job.mode,
    tier:               job.tier,
    status:             job.status,
    previewFilePaths:   job.previewFilePaths   as Record<string, string> | null,
    cleanFilePath:      job.cleanFilePath,
    polishedFilePath:   job.polishedFilePath,
    aggressiveFilePath: job.aggressiveFilePath,
    mixFilePath:        job.mixFilePath,
    revisionCount:      job.revisionCount,
    maxRevisions:       job.maxRevisions,
    createdAt:          job.createdAt.toISOString(),
  };

  return (
    <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
      <MixResultsClient jobData={jobData} accessToken={token} />
    </div>
  );
}
