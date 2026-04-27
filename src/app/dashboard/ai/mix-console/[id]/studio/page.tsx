/**
 * /dashboard/ai/mix-console/[id]/studio
 *
 * Pro Studio Mixer — subscriber route. Loads job, validates Pro tier
 * + ownership + COMPLETE status, builds stem URL map and AI baseline,
 * and renders <StudioClient />.
 *
 * Step 5/6 scope: this page exists primarily so we can test the
 * audio-graph checkpoint with real stems. The full studio API routes
 * (save/render/ai-assist/ai-polish) are wired in step 25; the
 * processed-stem render path is wired in step 26 (predict.py).
 *
 * For step 6 we use the artist's *input* stems as the playback source
 * (inputFiles[].url). Once step 26 lands, predict.py will save
 * per-stem processed WAVs and the page will swap to those instead.
 */

import { redirect, notFound } from "next/navigation";
import { auth }               from "@/lib/auth";
import { db as prisma }       from "@/lib/db";
import { ResultsHeader }      from "@/components/layout/ResultsHeader";
import { StudioClient }       from "@/app/mix-console/studio/StudioClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title:       "Pro Studio Mixer — IndieThis",
  description: "Fine-tune your AI mix with hands-on controls.",
};

interface InputFile {
  url:    string;
  label:  string;
  role?:  string;
}

export default async function StudioPage({
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

  // Pro tier gate.
  if (job.tier !== "PRO") {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ResultsHeader isGuest={false} kind="mix" />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-3xl mb-4">🔒</p>
          <h1 className="text-xl font-bold mb-2">Pro tier required</h1>
          <p className="text-sm" style={{ color: "#888" }}>
            The Studio Mixer is included with Pro tier mixes. This job was rendered on a
            different tier.
          </p>
        </div>
      </div>
    );
  }

  // Job must be COMPLETE — stems and parameters must exist.
  if (job.status !== "COMPLETE") {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ResultsHeader isGuest={false} kind="mix" />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-3xl mb-4">⏳</p>
          <h1 className="text-xl font-bold mb-2">Mix isn&apos;t ready</h1>
          <p className="text-sm" style={{ color: "#888" }}>
            Wait for your mix to finish rendering, then come back here.
          </p>
        </div>
      </div>
    );
  }

  // Build stems map from inputFiles. Filter out anything without a usable URL.
  const inputFiles = ((job.inputFiles ?? []) as unknown) as InputFile[];
  const stems: Record<string, string> = {};
  for (const f of inputFiles) {
    if (!f?.url || !f?.label) continue;
    stems[f.label] = f.url;
  }

  if (Object.keys(stems).length === 0) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", color: "#fff", minHeight: "100vh" }}>
        <ResultsHeader isGuest={false} kind="mix" />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-3xl mb-4">⚠</p>
          <h1 className="text-xl font-bold mb-2">No stems available</h1>
          <p className="text-sm" style={{ color: "#888" }}>
            We couldn&apos;t find playable stems for this job.
          </p>
        </div>
      </div>
    );
  }

  // Extract AI's per-stem pan from mixParameters.stemParams[role].pan.
  // The pan field may be -1..+1 or 0..1; mix-console uses -1..+1 (the same
  // convention the StereoPannerNode accepts). Default to 0 (centered).
  const mixParams   = (job.mixParameters as Record<string, unknown> | null) ?? null;
  const stemParams  = (mixParams?.stemParams ?? {}) as Record<string, { pan?: number }>;
  const aiOriginals: Record<string, { pan: number }> = {};
  for (const role of Object.keys(stems)) {
    const p = stemParams[role]?.pan;
    aiOriginals[role] = { pan: typeof p === "number" ? p : 0 };
  }

  const trackTitle = inputFiles[0]?.label
    ? (inputFiles[0].label.includes("vocal") ? "Your track" : inputFiles[0].label)
    : "Your track";

  // Restore prior studio state if it exists (step 18 will populate it).
  type StudioStateShape = NonNullable<Parameters<typeof StudioClient>[0]["initialState"]>;
  const initialState =
    (job.studioState as unknown as StudioStateShape | null) ?? null;

  // Restore reference URL + bpm for later steps.
  const referenceTrackUrl = job.referenceTrackUrl ?? null;
  const analysisData      = (job.analysisData as { bpm?: number } | null) ?? null;
  const bpm               = typeof analysisData?.bpm === "number" ? analysisData.bpm : 120;

  return (
    <StudioClient
      jobId={job.id}
      trackTitle={trackTitle}
      stems={stems}
      aiOriginals={aiOriginals}
      initialState={initialState}
      isGuest={false}
      referenceTrackUrl={referenceTrackUrl}
      bpm={bpm}
    />
  );
}
