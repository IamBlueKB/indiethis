/**
 * /master/results?token=xxx
 *
 * Guest results page — no login required.
 * Validates MasteringAccessToken, loads job, renders compare + download UI.
 */

import { db as prisma } from "@/lib/db";
import { MasterResultsClient } from "./MasterResultsClient";

export default async function MasterResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="No access token provided." />;
  }

  const accessToken = await prisma.masteringAccessToken.findUnique({
    where:  { token },
    include: {
      job: {
        select: {
          id:              true,
          status:          true,
          versions:        true,
          exports:         true,
          reportData:      true,
          previewUrl:      true,
          inputFileUrl:    true,
          selectedVersion: true,
          guestEmail:      true,
          guestName:       true,
          analysisData:    true,
          inputLufs:       true,
          inputBpm:        true,
          inputKey:        true,
        },
      },
    },
  });

  if (!accessToken) {
    return <ErrorPage message="This link is invalid or has already been used." />;
  }

  if (accessToken.expiresAt < new Date()) {
    return <ErrorPage message="This download link has expired. Links are valid for 7 days." />;
  }

  const job = accessToken.job;

  if (job.status !== "COMPLETE") {
    return <ErrorPage message="Your master isn't ready yet. Please check back in a few minutes." />;
  }

  return (
    <MasterResultsClient
      jobId={job.id}
      token={token}
      versions={(job.versions ?? []) as {
        name: string; lufs: number; truePeak: number; url: string; waveformData: number[];
      }[]}
      exports={(job.exports ?? []) as { platform: string; lufs: number; format: string; url: string }[]}
      reportData={(job.reportData ?? null) as {
        finalLufs: number; truePeak: number; dynamicRange: number;
        loudnessPenalties: { platform: string; penalty: number }[];
      } | null}
      previewUrl={job.previewUrl ?? ""}
      originalUrl={job.inputFileUrl ?? null}
      selectedVersion={job.selectedVersion ?? null}
      guestName={job.guestName ?? "Artist"}
      expiresAt={accessToken.expiresAt.toISOString()}
    />
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", color: "#fff" }}>
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">Link unavailable</h1>
        <p className="text-sm mb-8" style={{ color: "#777" }}>{message}</p>
        <a
          href="/master"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
          style={{ backgroundColor: "#E85D4A", color: "#fff" }}
        >
          Start a new master
        </a>
      </div>
    </div>
  );
}
