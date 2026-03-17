/**
 * Dolby.io AI Mastering service
 *
 * Both Quick and Studio Grade tiers use the same Dolby.io Mastering API.
 * The difference is the loudness target and processing profile exposed
 * to the artist — not a different backend.
 *
 * Auth flow:
 *  Dolby uses App Key + App Secret → JwtToken { access_token, expires_in }
 *  Token is cached for 25 min (Dolby default is 30 min).
 *
 * Processing flow:
 *  1. Upload source via getDolbyUploadUrl → dlb:// reference + signed PUT URL
 *  2. startMastering(options) → jobId
 *  3. pollMasteringJob(jobId) → MasteringJob (status: Success | Failed …)
 *  4. getDolbyDownloadUrl(dlbUrl) → signed HTTPS download URL
 *  5. (Optional) previewMastering(options) for A/B comparison
 *
 * API reference: https://docs.dolby.io/media-apis/docs/mastering-api
 */

import * as dolby from "@dolbyio/dolbyio-rest-apis-client";

// Dolby SDK internal JwtToken shape
interface JwtToken {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mastering tier determines the loudness target (LUFS).
 * Quick: -14 LUFS — streaming-standard (Spotify / Apple Music)
 * Studio: -9 LUFS  — commercial loudness (radio-ready, aggressive)
 */
export type MasteringTier = "quick" | "studio";

/** Dolby mastering preset (music genre/sound profile) */
export type MasteringPreset =
  | "A"   // Balanced (default)
  | "B"   // Bright / pop-forward
  | "C"   // Warm / bass-forward
  | "D"   // Dynamic / acoustic
  | "E"   // Electronic / aggressive
  | "F";  // Film / cinematic

export interface StartMasteringOptions {
  /** dlb:// or https URL of the unmastered track */
  inputUrl: string;
  /** dlb:// URL where the mastered file will be stored */
  outputUrl: string;
  /** Mastering tier — controls loudness target */
  tier: MasteringTier;
  /** Music genre profile. Defaults to "A" (balanced). */
  preset?: MasteringPreset;
}

export interface MasteringPreviewOptions {
  inputUrl: string;
  outputUrl: string;
  tier: MasteringTier;
  preset?: MasteringPreset;
  /** Preview start time in seconds (default 0) */
  startTime?: number;
  /** Preview duration in seconds (max 30, default 30) */
  duration?: number;
}

export interface MasteringJob {
  jobId: string;
  status: "Pending" | "Running" | "Success" | "Failed" | "Canceled" | "Expired";
  completedAt?: string;
  error?: string;
  /** Measured output loudness in LUFS (available when Success) */
  outputLoudness?: number;
}

// ---------------------------------------------------------------------------
// Loudness targets by tier
// ---------------------------------------------------------------------------

const LOUDNESS_TARGET: Record<MasteringTier, number> = {
  quick:  -14,
  studio:  -9,
};

// ---------------------------------------------------------------------------
// JWT token cache (25-minute TTL)
// ---------------------------------------------------------------------------

let _tokenCache: { token: JwtToken; expiresAt: number } | null = null;

async function getAccessToken(): Promise<JwtToken> {
  const now = Date.now();
  if (_tokenCache && now < _tokenCache.expiresAt) return _tokenCache.token;

  const appKey    = requireEnv("DOLBY_APP_KEY");
  const appSecret = requireEnv("DOLBY_APP_SECRET");

  const jwt = (await dolby.media.authentication.getApiAccessToken(
    appKey,
    appSecret,
    1800
  )) as JwtToken;

  _tokenCache = {
    token: jwt,
    expiresAt: now + 25 * 60 * 1000,
  };
  return jwt;
}

// ---------------------------------------------------------------------------
// Core mastering helpers
// ---------------------------------------------------------------------------

/**
 * Start a full mastering job.
 * Returns the Dolby job ID — use `pollMasteringJob` to wait for completion.
 */
export async function startMastering(
  options: StartMasteringOptions
): Promise<string> {
  const token    = await getAccessToken();
  const loudness = LOUDNESS_TARGET[options.tier];
  const preset   = options.preset ?? "A";

  const jobSpec = {
    inputs:  [{ source: options.inputUrl }],
    outputs: [{
      destination: options.outputUrl,
      master: {
        dynamic_eq: { enable: true, preset },
        loudness: {
          enable:              true,
          dialog_intelligence: false,
          peak:                -1.0,
          loudness:            loudness,
        },
      },
    }],
  };

  const jobId = await dolby.media.mastering.start(
    token,
    JSON.stringify(jobSpec)
  );
  return jobId ?? "";
}

/**
 * Start a preview mastering job (up to 30 seconds) for A/B comparison.
 * Returns the Dolby job ID.
 */
export async function startMasteringPreview(
  options: MasteringPreviewOptions
): Promise<string> {
  const token    = await getAccessToken();
  const loudness = LOUDNESS_TARGET[options.tier];
  const preset   = options.preset ?? "A";
  const start    = options.startTime ?? 0;
  const duration = Math.min(options.duration ?? 30, 30);

  const jobSpec = {
    inputs:  [{ source: options.inputUrl }],
    outputs: [{
      destination: options.outputUrl,
      master: {
        dynamic_eq: { enable: true, preset },
        loudness: {
          enable:              true,
          dialog_intelligence: false,
          peak:                -1.0,
          loudness:            loudness,
        },
      },
      segment: { start, duration },
    }],
  };

  const jobId = await dolby.media.mastering.startPreview(
    token,
    JSON.stringify(jobSpec)
  );
  return jobId ?? "";
}

/**
 * Poll a mastering job until it reaches a terminal state.
 *
 * @param jobId      - Job ID from startMastering / startMasteringPreview
 * @param preview    - true if polling a preview job
 * @param intervalMs - Polling interval (default 3000ms)
 * @param timeoutMs  - Max wait time (default 300000ms = 5 min)
 */
export async function pollMasteringJob(
  jobId: string,
  preview = false,
  intervalMs = 3_000,
  timeoutMs  = 300_000
): Promise<MasteringJob> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const token = await getAccessToken();

    const result = preview
      ? await dolby.media.mastering.getPreviewResults(token, jobId)
      : await dolby.media.mastering.getResults(token, jobId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    const status = r?.status as MasteringJob["status"];

    if (["Success", "Failed", "Canceled", "Expired"].includes(status)) {
      return {
        jobId,
        status,
        completedAt:    r?.progress?.completed_at,
        error:          r?.error?.title,
        outputLoudness: r?.result?.loudness?.measured_loudness,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Mastering job ${jobId} timed out after ${timeoutMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Convenience: master + poll in one call
// ---------------------------------------------------------------------------

/**
 * Start a mastering job and wait for completion.
 * For long-running jobs, prefer webhook-based polling instead.
 */
export async function masterTrack(
  options: StartMasteringOptions
): Promise<MasteringJob> {
  const jobId = await startMastering(options);
  return pollMasteringJob(jobId, false);
}

/**
 * Generate a 30-second A/B preview and wait for completion.
 */
export async function previewMastering(
  options: MasteringPreviewOptions
): Promise<MasteringJob> {
  const jobId = await startMasteringPreview(options);
  return pollMasteringJob(jobId, true);
}

// ---------------------------------------------------------------------------
// Dolby I/O helpers (temporary storage URLs)
// ---------------------------------------------------------------------------

/**
 * Get a temporary upload URL for uploading an unmastered track to Dolby storage.
 * Returns the dlb:// reference and the signed HTTPS PUT URL.
 */
export async function getDolbyUploadUrl(filename: string): Promise<{
  dlbUrl: string;
  uploadUrl: string;
}> {
  const token = await getAccessToken();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await dolby.media.io.getUploadUrl(token, filename);
  return {
    dlbUrl:    result?.url       as string,
    uploadUrl: result?.signed_url ?? (result?.upload_url as string),
  };
}

/**
 * Get a temporary HTTPS download URL for a processed dlb:// file.
 */
export async function getDolbyDownloadUrl(dlbUrl: string): Promise<string> {
  const token = await getAccessToken();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await dolby.media.io.getDownloadUrl(token, dlbUrl);
  return result?.url as string;
}
