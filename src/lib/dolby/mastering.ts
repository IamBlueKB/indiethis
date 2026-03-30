/**
 * Legacy Dolby mastering module — Dolby has been replaced by Auphonic.
 *
 * This file is retained only to avoid breaking the dashboard/mastering route
 * that still imports from it for its GET handler (job list). The POST
 * (start mastering) path is no longer supported via this module — mastering
 * is now handled exclusively through the AI job processor (AIJob / MASTERING).
 *
 * All exported functions throw a clear error so callers know to migrate.
 */

export type MasteringTier = "quick" | "studio";

export type MasteringPreset = "A" | "B" | "C" | "D" | "E" | "F";

export interface StartMasteringOptions {
  inputUrl:  string;
  outputUrl: string;
  tier:      MasteringTier;
  preset?:   MasteringPreset;
}

export interface MasteringPreviewOptions {
  inputUrl:  string;
  outputUrl: string;
  tier:      MasteringTier;
  preset?:   MasteringPreset;
  startTime?: number;
  duration?:  number;
}

export interface MasteringJob {
  jobId:         string;
  status:        "Pending" | "Running" | "Success" | "Failed" | "Canceled" | "Expired";
  completedAt?:  string;
  error?:        string;
  outputLoudness?: number;
}

function notSupported(): never {
  throw new Error(
    "Direct Dolby mastering is no longer supported. " +
    "Mastering is now handled by the AI job processor (AIJob type: MASTERING via Auphonic).",
  );
}

export async function startMastering(_options: StartMasteringOptions): Promise<string> {
  return notSupported();
}

export async function startMasteringPreview(_options: MasteringPreviewOptions): Promise<string> {
  return notSupported();
}

export async function pollMasteringJob(
  _jobId:      string,
  _preview?:   boolean,
  _intervalMs?: number,
  _timeoutMs?:  number,
): Promise<MasteringJob> {
  return notSupported();
}

export async function masterTrack(_options: StartMasteringOptions): Promise<MasteringJob> {
  return notSupported();
}

export async function previewMastering(_options: MasteringPreviewOptions): Promise<MasteringJob> {
  return notSupported();
}

export async function getDolbyUploadUrl(_filename: string): Promise<{
  dlbUrl:    string;
  uploadUrl: string;
}> {
  return notSupported();
}

export async function getDolbyDownloadUrl(_dlbUrl: string): Promise<string> {
  return notSupported();
}
