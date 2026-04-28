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
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl }       from "@aws-sdk/s3-request-presigner";

export const dynamic = "force-dynamic";

// Stems are stored as 4-hour presigned S3 URLs in MixJob.inputFiles. After
// expiry, the browser fetch fails with 403 and the studio shows "Failed to
// load" for every stem. We extract the S3 key from the stored URL and
// re-sign at request time so URLs handed to the client are always fresh.
const S3_REGION = process.env.AWS_REGION ?? "us-east-1";
const S3_BUCKET = (() => {
  const url = process.env.REMOTION_SERVE_URL ?? "";
  const m   = url.match(/^https?:\/\/([^.]+)\.s3\./);
  return m?.[1] ?? "";
})();
const s3 = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ? new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

async function freshenStemUrl(rawUrl: string): Promise<string> {
  if (!s3 || !S3_BUCKET) return rawUrl;
  try {
    const u = new URL(rawUrl);
    // Only re-sign URLs hosted on our own S3 bucket. Leave anything else
    // (UploadThing, fal.ai, etc.) alone.
    if (!u.hostname.includes(`${S3_BUCKET}.s3.`)) return rawUrl;
    const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
    if (!key) return rawUrl;
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    return await getSignedUrl(s3, cmd, { expiresIn: 14400 });
  } catch {
    return rawUrl;
  }
}

export const metadata = {
  title:       "Pro Studio Mixer — IndieThis",
  description: "Fine-tune your AI mix with hands-on controls.",
};

interface InputFile {
  url:    string;
  label:  string;
  role?:  string;
  name?:  string;
}

// Derive a clean, human-readable track title. Priority:
//   1) Job-level metadata if present (referenceFileName is reference, skip).
//   2) Filename from the first input file's URL (strip extension, replace
//      underscores/dashes with spaces, title-case words).
//   3) Fallback: "Your track".
function prettifyFilename(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // Pull the basename out of a URL or path.
  let s = raw.split("?")[0].split("#")[0];
  s = decodeURIComponent(s.substring(s.lastIndexOf("/") + 1));
  // Drop common audio extensions.
  s = s.replace(/\.(wav|mp3|flac|aiff?|m4a|ogg|opus)$/i, "");
  // Strip leading UUID (8-4-4-4-12 hex) that storage layers prepend.
  s = s.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[ _-]*/i, "");
  // Strip leading short hash / nanoid-style prefix (8+ hex chars + separator).
  s = s.replace(/^[0-9a-f]{8,}[ _-]+/i, "");
  // Drop a trailing _vocals/_beat/_stem token if present.
  s = s.replace(/[ _-]*(vocals?|beat|instrumental|stems?|main|lead)$/i, "");
  // Replace separators with spaces.
  s = s.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  // Title-case each word but preserve all-caps tokens (acronyms).
  return s
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
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
  // Re-sign S3 URLs in parallel so the browser never gets a stale presigned URL
  // (the originals are 4h presigned URLs stored at upload time).
  const inputFiles = ((job.inputFiles ?? []) as unknown) as InputFile[];
  const usable     = inputFiles.filter((f) => f?.url && f?.label);
  const freshUrls  = await Promise.all(usable.map((f) => freshenStemUrl(f.url)));
  const stems: Record<string, string> = {};
  usable.forEach((f, i) => { stems[f.label] = freshUrls[i]; });

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

  // Extract Claude's full per-stem decision and translate into the studio's
  // knob domain (0..100). The studio opens sounding identical to the AI mix:
  // every control is initialized to where Claude put it.
  type EQPoint    = { type: string; freq: number; gainDb: number; q: number };
  type CompParams = { thresholdDb: number; ratio: number; attackMs: number; releaseMs: number };
  type ClaudeStemParams = {
    role?:       string;
    gainDb?:     number;
    panLR?:      number;
    pan?:        number;
    eq?:         EQPoint[];
    comp1?:      CompParams;
    reverbSend?: number;
    reverbType?: "plate" | "room" | "hall" | "cathedral" | "dry";
  };
  const mixParams  = (job.mixParameters as Record<string, unknown> | null) ?? null;
  const stemParams = (mixParams?.stemParams ?? {}) as Record<string, ClaudeStemParams>;
  // Job-level reverb style as a fallback when Claude hasn't tagged a per-stem reverbType.
  const jobReverbStyle = (mixParams?.reverbStyle ?? "plate") as "plate" | "room" | "hall" | "cathedral" | "dry";

  type ReverbType = "plate" | "room" | "hall" | "cathedral" | "dry";
  type AiOriginal = {
    gainDb:     number;
    pan:        number;
    reverb:     number;
    reverbType: ReverbType;
    brightness: number;
    delay:      number;
    comp:       number;
  };

  const aiOriginals: Record<string, AiOriginal> = {};
  const reverbTypes: Record<string, ReverbType>  = {};

  for (const role of Object.keys(stems)) {
    const p = stemParams[role] ?? {};

    // Pan: prefer panLR (Claude's canonical key), fall back to legacy `pan`.
    const pan = typeof p.panLR === "number" ? p.panLR
              : typeof p.pan   === "number" ? p.pan
              : 0;

    // Reverb wet 0..1 → knob 0..100. If Claude said reverbType="dry", knob = 0.
    const reverbWet01 = typeof p.reverbSend === "number" ? p.reverbSend : 0;
    const reverbKnob  = Math.max(0, Math.min(100, reverbWet01 * 100));

    // Reverb type: explicit per-stem field beats job-level style.
    // If Claude set reverbSend === 0, treat as effectively dry.
    let reverbType: ReverbType =
      p.reverbType ?? (reverbWet01 === 0 ? "dry" : jobReverbStyle);
    if (!["plate","room","hall","cathedral","dry"].includes(reverbType)) reverbType = "plate";

    // Brightness: read the highest-frequency highshelf in Claude's EQ.
    // Map gainDb -8..+8 → knob 0..100 (50 = flat / no shelf).
    let highshelfDb = 0;
    if (Array.isArray(p.eq)) {
      const shelves = p.eq.filter((e) => e?.type === "highshelf");
      if (shelves.length > 0) {
        const top = shelves.reduce((a, b) => ((a?.freq ?? 0) >= (b?.freq ?? 0) ? a : b));
        if (typeof top?.gainDb === "number") highshelfDb = top.gainDb;
      }
    }
    const brightnessKnob = Math.max(0, Math.min(100, 50 + (highshelfDb / 8) * 50));

    // Comp: comp1.ratio 1..6 → knob 0..100 (1.0 → 0, 6.0 → 100).
    const compRatio  = typeof p.comp1?.ratio === "number" ? p.comp1.ratio : 1;
    const compKnob   = Math.max(0, Math.min(100, ((compRatio - 1) / 5) * 100));

    aiOriginals[role] = {
      gainDb:     0,                  // delta; AI's gain is the baseline 0 dB on the fader
      pan,
      reverb:     reverbKnob,
      reverbType,
      brightness: brightnessKnob,
      delay:      0,                  // per-stem delay not in Claude output today
      comp:       compKnob,
    };
    reverbTypes[role] = reverbType;
  }

  // Best source for a track title: the original filename of the first input.
  // `inputFiles[].name` is set if the upload pipeline preserves it; otherwise
  // we derive it from the URL pathname.
  const firstFile  = inputFiles[0];
  const trackTitle =
    prettifyFilename(firstFile?.name) ??
    prettifyFilename(firstFile?.url)  ??
    "Your track";

  // Restore prior studio state if it exists (step 18 will populate it).
  type StudioStateShape = NonNullable<Parameters<typeof StudioClient>[0]["initialState"]>;
  const initialState =
    (job.studioState as unknown as StudioStateShape | null) ?? null;

  // Restore reference URL + bpm + sections for later steps.
  const referenceTrackUrl = job.referenceTrackUrl ?? null;
  type SongSectionShape = { name: string; start: number; end: number };
  const analysisData      = (job.analysisData as { bpm?: number; sections?: SongSectionShape[] } | null) ?? null;
  const bpm               = typeof analysisData?.bpm === "number" ? analysisData.bpm : 120;
  const sections          = Array.isArray(analysisData?.sections)
    ? (analysisData!.sections as SongSectionShape[]).filter(
        (s) => s && typeof s.name === "string" && typeof s.start === "number" && typeof s.end === "number"
      )
    : [];

  return (
    <div style={{ backgroundColor: "#0D0B09", minHeight: "100vh" }}>
      <ResultsHeader isGuest={false} kind="mix" />
      <StudioClient
      jobId={job.id}
      trackTitle={trackTitle}
      stems={stems}
      // Pre-Step 26: `stems` IS the raw upload, so we pass the same map.
      // The hook detects equality and the dry leg falls back to a tap on
      // the wet source (effects-bypass). After Step 26 lands, `stems` will
      // become the processed-stem URLs and `originalStems` will keep the
      // raw inputFiles URLs — at which point the slider will lazy-load
      // the raw audio for true dry blending.
      originalStems={stems}
      aiOriginals={aiOriginals}
      reverbTypes={reverbTypes}
      initialState={initialState}
      isGuest={false}
      referenceTrackUrl={referenceTrackUrl}
      bpm={bpm}
      sections={sections}
      studioRenderCount={job.studioRenderCount ?? 0}
      studioRenderExtraCredits={job.studioRenderExtraCredits ?? 0}
    />
    </div>
  );
}
